/**
 * Database schema for trip recording and tracking.
 * Users can record their bike trips with statistics and weather data.
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
} from "@repo/db/drizzle";
import { user } from "./user";

/**
 * Trip records table.
 * Stores information about user bike trips including statistics and route data.
 */
export const trip = pgTable("trip", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Trip metadata
  name: text("name"),
  startTime: timestamp("start_time", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  endTime: timestamp("end_time", {
    withTimezone: true,
    mode: "date",
  }).notNull(),

  // Statistics
  distance: decimal("distance", { precision: 10, scale: 2 }).notNull(), // in meters
  avgSpeed: decimal("avg_speed", { precision: 10, scale: 2 }), // in km/h
  maxSpeed: decimal("max_speed", { precision: 10, scale: 2 }), // in km/h
  duration: integer("duration").notNull(), // in seconds

  // Route data (GeoJSON format)
  route: jsonb("route"),

  // Weather data (from external service)
  weatherData: jsonb("weather_data"),

  // Collection mode: how the trip was recorded
  collectionMode: text("collection_mode")
    .notNull()
    .$type<"manual" | "simulated" | "osrm">(),

  // Publication status - tracks if trip has been published as a path
  isPublished: integer("is_published").notNull().default(0), // 0 = false, 1 = true (boolean)
  publishedPathId: text("published_path_id"), // Reference to published path if exists

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// —————————————————————————————————————————————————————————————————————————————
// Relations
// —————————————————————————————————————————————————————————————————————————————

export const tripRelations = relations(trip, ({ one, many }) => ({
  user: one(user, {
    fields: [trip.userId],
    references: [user.id],
  }),
}));
