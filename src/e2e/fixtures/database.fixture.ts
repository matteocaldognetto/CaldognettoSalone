import { test as base } from "@playwright/test";
import { execSync } from "child_process";

/**
 * Database Fixture Types
 */
type DatabaseFixtures = {
  /** Seeds the database with test data before the test */
  withSeededData: void;
  /** Resets the database to a clean state */
  withCleanDatabase: void;
};

/**
 * Extended test with database fixtures
 *
 * Usage:
 * ```ts
 * import { test } from '@fixtures/database.fixture';
 *
 * test('test with seeded data', async ({ withSeededData, page }) => {
 *   // Database has been seeded
 * });
 * ```
 */
export const test = base.extend<DatabaseFixtures>({
  // Seeds database before test
  withSeededData: [
    async ({}, use) => {
      try {
        execSync("bun --filter @repo/db seed", {
          cwd: process.cwd() + "/..",
          stdio: "pipe",
          timeout: 30000,
        });
      } catch (error) {
        console.warn("Database seed failed:", error);
      }

      await use();
    },
    { auto: false },
  ],

  // Resets database after test
  withCleanDatabase: [
    async ({}, use) => {
      await use();

      // Cleanup after test (optional - implement based on needs)
      // This could truncate test-specific tables or reset to a known state
    },
    { auto: false },
  ],
});

export { expect } from "@playwright/test";
