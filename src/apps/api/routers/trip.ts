import { and, asc, desc, eq, schema } from "@repo/db";
import { z } from "zod";
import { protectedProcedure, router } from "../lib/trpc.js";

const { trip, tripRoute, tripRating, obstacleReport, path, street, pathSegment } = schema;

/**
 * Trip router - handles bike trip recording with ordered routes
 */
export const tripRouter = router({
  /**
   * Create a new trip
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        startTime: z.date(),
        endTime: z.date(),
        collectionMode: z.enum(["manual", "simulated", "osrm"]),
        distance: z.number().optional(), // in meters
        avgSpeed: z.number().optional(), // in km/h
        duration: z.number().optional(), // in seconds
        weatherData: z.any().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Calculate duration in seconds if not provided
      const duration = input.duration ?? Math.floor(
        (input.endTime.getTime() - input.startTime.getTime()) / 1000,
      );

      const [newTrip] = await ctx.db
        .insert(trip)
        .values({
          userId: ctx.user!.id,
          name: input.name,
          startTime: input.startTime,
          endTime: input.endTime,
          duration,
          distance: (input.distance ?? 0).toString(), // Store distance directly if provided
          avgSpeed: input.avgSpeed ? input.avgSpeed.toString() : null,
          collectionMode: input.collectionMode,
          weatherData: input.weatherData,
        })
        .returning();

      return newTrip;
    }),

  /**
   * List all trips for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const trips = await ctx.db
      .select()
      .from(trip)
      .where(eq(trip.userId, ctx.user!.id))
      .orderBy(desc(trip.createdAt));

    return trips;
  }),

  /**
   * Get trip detail with all routes
   */
  detail: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        throw new Error("Trip not found");
      }

      // Get all routes for this trip with street status, ordered by routeIndex
      const routesWithStreets = await ctx.db
        .select()
        .from(tripRoute)
        .leftJoin(street, eq(tripRoute.streetId, street.id))
        .where(eq(tripRoute.tripId, input.tripId))
        .orderBy(asc(tripRoute.routeIndex));

      // Map routes to include currentStatus from joined street
      const routes = routesWithStreets.map((row) => ({
        ...row.trip_route,
        currentStatus: row.street?.currentStatus || null,
      }));

      return {
        trip: tripData,
        routes,
      };
    }),

  /**
   * Add a route to a trip
   */
  addRoute: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        name: z.string().min(1),
        geometry: z.any(), // GeoJSON LineString
        distance: z.number().min(0), // meters
        startLat: z.number(),
        startLon: z.number(),
        endLat: z.number(),
        endLon: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trip belongs to user
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        throw new Error("Trip not found or unauthorized");
      }

      // Get the next routeIndex
      const maxRoute = await ctx.db
        .select({ maxIndex: schema.tripRoute.routeIndex })
        .from(tripRoute)
        .where(eq(tripRoute.tripId, input.tripId));

      const nextIndex = maxRoute.length
        ? Math.max(...maxRoute.map((r) => r.maxIndex || 0)) + 1
        : 0;

      // Try to match the route name to an existing street
      let streetId: string | null = null;
      const matchingStreets = await ctx.db
        .select()
        .from(schema.street)
        .where(eq(schema.street.name, input.name))
        .limit(1);

      if (matchingStreets.length > 0) {
        streetId = matchingStreets[0].id;
      }

      const [newRoute] = await ctx.db
        .insert(tripRoute)
        .values({
          tripId: input.tripId,
          routeIndex: nextIndex,
          name: input.name,
          geometry: input.geometry,
          distance: input.distance.toString(),
          startLat: input.startLat.toString(),
          startLon: input.startLon.toString(),
          endLat: input.endLat.toString(),
          endLon: input.endLon.toString(),
          streetId: streetId,
        })
        .returning();

      return newRoute;
    }),

  /**
   * Remove a route from a trip
   */
  removeRoute: protectedProcedure
    .input(z.object({ tripId: z.string(), routeIndex: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify trip belongs to user
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        throw new Error("Trip not found or unauthorized");
      }

      // Delete the route
      await ctx.db
        .delete(tripRoute)
        .where(
          and(
            eq(tripRoute.tripId, input.tripId),
            eq(tripRoute.routeIndex, input.routeIndex),
          ),
        );

      // Reindex remaining routes
      const remainingRoutes = await ctx.db
        .select()
        .from(tripRoute)
        .where(eq(tripRoute.tripId, input.tripId))
        .orderBy(asc(tripRoute.routeIndex));

      for (let i = 0; i < remainingRoutes.length; i++) {
        if (remainingRoutes[i].routeIndex !== i) {
          await ctx.db
            .update(tripRoute)
            .set({ routeIndex: i })
            .where(eq(tripRoute.id, remainingRoutes[i].id));
        }
      }

      return { success: true };
    }),

  /**
   * Reorder routes in a trip
   */
  reorderRoutes: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        newOrder: z.array(z.number()), // Array of route indices in new order
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trip belongs to user
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        throw new Error("Trip not found or unauthorized");
      }

      // Update routeIndex for each route based on new order
      for (let newIndex = 0; newIndex < input.newOrder.length; newIndex++) {
        const oldIndex = input.newOrder[newIndex];
        const route = await ctx.db
          .select()
          .from(tripRoute)
          .where(
            and(
              eq(tripRoute.tripId, input.tripId),
              eq(tripRoute.routeIndex, oldIndex),
            ),
          );

        if (route.length > 0) {
          await ctx.db
            .update(tripRoute)
            .set({ routeIndex: newIndex })
            .where(eq(tripRoute.id, route[0].id));
        }
      }

      return { success: true };
    }),

  /**
   * Simulate/generate fake routes for a trip
   */
  simulate: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        numRoutes: z.number().min(1).default(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trip belongs to user
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        throw new Error("Trip not found or unauthorized");
      }

      const simulatedRoutes = [];
      const streetNames = [
        "Main Street",
        "Oak Avenue",
        "Elm Street",
        "Maple Drive",
        "Pine Road",
        "Birch Lane",
        "Cedar Boulevard",
        "Spruce Way",
        "Walnut Circle",
        "Ash Court",
      ];

      for (let i = 0; i < input.numRoutes; i++) {
        const startLat = 40.7128 + Math.random() * 0.01;
        const startLon = -74.006 + Math.random() * 0.01;
        const endLat = startLat + Math.random() * 0.005;
        const endLon = startLon + Math.random() * 0.005;

        const geometry = {
          type: "LineString",
          coordinates: [
            [startLon, startLat],
            [endLon, endLat],
          ],
        };

        const distance = Math.random() * 2000 + 100; // 100-2100 meters

        const [newRoute] = await ctx.db
          .insert(tripRoute)
          .values({
            tripId: input.tripId,
            routeIndex: i,
            name: streetNames[i % streetNames.length],
            geometry,
            distance: distance.toString(),
            startLat: startLat.toString(),
            startLon: startLon.toString(),
            endLat: endLat.toString(),
            endLon: endLon.toString(),
          })
          .returning();

        simulatedRoutes.push(newRoute);
      }

      return { routes: simulatedRoutes };
    }),

  /**
   * Delete a trip (and all its routes cascade delete)
   */
  delete: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      console.log(`[TRIP DELETE] Attempting to delete trip: ${input.tripId} for user: ${ctx.user!.id}`);

      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        console.log(`[TRIP DELETE] Unauthorized or not found. Trip found: ${!!tripData}, Owner match: ${tripData?.userId === ctx.user!.id}`);
        throw new Error("Trip not found or unauthorized");
      }

      console.log(`[TRIP DELETE] Deleting trip: ${tripData.name} (${tripData.id})`);

      // First, delete any associated path record
      const pathsToDelete = await ctx.db
        .select()
        .from(path)
        .where(eq(path.tripId, input.tripId));

      if (pathsToDelete.length > 0) {
        console.log(`[TRIP DELETE] Found ${pathsToDelete.length} associated path(s) to delete`);
        for (const pathRecord of pathsToDelete) {
          // Delete path segments for this path
          await ctx.db
            .delete(pathSegment)
            .where(eq(pathSegment.pathId, pathRecord.id));
          console.log(`[TRIP DELETE] Deleted path segments for path: ${pathRecord.id}`);

          // Delete the path
          await ctx.db
            .delete(path)
            .where(eq(path.id, pathRecord.id));
          console.log(`[TRIP DELETE] Deleted path: ${pathRecord.id}`);
        }
      }

      // Delete trip rating
      await ctx.db
        .delete(tripRating)
        .where(eq(tripRating.tripId, input.tripId));
      console.log(`[TRIP DELETE] Deleted rating for trip: ${input.tripId}`);

      // Delete trip routes
      const tripRoutes = await ctx.db
        .select()
        .from(tripRoute)
        .where(eq(tripRoute.tripId, input.tripId));

      if (tripRoutes.length > 0) {
        console.log(`[TRIP DELETE] Found ${tripRoutes.length} trip routes to delete`);
        for (const route of tripRoutes) {
          // Delete path reports associated with this route
          const { pathReport } = schema;
          await ctx.db
            .delete(pathReport)
            .where(eq(pathReport.tripRouteId, route.id));
          console.log(`[TRIP DELETE] Deleted path reports for route: ${route.id}`);

          // Delete obstacles for this route
          await ctx.db
            .delete(obstacleReport)
            .where(eq(obstacleReport.tripRouteId, route.id));
          console.log(`[TRIP DELETE] Deleted obstacles for route: ${route.id}`);

          // Delete the trip route
          await ctx.db
            .delete(tripRoute)
            .where(eq(tripRoute.id, route.id));
          console.log(`[TRIP DELETE] Deleted trip route: ${route.id}`);
        }
      }

      // Finally, delete the trip
      await ctx.db.delete(trip).where(eq(trip.id, input.tripId));
      console.log(`[TRIP DELETE] Delete completed`);

      return { success: true };
    }),

  /**
   * Check if a trip has been published as a path
   */
  isPublished: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify trip belongs to user
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        throw new Error("Trip not found or unauthorized");
      }

      // Check if there's a path published from this trip
      const [publishedPath] = await ctx.db
        .select()
        .from(path)
        .where(eq(path.tripId, input.tripId));

      return {
        isPublished: !!publishedPath,
        pathId: publishedPath?.id || null,
      };
    }),

  /**
   * Update trip distance and avg speed from routes
   * Called after all routes are added to calculate total trip statistics
   */
  updateTripStats: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        distance: z.number().optional(), // in meters
        avgSpeed: z.number().optional(), // in km/h
        duration: z.number().optional(), // in seconds
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trip belongs to user
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        throw new Error("Trip not found or unauthorized");
      }

      // If distance provided, calculate from routes instead
      let distanceToStore = input.distance ?? 0;

      if (!input.distance) {
        // Calculate distance from all routes
        const routes = await ctx.db
          .select({ distance: tripRoute.distance })
          .from(tripRoute)
          .where(eq(tripRoute.tripId, input.tripId));

        distanceToStore = routes.reduce((sum, r) => {
          return sum + parseFloat(r.distance.toString());
        }, 0);
      }

      // Update trip with calculated stats
      const [updatedTrip] = await ctx.db
        .update(trip)
        .set({
          distance: distanceToStore.toString(),
          avgSpeed: input.avgSpeed ? input.avgSpeed.toString() : undefined,
          duration: input.duration ?? undefined,
        })
        .where(eq(trip.id, input.tripId))
        .returning();

      return updatedTrip;
    }),

  /**
   * Add or update trip rating (required before publishing per RASD)
   */
  addRating: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        rating: z.number().int().min(1).max(5), // Per RASD: rating from 1 to 5
        notes: z.string().optional(), // Descriptive notes about route
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trip belongs to user
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        throw new Error("Trip not found or unauthorized");
      }

      // Upsert rating (replace if exists)
      const [rating] = await ctx.db
        .insert(tripRating)
        .values({
          tripId: input.tripId,
          userId: ctx.user!.id,
          rating: input.rating,
          notes: input.notes,
          isPublished: 0,
        })
        .onConflictDoUpdate({
          target: tripRating.tripId,
          set: {
            rating: input.rating,
            notes: input.notes,
            updatedAt: new Date(),
          },
        })
        .returning();

      return rating;
    }),

  /**
   * Get trip rating
   */
  getRating: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [rating] = await ctx.db
        .select()
        .from(tripRating)
        .where(eq(tripRating.tripId, input.tripId));

      return rating || null;
    }),

  /**
   * Add obstacle report to a trip route
   */
  addObstacle: protectedProcedure
    .input(
      z.object({
        tripRouteId: z.string(),
        type: z.string(),
        description: z.string().optional(),
        lat: z.number(),
        lon: z.number(),
        detectionMode: z.enum(["automated", "manual"]),
        sensorData: z.string().optional(),
        status: z
          .enum(["PENDING", "CONFIRMED", "REJECTED", "CORRECTED", "EXPIRED"])
          .default("PENDING"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trip route exists and user owns the trip
      const [route] = await ctx.db
        .select()
        .from(tripRoute)
        .leftJoin(trip, eq(tripRoute.tripId, trip.id))
        .where(eq(tripRoute.id, input.tripRouteId));

      if (!route || route.trip?.userId !== ctx.user!.id) {
        throw new Error("Route not found or unauthorized");
      }

      const [obstacle] = await ctx.db
        .insert(obstacleReport)
        .values({
          tripRouteId: input.tripRouteId,
          userId: ctx.user!.id,
          type: input.type,
          description: input.description,
          lat: input.lat.toString(),
          lon: input.lon.toString(),
          detectionMode: input.detectionMode,
          sensorData: input.sensorData,
          status: input.status,
        })
        .returning();

      return obstacle;
    }),

  /**
   * Get obstacles for a trip
   */
  getObstacles: protectedProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ ctx, input }) => {
      const obstacles = await ctx.db
        .select()
        .from(obstacleReport)
        .leftJoin(tripRoute, eq(obstacleReport.tripRouteId, tripRoute.id))
        .where(eq(tripRoute.tripId, input.tripId));

      return obstacles.map((row) => ({
        ...row.obstacle_report,
        route: row.trip_route,
      }));
    }),

  /**
   * Update obstacle status (confirm/reject/correct per RASD lifecycle)
   */
  updateObstacleStatus: protectedProcedure
    .input(
      z.object({
        obstacleId: z.string(),
        status: z.enum([
          "PENDING",
          "CONFIRMED",
          "REJECTED",
          "CORRECTED",
          "EXPIRED",
        ]),
        description: z.string().optional(),
        lat: z.number().optional(),
        lon: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the obstacle
      const [obstacle] = await ctx.db
        .select()
        .from(obstacleReport)
        .where(eq(obstacleReport.id, input.obstacleId));

      if (!obstacle || obstacle.userId !== ctx.user!.id) {
        throw new Error("Obstacle not found or unauthorized");
      }

      const updateData: any = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.status === "CONFIRMED") {
        updateData.confirmedAt = new Date();
      }

      if (input.status === "CORRECTED") {
        if (input.description) updateData.description = input.description;
        if (input.lat) updateData.lat = input.lat.toString();
        if (input.lon) updateData.lon = input.lon.toString();
        updateData.confirmedAt = new Date();
      }

      const [updated] = await ctx.db
        .update(obstacleReport)
        .set(updateData)
        .where(eq(obstacleReport.id, input.obstacleId))
        .returning();

      return updated;
    }),

  /**
   * Publish trip as a path (per RASD: after rating and obstacle confirmation)
   * This converts a private trip into a public community path.
   * Creates streets, pathSegments, and computes geometry from trip routes.
   */
  publish: protectedProcedure
    .input(
      z.object({
        tripId: z.string(),
        pathName: z.string().min(1),
        pathDescription: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify trip belongs to user
      const [tripData] = await ctx.db
        .select()
        .from(trip)
        .where(eq(trip.id, input.tripId));

      if (!tripData || tripData.userId !== ctx.user!.id) {
        throw new Error("Trip not found or unauthorized");
      }

      // Check if already published
      if (tripData.isPublished === 1) {
        throw new Error("Trip already published");
      }

      // Get trip rating (required per RASD)
      const [rating] = await ctx.db
        .select()
        .from(tripRating)
        .where(eq(tripRating.tripId, input.tripId));

      if (!rating) {
        throw new Error("Rating required before publishing (RASD requirement)");
      }

      // Get all routes ordered by index
      const routes = await ctx.db
        .select()
        .from(tripRoute)
        .where(eq(tripRoute.tripId, input.tripId))
        .orderBy(asc(tripRoute.routeIndex));

      if (routes.length === 0) {
        throw new Error("Trip must have at least one route to publish");
      }

      // Compute combined geometry from trip routes
      let combinedCoordinates: [number, number][] = [];
      for (const route of routes) {
        const geometry = route.geometry as any;
        if (
          geometry &&
          geometry.type === "LineString" &&
          Array.isArray(geometry.coordinates) &&
          geometry.coordinates.length > 0
        ) {
          if (combinedCoordinates.length === 0) {
            combinedCoordinates = [...geometry.coordinates];
          } else {
            combinedCoordinates.push(...geometry.coordinates.slice(1));
          }
        }
      }

      const pathGeometry =
        combinedCoordinates.length >= 2
          ? { type: "LineString" as const, coordinates: combinedCoordinates }
          : null;

      if (!pathGeometry) {
        throw new Error("Could not create path geometry from trip routes");
      }

      // Create the path
      const [newPath] = await ctx.db
        .insert(path)
        .values({
          name: input.pathName,
          description: input.pathDescription,
          tripId: input.tripId,
          geometry: pathGeometry,
          currentStatus: "optimal",
          score: rating.rating.toString(),
          scoreCalculatedAt: new Date(),
        })
        .returning();

      // Create or link streets and pathSegments for each trip route
      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        let streetId = route.streetId;

        // If route doesn't have a streetId, create or find street by name
        if (!streetId && route.name) {
          const [existingStreet] = await ctx.db
            .select()
            .from(street)
            .where(eq(street.name, route.name))
            .limit(1);

          if (existingStreet) {
            streetId = existingStreet.id;
          } else {
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
              })
              .returning();
            streetId = newStreet.id;
          }
        }

        if (streetId) {
          // Create pathSegment linking path to street
          await ctx.db
            .insert(pathSegment)
            .values({
              pathId: newPath.id,
              streetId,
              orderIndex: i,
            });

          // Link the trip route to the street if not already linked
          if (!route.streetId) {
            await ctx.db
              .update(tripRoute)
              .set({ streetId })
              .where(eq(tripRoute.id, route.id));
          }
        }
      }

      // Mark trip as published
      await ctx.db
        .update(trip)
        .set({
          isPublished: 1,
          publishedPathId: newPath.id,
          updatedAt: new Date(),
        })
        .where(eq(trip.id, input.tripId));

      // Mark rating as published
      await ctx.db
        .update(tripRating)
        .set({
          isPublished: 1,
          updatedAt: new Date(),
        })
        .where(eq(tripRating.tripId, input.tripId));

      return {
        path: newPath,
        message: "Trip published successfully as a community path",
      };
    }),
});
