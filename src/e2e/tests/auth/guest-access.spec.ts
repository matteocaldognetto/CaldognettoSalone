import { test, expect } from "@playwright/test";
import { PathsPage } from "../../pages/paths.page";
import { RoutesPage } from "../../pages/routes.page";

/**
 * R3: Guest Access Tests
 *
 * Tests cover:
 * - Public page accessibility
 * - Protected route redirection
 * - Guest CTA display
 */
test.describe("R3: Guest Access", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // Clear auth state

  test("R3: should allow guests to view paths page", async ({ page }) => {
    const pathsPage = new PathsPage(page);
    await pathsPage.goto();

    // Should be able to view the page
    await expect(page).toHaveURL("/paths");
    await pathsPage.expectPageTitle();
  });

  test("R3: should show CTA banner for guests on paths page when paths exist", async ({
    page,
  }) => {
    const pathsPage = new PathsPage(page);
    await pathsPage.goto();

    // Wait for loading to complete
    await page.waitForLoadState("networkidle");

    // CTA only shows when paths exist in database
    const hasPaths = await page.locator(".leaflet-container").isVisible().catch(() => false);

    if (hasPaths) {
      // Should show CTA for guests when paths exist
      await pathsPage.expectGuestCTA();
    } else {
      // If no paths, empty state is shown instead of CTA
      await expect(page.getByText(/No paths yet/i)).toBeVisible();
    }
  });

  test("R3: should allow guests to view routes page", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    // Should be able to view the page
    await expect(page).toHaveURL("/routes");
  });

  test("R3: should redirect guests from trips page to login", async ({
    page,
  }) => {
    await page.goto("/trips");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login.*redirect.*trips/);
  });

  test("R3: should redirect guests from trip-record page to login", async ({
    page,
  }) => {
    await page.goto("/trip-record");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login.*redirect.*trip-record/);
  });

  test("R3: settings page accessible to guests (no redirect)", async ({
    page,
  }) => {
    // Note: Settings page is accessible to guests in current implementation
    await page.goto("/settings");

    // Should stay on settings page
    await expect(page).toHaveURL(/\/settings/);
  });

  test("R3: should redirect guests from report page to login", async ({
    page,
  }) => {
    await page.goto("/report");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login.*redirect.*report/);
  });

  test("R3: clicking Sign In from guest CTA should redirect to login", async ({
    page,
  }) => {
    const pathsPage = new PathsPage(page);
    await pathsPage.goto();
    await page.waitForLoadState("networkidle");

    const ctaVisible = await pathsPage.guestCTA.isVisible().catch(() => false);

    if (ctaVisible) {
      await pathsPage.clickSignIn();
      await expect(page).toHaveURL(/\/login/);
    } else {
      const headerSignIn = page.getByRole("banner").getByRole("button", { name: /Sign In/i });
      const emptyStateSignIn = page.locator(".max-w-md").getByRole("button", { name: /Sign In/i });

      if (await headerSignIn.isVisible().catch(() => false)) {
        await headerSignIn.click();
      } else if (await emptyStateSignIn.isVisible().catch(() => false)) {
        await emptyStateSignIn.click();
      }
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("R3: guests should be able to search routes without authentication", async ({
    page,
  }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    await routesPage.expectMapLoaded();

    await expect(routesPage.startStreetInput).toBeVisible();
    await expect(routesPage.endStreetInput).toBeVisible();
  });

  test("R3: guests should see info box on routes page", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.goto();

    await routesPage.expectInfoBox();
  });
});