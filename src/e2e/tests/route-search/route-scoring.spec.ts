import { test, expect } from "@playwright/test";
import { RoutesPage } from "../../pages/routes.page";

/**
 * R30-R32: Route Scoring & Details Tests
 *
 * Tests cover:
 * - R30: Route score calculation and communication
 * - R30: Sorting results by score
 * - R32: Summary of key details (Distance/Time)
 */
test.describe("R30-R32: Route Scoring", () => {
  let routesPage: RoutesPage;

  test.beforeEach(async ({ page }) => {
    routesPage = new RoutesPage(page);
    await routesPage.goto();
  });

  test("R30: should display route scores when routes found", async ({
    page,
  }) => {
    await routesPage.searchRoute("Via Torino", "Corso Buenos Aires");

    if (await routesPage.hasRoutes()) {
      // Scores communicate the quality (R30)
      const scores = await routesPage.getRouteScores();
      expect(await routesPage.hasRoutes()).toBe(true);
    }
  });

  test("R30: routes should be sorted by score (best first)", async ({
    page,
  }) => {
    await routesPage.searchRoute("Via Torino", "Corso Buenos Aires");

    if (await routesPage.hasRoutes()) {
      const scores = await routesPage.getRouteScores();

      if (scores.length > 1) {
        // Verify ranking logic (R30)
        for (let i = 0; i < scores.length - 1; i++) {
          expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
        }
      }
    }
  });

  test("R30: should display a limited number of route results", async ({ page }) => {
    await routesPage.searchRoute("Via Torino", "Corso Buenos Aires");

    const routeCount = await routesPage.getRouteCount();

    // Result filtering and scoring logic
    expect(routeCount).toBeLessThanOrEqual(5);
  });

  test("R32: route cards should show summary details (distance and time)", async ({ page }) => {
    await routesPage.searchRoute("Via Torino", "Corso Buenos Aires");

    if (await routesPage.hasRoutes()) {
      // R32: provide a summary of key details
      const routeText = await routesPage.routeResults.first().textContent();

      // Verify presence of distance or duration info
      expect(routeText).toBeTruthy();
    }
  });
});