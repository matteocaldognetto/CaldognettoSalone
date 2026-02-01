/**
 * Database schema for streets and path segments.
 * Streets are the building blocks of bike paths.
 * Geometry is stored as GeoJSON (JSONB) for simplicity.
 *
 * SPDX-FileCopyrightText: 2025-present Best Bike Paths Team
 * SPDX-License-Identifier: MIT
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  relations,
  sql,
  text,
  timestamp,
  uniqueIndex,
} from "@repo/db/drizzle";
import { path } from "./path";

/**
 * Street status enum values (same as path status, per RASD)
 * - optimal: Street is in excellent condition
 * - medium: Street is usable but not perfect
 * - sufficient: Street is barely acceptable
 * - requires_maintenance: Street needs repair/maintenance
 */
export type StreetStatus =
  | "optimal"
  | "medium"
  | "sufficient"
  | "requires_maintenance";

/**
 * Streets table - represents cyclable roads.
 * A street is identified by name and has its own geometry and status.
 */
export const street = pgTable("street", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Street identification
  name: text("name").notNull(),

  // Geographic data (GeoJSON LineString)
  geometry: jsonb("geometry").notNull(),

  // Whether this street is considered cyclable
  isCyclable: boolean("is_cyclable").notNull().default(true),

  // Speed limit in km/h (optional)
  speedLimit: integer("speed_limit"),

  // Aggregated status from reports
  currentStatus: text("current_status").$type<StreetStatus>(),

  // Location metadata
  city: text("city"),
  district: text("district"),

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
 * Path segments table - represents the many-to-many relationship between paths and streets.
 * Maintains the order of streets within a path.
 */
export const pathSegment = pgTable(
  "path_segment",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Foreign keys
    pathId: text("path_id")
      .notNull()
      .references(() => path.id, { onDelete: "cascade" }),

    streetId: text("street_id")
      .notNull()
      .references(() => street.id, { onDelete: "cascade" }),

    // Order index to maintain street sequence in path
    orderIndex: integer("order_index").notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniquePathOrderIndex: uniqueIndex(
      "idx_path_segment_unique"
    ).on(table.pathId, table.orderIndex),
    pathIdIdx: index("idx_path_segment_path_id").on(table.pathId),
    streetIdIdx: index("idx_path_segment_street_id").on(table.streetId),
  })
);

// —————————————————————————————————————————————————————————————————————————————
// Relations
// —————————————————————————————————————————————————————————————————————————————

export const streetRelations = relations(street, ({ many }) => ({
  pathSegments: many(pathSegment),
}));

export const pathSegmentRelations = relations(pathSegment, ({ one }) => ({
  path: one(path, {
    fields: [pathSegment.pathId],
    references: [path.id],
  }),
  street: one(street, {
    fields: [pathSegment.streetId],
    references: [street.id],
  }),
}));
