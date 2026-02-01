import { and, desc, eq, gte, like, schema } from "@repo/db";
import { z } from "zod";
import { aggregateStreetReports } from "../lib/aggregation.js";
import { searchStreets } from "../lib/street-search.js";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc.js";

const { street, pathReport } = schema as any;

/**
 * Street status enum for validation
 */
const streetStatusEnum = z.enum([
  "optimal",
  "fair",
  "sufficient",
  "needs_maintenance",
]);

/**
 * Street router - handles street discovery and reporting
 */
export const streetRouter = router({
  /**
   * Search for cyclable streets by name using OpenStreetMap Nominatim
   * Results are cached in-memory with infinite TTL
   * Useful for autocomplete when creating manual paths
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        city: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      // Search Nominatim for streets (cached in-memory)
      const results = await searchStreets(input.query, input.city);

      // Return limited results
      return results.slice(0, input.limit);
    }),

  /**
   * Get street details with recent reports (public)
   */
  getDetails: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [streetData] = await ctx.db
        .select()
        .from(street)
        .where(eq(street.id, input.id));

      if (!streetData) {
        throw new Error("Street not found");
      }

      // Get recent reports (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const reports = await ctx.db
        .select()
        .from(pathReport)
        .where(
          and(
            eq(pathReport.streetId, input.id),
            eq(pathReport.isPublishable, true), // Only show published reports
            gte(pathReport.createdAt, thirtyDaysAgo),
          ),
        )
        .orderBy(desc(pathReport.createdAt))
        .limit(10);

      return {
        street: streetData,
        recentReports: reports,
      };
    }),

  /**
   * List all streets with optional filters (public)
   */
  list: publicProcedure
    .input(
      z.object({
        cyclableOnly: z.boolean().default(true),
        city: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.cyclableOnly) {
        conditions.push(eq(street.isCyclable, true));
      }

      if (input.city) {
        conditions.push(like(street.city, `%${input.city}%`));
      }

      return await ctx.db
        .select()
        .from(street)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(input.limit);
    }),

  /**
   * Create a new report for a street
   * Triggers aggregation if report is publishable
   */
  createReport: protectedProcedure
    .input(
      z.object({
        streetId: z.string(),
        status: streetStatusEnum,
        collectionMode: z.enum(["manual", "automated"]),
        obstacles: z.array(z.any()).optional(),
        sensorData: z.any().optional(),
        isPublishable: z.boolean().default(false),
        isConfirmed: z.boolean().default(true), // Manual reports are auto-confirmed
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Create the report
      const [newReport] = await ctx.db
        .insert(pathReport)
        .values({
          userId: ctx.user!.id,
          streetId: input.streetId,
          status: input.status as any, // Cast to path status type for storage
          collectionMode: input.collectionMode,
          obstacles: input.obstacles,
          sensorData: input.sensorData,
          isPublishable: input.isPublishable,
          isConfirmed: input.isConfirmed,
        })
        .returning();

      // If publishable, trigger aggregation
      if (input.isPublishable) {
        await aggregateStreetReports(input.streetId, ctx.db);
      }

      return newReport;
    }),

  /**
   * List user's own reports for streets
   */
  myReports: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const reports = await ctx.db
        .select()
        .from(pathReport)
        .where(eq(pathReport.userId, ctx.user!.id))
        .orderBy(desc(pathReport.createdAt))
        .limit(input.limit);

      return reports;
    }),
});
