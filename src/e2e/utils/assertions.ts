import { expect, Page, Locator } from "@playwright/test";

/**
 * Custom Assertions for E2E Tests
 *
 * Provides reusable assertion helpers that encapsulate common verification patterns.
 */

/**
 * Asserts that the page displays a toast/alert with the expected message
 */
export async function expectToastMessage(
  page: Page,
  expectedMessage: string | RegExp,
): Promise<void> {
  // The app uses window.alert for notifications
  const dialogPromise = page.waitForEvent("dialog", { timeout: 5000 });
  const dialog = await dialogPromise;

  if (typeof expectedMessage === "string") {
    expect(dialog.message()).toContain(expectedMessage);
  } else {
    expect(dialog.message()).toMatch(expectedMessage);
  }

  await dialog.accept();
}

/**
 * Asserts that a form field shows a validation error
 */
export async function expectFieldError(
  field: Locator,
  errorMessage?: string,
): Promise<void> {
  // Check if field is invalid
  await expect(field).toHaveAttribute("aria-invalid", "true");

  if (errorMessage) {
    // Look for error message near the field
    const errorElement = field
      .locator("..")
      .locator("text=" + errorMessage)
      .first();
    await expect(errorElement).toBeVisible();
  }
}

/**
 * Asserts that a loading spinner is displayed and then disappears
 */
export async function expectLoadingComplete(
  page: Page,
  timeout = 15000,
): Promise<void> {
  const spinner = page.locator(".animate-spin");

  // Wait for loading to start (if it does)
  try {
    await spinner.waitFor({ state: "visible", timeout: 1000 });
  } catch {
    // Loading may have completed before we checked
    return;
  }

  // Wait for loading to complete
  await spinner.waitFor({ state: "hidden", timeout });
}

/**
 * Asserts that the user is on an authenticated page
 */
export async function expectAuthenticated(page: Page): Promise<void> {
  // Should not be on login page
  await expect(page).not.toHaveURL(/\/login/);

  // Should have some authenticated content
  // Look for common authenticated elements like settings link or user menu
  const authIndicator = page
    .locator('[href="/settings"], [data-testid="user-menu"]')
    .first();
  await expect(authIndicator).toBeVisible({ timeout: 5000 });
}

/**
 * Asserts that the user is redirected to login
 */
export async function expectRedirectToLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
}

/**
 * Asserts that a map is loaded and visible
 */
export async function expectMapLoaded(page: Page): Promise<void> {
  const mapContainer = page.locator(".leaflet-container");
  await expect(mapContainer).toBeVisible();

  // Wait for at least one tile to load
  await page.waitForFunction(
    () => document.querySelectorAll(".leaflet-tile-loaded").length > 0,
    { timeout: 10000 },
  );
}

/**
 * Asserts that a path/route is displayed on the map
 */
export async function expectPathOnMap(page: Page): Promise<void> {
  await expectMapLoaded(page);

  // Look for path geometry (polyline)
  const pathElement = page.locator(".leaflet-interactive");
  await expect(pathElement.first()).toBeVisible({ timeout: 5000 });
}

/**
 * Asserts that an obstacle marker is displayed on the map
 */
export async function expectObstacleMarkerOnMap(page: Page): Promise<void> {
  await expectMapLoaded(page);

  // Look for marker icon
  const marker = page.locator(".leaflet-marker-icon");
  await expect(marker.first()).toBeVisible({ timeout: 5000 });
}

/**
 * Asserts that a trip card is displayed with expected data
 */
export async function expectTripCard(
  page: Page,
  tripName: string,
): Promise<Locator> {
  const tripCard = page.locator(`text=${tripName}`).locator("..");
  await expect(tripCard).toBeVisible();
  return tripCard;
}

/**
 * Asserts that statistics are displayed with valid values
 */
export async function expectValidStatistics(page: Page): Promise<void> {
  // Check for distance
  const distanceText = page.locator("text=/\\d+(\\.\\d+)?\\s*(km|m)/i").first();
  await expect(distanceText).toBeVisible();

  // Check for duration
  const durationText = page.locator("text=/\\d+\\s*(min|h|hr)/i").first();
  await expect(durationText).toBeVisible();
}
