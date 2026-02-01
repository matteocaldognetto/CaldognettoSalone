/**
 * Database schema for trip ratings and reviews.
 * According to RASD: User can provide rating 1-5 and descriptive notes.
 *
 * SPDX-FileCopyrightText: 2025-present Best Bike Paths Team
 * SPDX-License-Identifier: MIT
 */

import {
  integer,
  pgTable,
  relations,
  sql,
  text,
  timestamp,
  uniqueIndex,
} from "@repo/db/drizzle";
import { trip } from "./trip";
import { user } from "./user";

/**
 * Trip ratings table.
 * One rating per trip by the trip owner.
 * Rating is required before publishing a trip as a path.
 */
export const tripRating = pgTable(
  "trip_rating",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Link to trip
    tripId: text("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),

    // User who rated (should match trip owner)
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Rating from 1 to 5 (per RASD requirement)
    rating: integer("rating").notNull(), // 1-5

    // Descriptive notes about route specifics (optional per RASD)
    notes: text("notes"),

    // Whether this rating has been used in published path score
    isPublished: integer("is_published").notNull().default(0), // 0 = false, 1 = true (boolean)

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    // One rating per trip
    uniqueTripRating: uniqueIndex("idx_trip_rating_unique").on(table.tripId),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────────────────────

export const tripRatingRelations = relations(tripRating, ({ one }) => ({
  trip: one(trip, {
    fields: [tripRating.tripId],
    references: [trip.id],
  }),
  user: one(user, {
    fields: [tripRating.userId],
    references: [user.id],
  }),
}));
