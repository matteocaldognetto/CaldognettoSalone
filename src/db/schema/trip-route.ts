/**
 * Database schema for trip routes.
 * Junction table that maintains ordered relationship between trips and routes.
 * Each route is a street segment with geometry and metadata.
 *
 * SPDX-FileCopyrightText: 2025-present Best Bike Paths Team
 * SPDX-License-Identifier: MIT
 */

import {
  decimal,
  integer,
  jsonb,
  pgTable,
  relations,
  sql,
  text,
  timestamp,
  uniqueIndex,
} from "@repo/db/drizzle";
import { trip } from "./trip";
import { street } from "./street";

/**
 * Trip Route table (junction table).
 * Maintains ordered relationship between trips and individual route segments.
 * Each route represents a street segment with its own geometry and metadata.
 */
export const tripRoute = pgTable(
  "trip_route",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Foreign key to trip
    tripId: text("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),

    // Foreign key to street (optional - for linking routes to streets)
    // This represents the street that this trip route corresponds to
    streetId: text("street_id")
      .references(() => street.id, { onDelete: "set null" }),

    // Order of this route within the trip (0-based)
    routeIndex: integer("route_index").notNull(),

    // Route identification
    name: text("name").notNull(), // Street name from OSRM/Nominatim

    // Geographic data (GeoJSON LineString format)
    geometry: jsonb("geometry").notNull(), // GeoJSON LineString

    // Route statistics
    distance: decimal("distance", { precision: 10, scale: 2 }).notNull(), // in meters
    startLat: decimal("start_lat", { precision: 10, scale: 6 }).notNull(),
    startLon: decimal("start_lon", { precision: 10, scale: 6 }).notNull(),
    endLat: decimal("end_lat", { precision: 10, scale: 6 }).notNull(),
    endLon: decimal("end_lon", { precision: 10, scale: 6 }).notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Ensure each trip has unique route indices (maintains ordering)
    tripRouteUnique: uniqueIndex().on(table.tripId, table.routeIndex),
  })
);

// —————————————————————————————————————————————————————————————————————————————
// Relations
// —————————————————————————————————————————————————————————————————————————————

export const tripRouteRelations = relations(tripRoute, ({ one, many }) => ({
  trip: one(trip, {
    fields: [tripRoute.tripId],
    references: [trip.id],
  }),
  street: one(street, {
    fields: [tripRoute.streetId],
    references: [street.id],
  }),
}));
