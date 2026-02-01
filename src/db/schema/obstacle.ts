/**
 * Database schema for obstacle reports.
 * According to RASD: ObstacleReport lifecycle with states:
 * PENDING → CONFIRMED | REJECTED | CORRECTED | EXPIRED
 *
 * SPDX-FileCopyrightText: 2025-present Best Bike Paths Team
 * SPDX-License-Identifier: MIT
 */

import {
  decimal,
  pgTable,
  relations,
  sql,
  text,
  timestamp,
} from "@repo/db/drizzle";
import { tripRoute } from "./trip-route";
import { user } from "./user";

/**
 * Obstacle report status lifecycle
 * - PENDING: Initially detected, awaiting user confirmation
 * - CONFIRMED: User confirmed the obstacle exists
 * - REJECTED: User rejected as false positive
 * - CORRECTED: User modified the obstacle details
 * - EXPIRED: Report not validated within time limit
 */
export type ObstacleStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CORRECTED"
  | "EXPIRED";

/**
 * Obstacle reports table.
 * Stores detected or manually-reported obstacles along bike paths.
 */
export const obstacleReport = pgTable("obstacle_report", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Link to trip route where obstacle was detected
  tripRouteId: text("trip_route_id")
    .notNull()
    .references(() => tripRoute.id, { onDelete: "cascade" }),

  // User who reported (for manual) or confirmed (for automated)
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Report status lifecycle
  status: text("status").$type<ObstacleStatus>().notNull().default("PENDING"),

  // Obstacle details
  type: text("type").notNull(), // e.g., "pothole", "debris", "construction"
  description: text("description"), // User notes

  // Location within the route
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lon: decimal("lon", { precision: 10, scale: 7 }).notNull(),

  // Detection mode
  detectionMode: text("detection_mode")
    .notNull()
    .$type<"automated" | "manual">(),

  // For automated detection: sensor data
  sensorData: text("sensor_data"), // JSON string of accelerometer readings

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────────────────────

export const obstacleReportRelations = relations(obstacleReport, ({ one }) => ({
  tripRoute: one(tripRoute, {
    fields: [obstacleReport.tripRouteId],
    references: [tripRoute.id],
  }),
  user: one(user, {
    fields: [obstacleReport.userId],
    references: [user.id],
  }),
}));
