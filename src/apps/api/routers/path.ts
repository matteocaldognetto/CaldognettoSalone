import { and, asc, desc, eq, inArray, schema, sql } from "@repo/db";
import { z } from "zod";
import { aggregateStreetReports, calculatePathScore, calculatePathStatusFromStreets, updatePathStatusAndScore } from "../lib/aggregation.js";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc.js";

const { path, pathReport, pathSegment, street, trip, tripRoute, obstacleReport } = schema;

/**
 * Path router - handles bike path management and discovery
 * Status and reporting is now handled at the street level only.
 * Path status is derived from its constituent streets.
 */
export const pathRouter = router({
  /**
   * Search for paths (public - no auth required)
   * Returns paths sorted by score, with computed geometry from streets if needed
   */
  search: publicProcedure
    .input(
      z.object({
        // For demo, we'll support simple search by name
        // In production, add origin/destination coordinates for spatial search
        query: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Build query with optional name filter
      let query = ctx.db
        .select({
          id: path.id,
          name: path.name,
          description: path.description,
          tripId: path.tripId,
          geometry: path.geometry,
          currentStatus: path.currentStatus,
          score: path.score,
          tripOwnerId: trip.userId,
        })
        .from(path)
        .leftJoin(trip, eq(path.tripId, trip.id));

      // Filter by name if query provided (case insensitive)
      if (input.query && input.query.trim().length > 0) {
        query = query.where(sql`LOWER(${path.name}) LIKE LOWER(${`%${input.query}%`})`) as any;
      }

      const paths = await query
        .orderBy(desc(path.score))
        .limit(input.limit);

      // Pre-fetch obstacles for all paths with tripIds in bulk
      const tripIds = paths
        .map((p: any) => p.tripId)
        .filter(Boolean) as string[];

      let obstaclesByPathTripId = new Map<string, any[]>();
      if (tripIds.length > 0) {
        const allTripRoutes = await ctx.db
          .select({ id: tripRoute.id, tripId: tripRoute.tripId })
          .from(tripRoute)
          .where(inArray(tripRoute.tripId, tripIds));

        if (allTripRoutes.length > 0) {
          const tripRouteIds = allTripRoutes.map((r: any) => r.id);
          const allObstacles = await ctx.db
            .select()
            .from(obstacleReport)
            .where(inArray(obstacleReport.tripRouteId, tripRouteIds));

          // Build tripId → obstacles map
          const tripRouteToTripId = new Map<string, string>();
          for (const tr of allTripRoutes) {
            tripRouteToTripId.set(tr.id, tr.tripId);
          }
          for (const obs of allObstacles) {
            const tid = tripRouteToTripId.get(obs.tripRouteId);
            if (tid) {
              const existing = obstaclesByPathTripId.get(tid) || [];
              existing.push(obs);
              obstaclesByPathTripId.set(tid, existing);
            }
          }
        }
      }

      // Compute geometry from streets if path geometry is null
      const pathsWithGeometry = await Promise.all(
        paths.map(async (p: any) => {
          const obstacles = obstaclesByPathTripId.get(p.tripId) || [];

          // If path already has geometry, return with obstacles
          if (p.geometry) {
            return { ...p, obstacles };
          }

          // Otherwise, reconstruct geometry from streets
          const segments = await ctx.db
            .select()
            .from(pathSegment)
            .innerJoin(street, eq(pathSegment.streetId, street.id))
            .where(eq(pathSegment.pathId, p.id))
            .orderBy(asc(pathSegment.orderIndex));

          if (segments.length === 0) {
            // No streets, return path as-is
            return p;
          }

          // Combine all street geometries into one LineString
          const allCoordinates: Array<[number, number]> = [];
          for (const segment of segments) {
            const streetGeom = segment.street.geometry as {
              type: string;
              coordinates: Array<[number, number]>;
            };

            if (
              streetGeom &&
              streetGeom.type === "LineString" &&
              streetGeom.coordinates &&
              Array.isArray(streetGeom.coordinates)
            ) {
              // Include all coordinates (including placeholders) to at least create SOME geometry
              // Real coordinates will be used when available, placeholders when not
              const validCoords = streetGeom.coordinates.filter(
                (coord: any) =>
                  Array.isArray(coord) &&
                  coord.length >= 2 &&
                  typeof coord[0] === "number" &&
                  typeof coord[1] === "number"
              );

              if (validCoords.length > 0) {
                // Add valid coordinates from this street
                if (allCoordinates.length === 0) {
                  // First street, add all coordinates
                  allCoordinates.push(...validCoords);
                } else {
                  // Subsequent streets, skip the first coordinate (to avoid duplication)
                  allCoordinates.push(...validCoords.slice(1));
                }
              }
            }
          }

          // Only return geometry if we have valid coordinates
          if (allCoordinates.length < 2) {
            // Not enough valid coordinates, return path with obstacles but no geometry
            return { ...p, obstacles };
          }

          // Return path with computed geometry and obstacles
          return {
            ...p,
            geometry: {
              type: "LineString",
              coordinates: allCoordinates,
            },
            obstacles,
          };
        })
      );

      return pathsWithGeometry;
    }),

  /**
   * Get path details with its constituent streets (public)
   */
  getDetails: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [pathData] = await ctx.db
        .select()
        .from(path)
        .where(eq(path.id, input.id));

      if (!pathData) {
        throw new Error("Path not found");
      }

      // Get obstacles if path has a tripId
      let obstacles: any[] = [];

      if ((pathData as any).tripId) {
        const tripRoutes = await ctx.db
          .select({ id: tripRoute.id })
          .from(tripRoute)
          .where(eq(tripRoute.tripId, (pathData as any).tripId));

        if (tripRoutes.length > 0) {
          const routeIds = tripRoutes.map((r: any) => r.id);
          obstacles = await ctx.db
            .select()
            .from(obstacleReport)
            .where(inArray(obstacleReport.tripRouteId, routeIds));
        }
      }

      // Get streets that make up this path
      const segments = await ctx.db
        .select()
        .from(pathSegment)
        .innerJoin(street, eq(pathSegment.streetId, street.id))
        .where(eq(pathSegment.pathId, input.id))
        .orderBy(asc(pathSegment.orderIndex));

      // If no segments found and path has a tripId, get routes from the trip
      if (segments.length === 0 && (pathData as any).tripId) {
        const tripRoutes = await ctx.db
          .select()
          .from(tripRoute)
          .where(eq(tripRoute.tripId, (pathData as any).tripId))
          .orderBy(asc(tripRoute.routeIndex));

        // Return trip routes as "streets" for compatibility
        return {
          path: pathData,
          streets: tripRoutes.map((route: any, index: number) => ({
            id: route.id,
            name: route.name || `Route ${index + 1}`,
            description: route.description,
            geometry: route.geometry,
            status: route.currentStatus || "optimal",
            score: route.score,
            orderIndex: route.routeIndex,
          })),
          obstacles,
        };
      }

      return {
        path: pathData,
        streets: segments.map((s: any) => ({
          ...s.street,
          orderIndex: s.path_segment.orderIndex,
        })),
        obstacles,
      };
    }),

  /**
   * Create or get existing path by geometry
   * Returns existing path if geometry matches, otherwise creates new one
   */
  upsertPath: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        geometry: z.any(), // GeoJSON LineString
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // For now, we'll create a new path each time
      // In production, you'd want to check for duplicate geometries using PostGIS
      const [newPath] = await ctx.db
        .insert(path)
        .values({
          name: input.name,
          description: input.description,
          geometry: input.geometry,
        })
        .returning();

      return newPath;
    }),


  /**
   * Create a manual path from an ordered list of streets
   * This is the new way to create paths (street-based composition)
   */
  createManualPath: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        streetIds: z.array(z.string()).min(1),
        geometry: z.any().optional(), // Ignored - geometry is always computed from streets
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Always compute geometry from streets, don't use provided geometry
      // (frontend may provide dummy/incomplete geometry)
      let computedGeometry: any = null;

      // Fetch streets and compute geometry
      const segments = await ctx.db
        .select()
        .from(pathSegment)
        .innerJoin(street, eq(pathSegment.streetId, street.id));

      // Actually, we need to create the path first, then add segments
      // Let me rewrite this logic

      // Create the path with null geometry first
      const [newPath] = await ctx.db
        .insert(path)
        .values({
          name: input.name,
          description: input.description,
          geometry: null, // Will be computed after adding streets
        })
        .returning();

      // Create path segments for each street in order
      for (let i = 0; i < input.streetIds.length; i++) {
        await ctx.db
          .insert(pathSegment)
          .values({
            pathId: newPath.id,
            streetId: input.streetIds[i],
            orderIndex: i,
          })
          .execute();
      }

      // Now fetch all streets for this path and compute geometry
      const pathSegments = await ctx.db
        .select()
        .from(pathSegment)
        .innerJoin(street, eq(pathSegment.streetId, street.id))
        .where(eq(pathSegment.pathId, newPath.id))
        .orderBy(asc(pathSegment.orderIndex));

      const allCoordinates: Array<[number, number]> = [];
      for (const segment of pathSegments) {
        const streetGeom = segment.street.geometry as {
          type: string;
          coordinates: Array<[number, number]>;
        };

        if (
          streetGeom &&
          streetGeom.type === "LineString" &&
          streetGeom.coordinates &&
          Array.isArray(streetGeom.coordinates)
        ) {
          // Include all coordinates (including placeholders)
          // This ensures paths have SOME geometry even if streets only have test data
          const validCoords = streetGeom.coordinates.filter(
            (coord: any) =>
              Array.isArray(coord) &&
              coord.length >= 2 &&
              typeof coord[0] === "number" &&
              typeof coord[1] === "number"
          );

          if (validCoords.length > 0) {
            if (allCoordinates.length === 0) {
              allCoordinates.push(...validCoords);
            } else {
              allCoordinates.push(...validCoords.slice(1));
            }
          }
        }
      }

      // If we have valid coordinates, update the path with computed geometry
      if (allCoordinates.length >= 2) {
        computedGeometry = {
          type: "LineString",
          coordinates: allCoordinates,
        };

        await ctx.db
          .update(path)
          .set({ geometry: computedGeometry })
          .where(eq(path.id, newPath.id))
          .execute();
      }

      // Calculate initial path status from street statuses
      await updatePathStatusAndScore(newPath.id, ctx.db);

      return { ...newPath, geometry: computedGeometry || null };
    }),

  /**
   * Get the streets that make up a path, in order
   */
  getPathStreets: publicProcedure
    .input(z.object({ pathId: z.string() }))
    .query(async ({ ctx, input }) => {
      const segments = await ctx.db
        .select()
        .from(pathSegment)
        .innerJoin(street, eq(pathSegment.streetId, street.id))
        .where(eq(pathSegment.pathId, input.pathId))
        .orderBy(asc(pathSegment.orderIndex));

      return segments.map((s: any) => ({
        ...s.street,
        orderIndex: s.path_segment.orderIndex,
      }));
    }),

  /**
   * Publish a trip as a public path (share to community)
   */
  publishTripAsPath: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        pathName: z.string().optional(), // If not provided, use trip name
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      console.log("[publishTripAsPath] ⏱️  Starting publish for trip:", input.tripId);

      // Fetch the trip
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));
      console.log("[publishTripAsPath] ✓ Fetched trip in", Date.now() - startTime, "ms");

      if (!tripData) {
        throw new Error("Trip not found");
      }

      // Verify trip belongs to current user
      if (tripData.userId !== ctx.user!.id) {
        throw new Error("Unauthorized - trip belongs to another user");
      }

      // Check if trip has already been published
      const [existingPath] = await ctx.db
        .select()
        .from(path)
        .where(eq((path as any).tripId, input.tripId));

      if (existingPath) {
        throw new Error("This trip has already been published as a path");
      }

      // Fetch all routes for this trip, ordered by routeIndex
      const tripRoutes = await ctx.db
        .select()
        .from(tripRoute)
        .where(eq(tripRoute.tripId, input.tripId))
        .orderBy(asc(tripRoute.routeIndex));

      if (tripRoutes.length === 0) {
        throw new Error("Trip has no routes to publish");
      }

      // Combine all route coordinates into a single LineString
      let combinedCoordinates: [number, number][] = [];

      for (const route of tripRoutes) {
        const geometry = route.geometry as any;

        if (
          geometry &&
          geometry.type === "LineString" &&
          Array.isArray(geometry.coordinates) &&
          geometry.coordinates.length > 0
        ) {
          // Add all coordinates except the last (to avoid duplicate points at junctions)
          // But for the first route, add all points including the last
          if (combinedCoordinates.length === 0) {
            combinedCoordinates = [...geometry.coordinates];
          } else {
            // Skip the first coordinate (it's the start of this route, which is the end of the previous)
            combinedCoordinates.push(...geometry.coordinates.slice(1));
          }
        }
      }

      // Create combined geometry
      let geometry: any = null;
      if (combinedCoordinates.length >= 2) {
        geometry = {
          type: "LineString" as const,
          coordinates: combinedCoordinates,
        };
      }

      if (!geometry) {
        throw new Error("Could not create path geometry from trip routes");
      }

      // Create the path from the trip
      const [newPath] = await ctx.db
        .insert(path)
        .values({
          name: input.pathName || tripData.name || "Published Trip",
          description: `Published from trip recorded on ${tripData.startTime}`,
          geometry: geometry,
          ...(input.tripId && { tripId: input.tripId }),
        } as any)
        .returning();

      // Create or get streets for each trip route, then create path_segments
      for (let i = 0; i < tripRoutes.length; i++) {
        const route = tripRoutes[i];
        let streetId = route.streetId;

        // If route doesn't have a street_id, create/find street by name
        if (!streetId && route.name) {
          // Check if street with this name already exists
          const [existingStreet] = await ctx.db
            .select()
            .from(street)
            .where(eq(street.name, route.name))
            .limit(1);

          if (existingStreet) {
            // Use existing street
            streetId = existingStreet.id;
          } else {
            // Try to get initial status from existing pathReport for this tripRoute
            const [existingReport] = await ctx.db
              .select({ status: pathReport.status })
              .from(pathReport)
              .where(
                and(
                  eq(pathReport.tripRouteId, route.id),
                  eq(pathReport.isPublishable, true),
                )
              )
              .orderBy(desc(pathReport.createdAt))
              .limit(1);

            // Create new street record from trip route data
            const [newStreet] = await ctx.db
              .insert(street)
              .values({
                name: route.name,
                geometry: route.geometry || {
                  type: "LineString",
                  coordinates: [
                    [parseFloat(route.startLon), parseFloat(route.startLat)],
                    [parseFloat(route.endLon), parseFloat(route.endLat)],
                  ],
                },
                isCyclable: true,
                currentStatus: existingReport?.status || null,
              })
              .returning();

            streetId = newStreet.id;
          }
        }

        // Create path_segment if we have a street_id
        if (streetId) {
          await ctx.db
            .insert(pathSegment)
            .values({
              pathId: newPath.id,
              streetId: streetId,
              orderIndex: i,
            })
            .execute();

          // Also update the trip_route to link it to the street
          await ctx.db
            .update(tripRoute)
            .set({ streetId: streetId })
            .where(eq(tripRoute.id, route.id))
            .execute();

          // Aggregate existing pathReports for this street to compute currentStatus
          await aggregateStreetReports(streetId, ctx.db);
        }
      }

      // Calculate path score and status based on existing path reports and trip rating
      const newStatus = await calculatePathStatusFromStreets(newPath.id, ctx.db);
      const newScore = await calculatePathScore(newPath.id, ctx.db);

      console.log(`[publishTripAsPath] Calculated score: ${newScore}, status: ${newStatus}`);
      await ctx.db
        .update(path)
        .set({
          currentStatus: newStatus || "medium",
          score: newScore.toString(),
          scoreCalculatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(path.id, newPath.id));

      const totalTime = Date.now() - startTime;
      console.log("[publishTripAsPath] ✅ Publish complete in", totalTime, "ms");
      return newPath;
    }),

  /**
   * Submit a report on a path (updates street statuses)
   */
  submitReport: protectedProcedure
    .input(
      z.object({
        pathId: z.string(),
        rating: z.number().min(1).max(5).optional(),
        streetReports: z.array(
          z.object({
            streetId: z.string(),
            status: z.enum(["optimal", "medium", "sufficient", "requires_maintenance"]),
          }),
        ),
        obstacles: z.array(
          z.object({
            type: z.string(),
            description: z.string(),
            lat: z.number(),
            lon: z.number(),
          }),
        ).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { aggregateStreetReports } = await import("../lib/aggregation.js");
      const { pathReport, obstacleReport } = schema;

      // Get path to find its trip_id
      const [pathData] = await ctx.db
        .select()
        .from(path)
        .where(eq(path.id, input.pathId));

      if (!pathData || !(pathData as any).tripId) {
        throw new Error("Path not found or not linked to a trip");
      }

      const tripId = (pathData as any).tripId;

      // Get the trip to check ownership
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, tripId));

      if (!tripData) {
        throw new Error("Trip not found");
      }

      const isOwner = tripData.userId === ctx.user!.id;

      // Get trip routes for this trip
      const tripRoutes = await ctx.db
        .select()
        .from(tripRoute)
        .where(eq(tripRoute.tripId, tripId));

      // For each street report, find the matching trip_route and create a report
      for (const report of input.streetReports) {
        // Find the trip_route - the streetId being passed is actually the trip_route ID
        // (from getDetails endpoint when path has no path_segments)
        const matchingRoute = tripRoutes.find(
          (route: any) => route.id === report.streetId || route.streetId === report.streetId,
        );

        if (!matchingRoute) {
          console.warn(`No trip_route found for street/route ${report.streetId}`);
          continue;
        }

        // Create a path report record linked to the trip_route
        await ctx.db
          .insert(pathReport)
          .values({
            userId: ctx.user!.id,
            tripRouteId: matchingRoute.id,
            status: report.status,
            isPublishable: true,
            collectionMode: "manual",
            rating: input.rating || null,
          } as any)
          .execute();

        // Trigger aggregation for this street (if trip_route has a street_id)
        if (matchingRoute.streetId) {
          await aggregateStreetReports(matchingRoute.streetId, ctx.db);
        }
      }

      // Handle obstacles - only save if user is the trip owner
      let obstaclesSaved = 0;
      let obstaclesMessage = "";

      if (input.obstacles && input.obstacles.length > 0) {
        if (isOwner) {
          // User owns the trip - save obstacles
          for (const obstacle of input.obstacles) {
            // Find the closest trip_route for this obstacle
            // For simplicity, we'll use the first route (can be improved later)
            if (tripRoutes.length > 0) {
              await ctx.db
                .insert(obstacleReport)
                .values({
                  userId: ctx.user!.id,
                  tripRouteId: tripRoutes[0].id,
                  type: obstacle.type,
                  description: obstacle.description,
                  lat: obstacle.lat.toString(),
                  lon: obstacle.lon.toString(),
                  status: "CONFIRMED",
                  detectionMode: "manual",
                } as any)
                .execute();
              obstaclesSaved++;
            }
          }
          obstaclesMessage = `${obstaclesSaved} obstacle(s) saved successfully.`;
        } else {
          // User doesn't own the trip
          obstaclesMessage = "Obstacle reporting by non-owners: to be implemented.";
        }
      }

      return {
        success: true,
        obstaclesSaved,
        obstaclesMessage,
      };
    }),

  /**
   * Delete a community path
   * Requires ownership of the source trip if applicable
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Find path and check ownership via trip
      const pathResult = await ctx.db
        .select({
          pathId: path.id,
          tripId: path.tripId,
          userId: trip.userId,
        })
        .from(path)
        .leftJoin(trip, eq(path.tripId, trip.id))
        .where(eq(path.id, input.id));

      if (pathResult.length === 0) {
        throw new Error("Path not found");
      }

      const pathData = pathResult[0];

      // Only allow deletion if user owns the trip it came from
      // For paths without trips (standalone manual), we'd need a userId on the path table
      if (pathData.userId && pathData.userId !== ctx.user!.id) {
        throw new Error("Unauthorized: You do not own the trip for this path");
      }

      // 1. Delete path segments
      await ctx.db
        .delete(pathSegment)
        .where(eq(pathSegment.pathId, input.id));

      // 2. Delete the path record itself
      await ctx.db
        .delete(path)
        .where(eq(path.id, input.id));

      return { success: true };
    }),
});
