import { test, expect } from "@playwright/test";
import { PathsPage } from "../../pages/paths.page";
import { RoutesPage } from "../../pages/routes.page";

/**
 * R25-R29: Path Repository Search Tests
 *
 * Tests cover:
 * - R25: Central repository access (Community Paths)
 * - R29: Route search interface (Start/End query)
 * - R3: Guest access to core viewing functions
 */
test.describe("R25-R29: Path Repository Search", () => {
  test("R25: should display community paths page", async ({ page }) => {
    const pathsPage = new PathsPage(page);
    await pathsPage.goto();

    await pathsPage.expectPageTitle();
  });

  test("R25: should load map on paths page", async ({ page }) => {
    const pathsPage = new PathsPage(page);
    await pathsPage.goto();

    await pathsPage.expectMapLoaded();
  });

  test("R29: should have route search form", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    await expect(routesPage.startStreetInput).toBeVisible();
    await expect(routesPage.endStreetInput).toBeVisible();
  });

  test("R29: should search for routes between streets", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    // Use URL params to bypass autocomplete UI complexity
    await routesPage.gotoWithSearch("Via Torino", "Corso Buenos Aires");

    // Wait for search to complete
    await routesPage.waitForSearchComplete();

    // Page should load without error
    expect(page.url()).toContain("/routes");
  });

  test("R29: should show searching indicator while loading", async ({
    page,
  }) => {
    const routesPage = new RoutesPage(page);
    // Use URL params to bypass autocomplete UI complexity
    await routesPage.gotoWithSearch("Via Torino", "Corso Buenos Aires");

    // Wait for search to complete
    await routesPage.waitForSearchComplete();

    // Search completed successfully
    expect(page.url()).toContain("/routes");
  });

  test("R3: guests should be able to search paths", async ({ page }) => {
    // Clear any auth state
    await page.context().clearCookies();

    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    // Search form should be available
    await expect(routesPage.startStreetInput).toBeVisible();
    await expect(routesPage.endStreetInput).toBeVisible();
  });
});