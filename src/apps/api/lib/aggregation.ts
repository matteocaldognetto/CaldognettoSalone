import { and, asc, eq, gte, inArray, schema } from "@repo/db";
import type { DB } from "better-auth/adapters/drizzle";
import { calculatePathDeviation } from "./routing.js";

const { path, pathReport, street, pathSegment, tripRoute } = schema as any;

export type PathStatus =
  | "optimal"
  | "medium"
  | "sufficient"
  | "requires_maintenance";

/**
 * Status score mapping for path ranking
 */
const STATUS_SCORES: Record<PathStatus, number> = {
  optimal: 100,
  medium: 70,
  sufficient: 50,
  requires_maintenance: 20,
};

/**
 * Calculate freshness weight based on report age
 * - < 7 days: 1.0 (full weight)
 * - 7-14 days: 0.8
 * - 14-30 days: 0.5
 * - > 30 days: 0 (ignored)
 */
function calculateFreshnessWeight(reportDate: Date): number {
  const ageInDays = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays < 7) return 1.0;
  if (ageInDays < 14) return 0.8;
  if (ageInDays < 30) return 0.5;
  return 0; // Too old, ignore
}


function calculateRecencyBonus(reports: (typeof pathReport.$inferSelect)[]) {
  const avgAge =
    reports.reduce((sum, r) => {
      const ageInDays =
        (Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return sum + ageInDays;
    }, 0) / reports.length;

  // More recent = higher bonus (max +10)
  return Math.max(0, 10 * (1 - avgAge / 30));
}

/**
 * Aggregate reports for a street and update its status
 * Also recalculates status for all paths containing this street
 *
 * Algorithm:
 * 1. Find all trip routes linking to this street
 * 2. Get all published reports for those routes from last 30 days
 * 3. Apply weights based on report age
 * 4. Count weighted votes for each status
 * 5. Majority wins
 * 6. Update street status and any paths using this street
 */
export async function aggregateStreetReports(streetId: string, db: DB) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get all trip routes that link to this street
  const routesForStreet = await db
    .select({ id: tripRoute.id })
    .from(tripRoute)
    .where(eq(tripRoute.streetId, streetId));

  if (routesForStreet.length === 0) {
    return null;
  }

  const routeIds = routesForStreet.map((r: any) => r.id);

  // Get reports for these routes
  const reports = await db
    .select()
    .from(pathReport)
    .where(
      and(
        eq(pathReport.isPublishable, true),
        gte(pathReport.createdAt, thirtyDaysAgo),
        inArray(pathReport.tripRouteId, routeIds),
      ),
    );

  if (reports.length === 0) {
    return null;
  }

  // Weighted averaging with freshness (not voting!)
  const statusValues: Record<PathStatus, number> = {
    optimal: 4,
    medium: 3,
    sufficient: 2,
    requires_maintenance: 1,
  };

  const reverseMapping: Record<number, PathStatus> = {
    4: "optimal",
    3: "medium",
    2: "sufficient",
    1: "requires_maintenance",
  };

  let totalWeightedValue = 0;
  let totalWeight = 0;

  for (const report of reports) {
    const weight = calculateFreshnessWeight(report.createdAt);
    if (weight > 0) {
      const statusValue = statusValues[report.status as PathStatus];
      totalWeightedValue += statusValue * weight;
      totalWeight += weight;
    }
  }

  // Calculate weighted average and round to nearest status
  const avgValue = totalWeightedValue / totalWeight;
  const roundedValue = Math.round(avgValue) as 1 | 2 | 3 | 4;
  const winner = reverseMapping[roundedValue];

  // Update street in database
  await db
    .update(street)
    .set({
      currentStatus: winner,
      updatedAt: new Date(),
    })
    .where(eq(street.id, streetId));

  // Find all paths containing this street and recalculate their status
  const affectedPaths = await db
    .select({ pathId: pathSegment.pathId })
    .from(pathSegment)
    .where(eq(pathSegment.streetId, streetId));

  for (const { pathId } of affectedPaths) {
    await updatePathStatusAndScore(pathId, db);
  }

  return winner;
}

/**
 * Calculate path status as average of its streets' statuses
 * Status values: optimal=4, medium=3, sufficient=2, requires_maintenance=1
 */
export async function calculatePathStatusFromStreets(pathId: string, db: DB) {
  const segments = await db
    .select()
    .from(pathSegment)
    .where(eq(pathSegment.pathId, pathId))
    .innerJoin(street, eq(pathSegment.streetId, street.id))
    .orderBy(asc(pathSegment.orderIndex));

  if (segments.length === 0) {
    return null;
  }

  const statusValues: Record<PathStatus, number> = {
    optimal: 4,
    medium: 3,
    sufficient: 2,
    requires_maintenance: 1,
  };

  const reverseMapping: Record<number, PathStatus> = {
    4: "optimal",
    3: "medium",
    2: "sufficient",
    1: "requires_maintenance",
  };

  // Calculate average
  const validSegments = segments.filter((s: any) => s.street.currentStatus);

  if (validSegments.length === 0) {
    return null;
  }

  const avgValue =
    validSegments.reduce((sum: number, s: any) => {
      const status = s.street.currentStatus as PathStatus;
      return sum + statusValues[status];
    }, 0) / validSegments.length;

  // Round to nearest integer
  const roundedValue = Math.round(avgValue);
  return reverseMapping[roundedValue];
}

/**
 * Calculate path score (private, used for ranking)
 *
 * Formula: Path Score = α · P + β · S − γ · Olast · 100 − δ · L · 100
 * Where:
 * - P = average of user ratings (1-5, normalized to 0-100)
 * - S = average of road condition statuses (normalized to 0-100)
 * - Olast = number of obstacles reported since the last review
 * - L = path deviation from straight line (0 = straight, 1 = very winding)
 * - α = 0.1 (weight for user ratings)
 * - β = 0.3 (weight for street conditions)
 * - γ = 0.6 (weight for obstacles)
 * - δ = 0.15 (weight for path deviation)
 */
export async function calculatePathScore(pathId: string, db: DB) {
  const [pathData] = await db
    .select()
    .from(path)
    .where(eq(path.id, pathId));

  if (!pathData) {
    return 0;
  }

  // Get the trip that this path was published from (if any)
  const tripId = (pathData as any).tripId;

  // === Component P: Average of user ratings ===
  let P = 50; // Default to middle score if no ratings

  if (tripId) {
    // Get all community ratings from path reports for this trip's routes
    const routes = await db
      .select({ id: tripRoute.id })
      .from(tripRoute)
      .where(eq(tripRoute.tripId, tripId));

    if (routes.length > 0) {
      const routeIds = routes.map((r: any) => r.id);

      // Get ratings from path reports linked to these routes
      const ratedReports = await db
        .select()
        .from(pathReport)
        .where(
          and(
            eq(pathReport.isPublishable, true),
            inArray(pathReport.tripRouteId, routeIds),
          ),
        );

      const ratings = ratedReports
        .filter((r: any) => r.rating != null)
        .map((r: any) => r.rating);

      // If we have community ratings, use them
      if (ratings.length > 0) {
        const avgRating = ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length;
        P = ((avgRating - 1) / 4) * 100; // Normalize 1-5 to 0-100
      } else {
        // Fallback to original trip rating if no community ratings yet
        const { tripRating } = schema as any;
        const [rating] = await db
          .select()
          .from(tripRating)
          .where(eq(tripRating.tripId, tripId));

        if (rating) {
          P = ((rating.rating - 1) / 4) * 100; // 1->0, 3->50, 5->100
        }
      }
    }
  }

  // === Component S: Average of road condition statuses ===
  let S = 50; // Default to middle score if no streets

  const segments = await db
    .select()
    .from(pathSegment)
    .innerJoin(street, eq(pathSegment.streetId, street.id))
    .where(eq(pathSegment.pathId, pathId));

  if (segments.length > 0) {
    const validSegments = segments.filter((s: any) => s.street.currentStatus);

    if (validSegments.length > 0) {
      const avgStatusScore =
        validSegments.reduce((sum: number, s: any) => {
          const status = s.street.currentStatus as PathStatus;
          return sum + STATUS_SCORES[status];
        }, 0) / validSegments.length;

      S = avgStatusScore; // STATUS_SCORES already in 0-100 range
    }
  }

  // === Component Olast: Obstacles since last review ===
  let Olast = 0;

  if (tripId) {
    // Get the last scoreCalculatedAt time for this path
    const lastReviewDate = pathData.scoreCalculatedAt || pathData.createdAt;

    // Get all trip routes for this trip
    const routes = await db
      .select({ id: tripRoute.id })
      .from(tripRoute)
      .where(eq(tripRoute.tripId, tripId));

    if (routes.length > 0) {
      const routeIds = routes.map((r: any) => r.id);
      const { obstacleReport } = schema as any;

      // Count obstacles reported since last review
      const obstacles = await db
        .select()
        .from(obstacleReport)
        .where(
          and(
            gte(obstacleReport.createdAt, lastReviewDate),
            inArray(obstacleReport.tripRouteId, routeIds),
          ),
        );

      Olast = obstacles.length;
    }
  }

  // === Component L: Path deviation from straight line ===
  let L = 0;

  if (pathData.geometry && (pathData.geometry as any).coordinates) {
    const coords = (pathData.geometry as any).coordinates as Array<[number, number]>;
    if (coords.length >= 2) {
      L = calculatePathDeviation(coords);
    }
  }

  // === Final Calculation ===
  // Weights: α=0.1, β=0.3, γ=0.6 per obstacle, δ=0.15 for deviation
  const alpha = 0.1;
  const beta = 0.3;
  const obstacleWeight = 0.6;
  const delta = 0.15;

  const finalScore = alpha * P + beta * S - (obstacleWeight * Olast * 100) - (delta * L * 100);

  return Math.max(0, Math.min(100, finalScore));
}

/**
 * Update path status and score based on its streets
 */
export async function updatePathStatusAndScore(pathId: string, db: DB) {
  const newStatus = await calculatePathStatusFromStreets(pathId, db);
  const newScore = await calculatePathScore(pathId, db);

  await db
    .update(path)
    .set({
      currentStatus: newStatus,
      score: newScore.toString(), // Convert to string for decimal field
      scoreCalculatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(path.id, pathId));
}

/**
 * Calculate weighted status from a set of reports with weights.
 * Used internally by aggregateStreetReports.
 * Exported for unit testing.
 */
function calculateWeightedStatus(
  reports: Array<{ status: string; weight: number }>,
): PathStatus | null {
  const statusValues: Record<string, number> = {
    optimal: 4,
    medium: 3,
    sufficient: 2,
    requires_maintenance: 1,
  };

  const reverseMapping: Record<number, PathStatus> = {
    4: "optimal",
    3: "medium",
    2: "sufficient",
    1: "requires_maintenance",
  };

  let totalWeightedValue = 0;
  let totalWeight = 0;

  for (const report of reports) {
    if (report.weight > 0) {
      const statusValue = statusValues[report.status];
      if (statusValue != null) {
        totalWeightedValue += statusValue * report.weight;
        totalWeight += report.weight;
      }
    }
  }

  if (totalWeight === 0) return null;

  const avgValue = totalWeightedValue / totalWeight;
  const roundedValue = Math.round(avgValue);
  return reverseMapping[roundedValue] ?? null;
}

/**
 * Calculate path score from raw components (pure function, no DB).
 * Used internally by calculatePathScore.
 * Exported for unit testing.
 *
 * Formula: Score = α·P + β·S − γ·O·100 − δ·L·100
 */
function calculateScorePure(P: number, S: number, obstacles: number, L: number = 0): number {
  const alpha = 0.1;
  const beta = 0.3;
  const obstacleWeight = 0.6;
  const delta = 0.15;

  const score = alpha * P + beta * S - obstacleWeight * obstacles * 100 - delta * L * 100;
  return Math.max(0, Math.min(100, score));
}

/**
 * Export for testing
 */
export const _testing = {
  calculateFreshnessWeight,
  calculateRecencyBonus,
  calculateWeightedStatus,
  calculateScorePure,
  STATUS_SCORES,
};
