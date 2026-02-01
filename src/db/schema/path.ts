/**
 * Database schema for bike path information and crowd-sourced reports.
 * Handles both manual and automated path data collection.
 *
 * SPDX-FileCopyrightText: 2025-present Best Bike Paths Team
 * SPDX-License-Identifier: MIT
 */

import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  relations,
  sql,
  text,
  timestamp,
  varchar,
} from "@repo/db/drizzle";
import { user } from "./user";
import { trip } from "./trip";
import { tripRoute } from "./trip-route";
import { pathSegment } from "./street";

/**
 * Path status enum values:
 * - optimal: Path is in excellent condition
 * - medium: Path is usable but not perfect
 * - sufficient: Path is barely acceptable
 * - requires_maintenance: Path needs repair
 */
export type PathStatus =
  | "optimal"
  | "medium"
  | "sufficient"
  | "requires_maintenance";

/**
 * Bike paths table.
 * A path is composed of one or more streets in sequence.
 */
export const path = pgTable("path", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Path identification
  name: text("name").notNull(),
  description: text("description"),

  // Source trip (if published from a trip)
  tripId: text("trip_id")
    .references(() => trip.id, { onDelete: "set null" }),

  // Geographic data (GeoJSON format with LineString)
  // Can be reconstructed from the streets that compose it
  geometry: jsonb("geometry"),

  // Aggregated status (computed as average of street statuses)
  currentStatus: text("current_status").$type<PathStatus>(),

  // Path score - private, used for ranking paths
  // Not exposed to users
  score: decimal("score", { precision: 5, scale: 2 }), // 0-100 score for ranking
  scoreCalculatedAt: timestamp("score_calculated_at", {
    withTimezone: true,
    mode: "date",
  }),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * Path reports table.
 * Crowdsourced condition reports on individual routes (trip_route).
 * Each report is associated with a single route (street segment) and provides a status assessment.
 */
export const pathReport = pgTable("path_report", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  tripRouteId: text("trip_route_id")
    .references(() => tripRoute.id, { onDelete: "cascade" }),

  // For standalone street reports (when tripRouteId is null)
  streetName: text("street_name"), // Street name for standalone reports
  lat: decimal("lat", { precision: 10, scale: 7 }), // Latitude for standalone reports
  lon: decimal("lon", { precision: 10, scale: 7 }), // Longitude for standalone reports

  // Report status
  status: text("status").$type<PathStatus>().notNull(),
  isPublishable: boolean("is_publishable").notNull().default(false),
  // User rating (1-5 stars)
  rating: integer("rating"), // Optional: user can rate the path

  // Data collection mode
  collectionMode: text("collection_mode")
    .notNull()
    .$type<"manual" | "automated">(),

  // For automated mode: sensor data
  sensorData: jsonb("sensor_data"), // accelerometer/gyroscope data

  // Obstacles detected (e.g., potholes)
  obstacles: jsonb("obstacles"), // Array of obstacle objects with location and type

  // User confirmation status (for automated reports)
  isConfirmed: boolean("is_confirmed").default(false),

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

export const pathRelations = relations(path, ({ many }) => ({
  reports: many(pathReport),
  pathSegments: many(pathSegment),
}));

export const pathReportRelations = relations(pathReport, ({ one }) => ({
  user: one(user, {
    fields: [pathReport.userId],
    references: [user.id],
  }),
  tripRoute: one(tripRoute, {
    fields: [pathReport.tripRouteId],
    references: [tripRoute.id],
  }),
}));
