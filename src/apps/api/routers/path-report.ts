/**
 * Path Report router - handles crowdsourced condition reporting on trips
 * SPDX-FileCopyrightText: 2025-present Best Bike Paths Team
 * SPDX-License-Identifier: MIT
 */

import { and, asc, desc, eq, schema, sql } from "@repo/db";
import { z } from "zod";
import { aggregateStreetReports } from "../lib/aggregation.js";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc.js";

const { pathReport, tripRoute, trip, user, street } = schema;

/**
 * Update street status based on all published reports for its routes.
 * This ensures street.currentStatus reflects the aggregated community feedback.
 * Also recalculates path status for paths containing this street.
 * Works for both trip-based reports (via tripRouteId) and street-only reports.
 */
async function updateStreetStatusFromReports(
  db: any,
  tripRouteId: string | null,
  streetName?: string,
): Promise<void> {
  let streetId: string | undefined;

  if (tripRouteId) {
    // For trip-based reports, get street from the trip route
    const [routeData] = await db
      .select()
      .from(tripRoute)
      .where(eq(tripRoute.id, tripRouteId));

    if (!routeData || !routeData.streetId) {
      // Route doesn't link to a street yet, nothing to update
      return;
    }

    streetId = routeData.streetId;
  } else if (streetName) {
    // For street-only reports, look up street by name
    const [streetData] = await db
      .select()
      .from(street)
      .where(eq(street.name, streetName));

    if (!streetData) {
      // Street not found, nothing to update
      return;
    }

    streetId = streetData.id;
  } else {
    // Can't determine street, skip update
    return;
  }

  // Use aggregateStreetReports which handles street status update
  // and path status recalculation
  if (streetId) {
    await aggregateStreetReports(streetId, db);
  }
}

export const pathReportRouter = router({
  /**
   * Create a new report for a route (trip segment) or standalone street report
   */
  create: protectedProcedure
    .input(
      z.object({
        tripRouteId: z.string().optional(), // Optional for street-based reports
        streetName: z.string().optional(), // Street name for street-based reports
        lat: z.number().optional(),
        lon: z.number().optional(),
        status: z.enum(["optimal", "medium", "sufficient", "requires_maintenance"]),
        obstacles: z.any().optional(), // Array of obstacle objects
        isPublishable: z.boolean().default(true),
        collectionMode: z.enum(["manual", "automated"]).default("manual"),
        rating: z.number().min(1).max(5).optional(), // User rating for trip
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let actualTripRouteId: string | null | undefined = input.tripRouteId;

      // If no tripRouteId provided, this is a standalone street report
      // Street reports don't require a trip - they're independent observations
      if (!actualTripRouteId) {
        if (!input.streetName || input.lat === undefined || input.lon === undefined) {
          throw new Error("Either tripRouteId or (streetName, lat, lon) must be provided");
        }

        // For street-only reports, we'll store the location in the report itself
        // No need to create fake trips
        actualTripRouteId = null;
      } else {
        // Verify tripRoute exists for trip-based reports
        const [routeData] = await ctx.db
          .select()
          .from(tripRoute)
          .where(eq(tripRoute.id, actualTripRouteId));

        if (!routeData) {
          throw new Error("Route not found");
        }
      }

      // Create the report
      const reportValues: any = {
        userId: ctx.user!.id,
        tripRouteId: actualTripRouteId,
        status: input.status,
        obstacles: input.obstacles || null,
        isPublishable: input.isPublishable,
        collectionMode: input.collectionMode,
        isConfirmed: input.collectionMode === "manual" ? true : false,
        rating: input.rating || null, // Store user rating for score calculation
      };

      // For street-only reports, store location and street name
      if (!actualTripRouteId) {
        (reportValues as any).streetName = input.streetName;
        (reportValues as any).lat = input.lat;
        (reportValues as any).lon = input.lon;
      }

      const [newReport] = await ctx.db
        .insert(pathReport)
        .values(reportValues as any)
        .returning();

      // Update street status if report is publishable
      if (input.isPublishable) {
        await updateStreetStatusFromReports(ctx.db, actualTripRouteId, input.streetName);
      }

      return newReport;
    }),

  /**
   * List published reports (public)
   */
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["optimal", "medium", "sufficient", "requires_maintenance"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(pathReport.isPublishable, true)];
      if (input.status) {
        conditions.push(eq(pathReport.status, input.status));
      }

      const reports = await ctx.db
        .select()
        .from(pathReport)
        .where(and(...conditions))
        .orderBy(desc(pathReport.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return reports;
    }),

  /**
   * Get report detail with route and trip context
   */
  detail: publicProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [reportData] = await ctx.db
        .select()
        .from(pathReport)
        .where(eq(pathReport.id, input.reportId));

      if (!reportData || !reportData.isPublishable) {
        throw new Error("Report not found");
      }

      // Get the route this report is about (may be null for standalone street reports)
      let routeData = null;
      let tripData = null;

      if (reportData.tripRouteId) {
        const result = await ctx.db
          .select()
          .from(tripRoute)
          .where(eq(tripRoute.id, reportData.tripRouteId));
        [routeData] = result;

        // Get the trip that contains this route
        if (routeData) {
          const [foundTrip] = await ctx.db
            .select()
            .from(trip)
            .where(eq(trip.id, routeData.tripId));
          tripData = foundTrip ?? null;
        }
      }

      // Get the user info
      const [userData] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.id, reportData.userId));

      return {
        report: reportData,
        route: routeData,
        trip: tripData,
        user: {
          id: userData.id,
          name: userData.name,
        },
      };
    }),

  /**
   * Update a report
   */
  update: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        status: z.enum(["optimal", "medium", "sufficient", "requires_maintenance"]).optional(),
        obstacles: z.any().optional(),
        isPublishable: z.boolean().optional(),
        isConfirmed: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify report belongs to user
      const [reportData] = await ctx.db
        .select()
        .from(pathReport)
        .where(eq(pathReport.id, input.reportId));

      if (!reportData || reportData.userId !== ctx.user!.id) {
        throw new Error("Report not found or unauthorized");
      }

      // Update the report
      const updateData: any = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.obstacles !== undefined) updateData.obstacles = input.obstacles;
      if (input.isPublishable !== undefined) updateData.isPublishable = input.isPublishable;
      if (input.isConfirmed !== undefined) updateData.isConfirmed = input.isConfirmed;

      const [updatedReport] = await ctx.db
        .update(pathReport)
        .set(updateData)
        .where(eq(pathReport.id, input.reportId))
        .returning();

      // Update street status if report changes affect publishable state or status
      if (
        input.status !== undefined ||
        input.isPublishable !== undefined
      ) {
        await updateStreetStatusFromReports(ctx.db, reportData.tripRouteId, (reportData as any).streetName);
      }

      return updatedReport;
    }),

  /**
   * Delete a report
   */
  delete: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify report belongs to user
      const [reportData] = await ctx.db
        .select()
        .from(pathReport)
        .where(eq(pathReport.id, input.reportId));

      if (!reportData || reportData.userId !== ctx.user!.id) {
        throw new Error("Report not found or unauthorized");
      }

      // Store tripRouteId and streetName before deleting
      const tripRouteId = reportData.tripRouteId;
      const streetName = (reportData as any).streetName;
      const wasPublishable = reportData.isPublishable;

      await ctx.db.delete(pathReport).where(eq(pathReport.id, input.reportId));

      // Update street status if we deleted a publishable report
      if (wasPublishable) {
        await updateStreetStatusFromReports(ctx.db, tripRouteId, streetName);
      }

      return { success: true };
    }),

  /**
   * List user's own reports (including drafts)
   */
  myReports: protectedProcedure.query(async ({ ctx }) => {
    const reports = await ctx.db
      .select()
      .from(pathReport)
      .where(eq(pathReport.userId, ctx.user!.id))
      .orderBy(desc(pathReport.createdAt));

    return reports;
  }),
});
