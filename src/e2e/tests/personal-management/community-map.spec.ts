import { expect, test } from "@playwright/test";
import { TripsPage } from "../../pages/trips.page";

/**
 * R25: Community Map Tests
 *
 * Tests cover:
 * - R25: Viewing community map repository
 * - R3: Guest access to viewing functions
 * - R31: Map UI interaction
 */
test.describe("R25: Community Map", () => {
  test.setTimeout(60000);
  test.use({ storageState: ".auth/user.json" });

  let tripsPage: TripsPage;

  test.beforeEach(async ({ page }) => {
    tripsPage = new TripsPage(page);
  });

  test("R25: should display community map on paths page", async ({ page }) => {
    // Navigate to paths page
    await page.goto("/paths");
    await expect(page).toHaveURL("/paths");

    // Map container should be visible
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });

  test("R25: should display community map on routes page", async ({ page }) => {
    // Navigate to routes page
    await page.goto("/routes");
    await expect(page).toHaveURL("/routes");

    // Map container should be visible
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });

  test("R3: guests can view community map", async ({ browser }) => {
    // R3: guests can use core viewing functions
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("/paths");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await context.close();
  });

  test("R25: should show Discover Bike Paths title", async ({ page }) => {
    await page.goto("/paths");
    await expect(
      page.getByRole("heading", { name: "Discover Bike Paths" }),
    ).toBeVisible();
  });

  test("R3: should prompt guests to sign in for contributions", async ({
    browser,
  }) => {
    // R3: CTA banner visibility for unauthenticated users
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("/paths");
    await expect(
      page.getByText("Want to contribute path reports and track your trips?"),
    ).toBeVisible();

    await context.close();
  });

  test("R31: map should be interactive", async ({ page }) => {
    // R31: UI responsiveness and visualization
    await page.goto("/paths");
    const map = page.locator(".leaflet-container");
    await expect(map).toBeVisible();

    await map.hover();
    await map.click();
  });

  test("R2: authenticated users see map without guest CTA", async ({
    page,
  }) => {
    // R2: Authenticated state logic
    await page.goto("/paths");
    await expect(
      page.getByText("Want to contribute path reports and track your trips?"),
    ).not.toBeVisible();
  });
});