import { and, desc, eq, gte, inArray, schema } from "@repo/db";
import { z } from "zod";
import { findRoutes } from "../lib/routing.js";
import { publicProcedure, router } from "../lib/trpc.js";

const { trip, tripRoute, obstacleReport } = schema;

/**
 * Routing router - handles route finding between two points
 * Supports both coordinate-based and address-based queries
 * Public endpoints - no authentication required
 */
export const routingRouter = router({
  /**
   * Find routes between two street names
   * Searches for existing paths in the database
   */
  findRoutes: publicProcedure
    .input(
      z.object({
        startStreetName: z.string().min(1),
        endStreetName: z.string().min(1),
        startLat: z.number().optional(),
        startLon: z.number().optional(),
        endLat: z.number().optional(),
        endLon: z.number().optional(),
        proximityThresholdKm: z.number().min(0.1).max(5).optional(),
        nearbyThresholdKm: z.number().min(0.5).max(5).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if start and end are the same
      if (input.startStreetName === input.endStreetName) {
        return {
          success: false,
          message: "Start and end streets must be different",
          routes: [],
        };
      }

      // Find routes by searching paths that contain these streets
      const allRoutes = await findRoutes(
        input.startStreetName,
        input.endStreetName,
        ctx.db as any,
        {
          startLat: input.startLat,
          startLon: input.startLon,
          endLat: input.endLat,
          endLon: input.endLon,
          proximityThresholdKm: input.proximityThresholdKm,
          nearbyThresholdKm: input.nearbyThresholdKm,
        },
      );

      if (!allRoutes || allRoutes.length === 0) {
        return {
          success: false,
          message: `No routes found between "${input.startStreetName}" and "${input.endStreetName}"`,
          routes: [],
        };
      }

      // Limit to top 5 results (R32 requirement)
      const routes = allRoutes.slice(0, 5);

      // Fetch obstacles for all matched routes in bulk
      const { path } = schema;
      const routeIds = routes.map((r) => r.id);

      // Get path records for all matched routes to find their tripIds
      const pathRecords = await ctx.db
        .select()
        .from(path)
        .where(inArray(path.id, routeIds));

      const tripIds = pathRecords
        .map((p: any) => p.tripId)
        .filter(Boolean) as string[];

      // Get all trip routes for those trips
      let allTripRoutes: any[] = [];
      if (tripIds.length > 0) {
        allTripRoutes = await ctx.db
          .select({ id: tripRoute.id, tripId: tripRoute.tripId })
          .from(tripRoute)
          .where(inArray(tripRoute.tripId, tripIds));
      }

      // Get all obstacles for those trip routes in a single query
      let allObstacles: any[] = [];
      if (allTripRoutes.length > 0) {
        const tripRouteIds = allTripRoutes.map((r: any) => r.id);
        allObstacles = await ctx.db
          .select()
          .from(obstacleReport)
          .where(inArray(obstacleReport.tripRouteId, tripRouteIds));
      }

      // Build a map: pathId → obstacles
      const pathTripMap = new Map<string, string>(
        pathRecords
          .filter((p: any) => p.tripId)
          .map((p: any) => [p.id, p.tripId as string]),
      );
      const tripRouteMap = new Map<string, string[]>();
      for (const tr of allTripRoutes) {
        const existing = tripRouteMap.get(tr.tripId) || [];
        existing.push(tr.id);
        tripRouteMap.set(tr.tripId, existing);
      }
      const obstacleByRouteId = new Map<string, any[]>();
      for (const obs of allObstacles) {
        const existing = obstacleByRouteId.get(obs.tripRouteId) || [];
        existing.push(obs);
        obstacleByRouteId.set(obs.tripRouteId, existing);
      }

      const routesWithObstacles = routes.map((route) => {
        const tripId = pathTripMap.get(route.id);
        let obstacles: any[] = [];
        if (tripId) {
          const trIds = tripRouteMap.get(tripId) || [];
          for (const trId of trIds) {
            obstacles.push(...(obstacleByRouteId.get(trId) || []));
          }
        }
        return { ...route, obstacles };
      });

      return {
        success: true,
        message: `Found ${routes.length} route${routes.length !== 1 ? "s" : ""}`,
        routes: routesWithObstacles.map((route) => ({
          id: route.id,
          name: route.name,
          streets: route.streets,
          distance: parseFloat(route.distance.toFixed(2)),
          distanceKm: parseFloat(route.distance.toFixed(2)),
          travelTimeMinutes: route.travelTimeMinutes,
          score: route.score,
          originalScore: route.originalScore,
          matchType: route.matchType,
          proximityPenalty: route.proximityPenalty,
          geometry: route.geometry,
          streetCount: route.streets.length,
          obstacles: (route.obstacles || []).map((obs: any) => ({
            id: obs.id,
            lat: obs.lat,
            lon: obs.lon,
            type: obs.type,
            description: obs.description || undefined,
            status: obs.status || undefined,
          })),
        })),
      };
    }),

  /**
   * Get detailed information about a specific route/path
   */
  getRouteDetails: publicProcedure
    .input(
      z.object({
        routeId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get path from database
      const { path } = schema;

      const [pathData] = await ctx.db
        .select()
        .from(path)
        .where(eq(path.id, input.routeId));

      if (!pathData) {
        throw new Error("Route not found");
      }

      // Get path segments with streets
      const pathWithSegments = await (ctx.db as any).query.path.findFirst({
        where: eq((schema.path as any).id, input.routeId),
        with: {
          pathSegments: {
            with: {
              street: true,
            },
          },
        },
      });

      const streets = pathWithSegments?.pathSegments?.map((seg: any) => ({
        id: seg.street.id,
        name: seg.street.name,
        currentStatus: seg.street.status,
      })) || [];

      // Get reports for streets in this route
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return {
        id: pathData.id,
        name: pathData.name,
        geometry: pathData.geometry,
        streets: await Promise.all(
          streets.map(async (s: any) => {
            // Query reports for this street from the last 30 days
            let recentReportCount = 0;
            let lastReportDate: Date | null = null;

            try {
              // Count publishable reports for this street in the last 30 days
              const { pathReport } = schema as any;

              // Query recent reports for this street
              const reports = await ctx.db
                .select()
                .from(pathReport)
                .where(
                  and(
                    eq(pathReport.streetId, s.id),
                    eq(pathReport.isPublishable, true),
                    gte(pathReport.createdAt, thirtyDaysAgo),
                  ),
                )
                .orderBy(desc(pathReport.createdAt));

              recentReportCount = reports.length;
              if (reports.length > 0) {
                lastReportDate = reports[0].createdAt;
              }
            } catch (error) {
              // If query fails, just return 0
              console.warn(`Failed to get reports for street ${s.id}:`, error);
            }

            return {
              ...s,
              recentReportCount,
              lastReportDate,
            };
          }),
        ),
      };
    }),
});

