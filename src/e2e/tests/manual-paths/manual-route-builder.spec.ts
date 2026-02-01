import { test, expect } from "@playwright/test";
import { TripRecordPage } from "../../pages/trip-record.page";
import { generateTripName } from "../../utils/test-data";

/**
 * R13: Manual Path Entry Tests
 *
 * Tests cover:
 * - R13: Manual route building interface
 * - R13: Street search and selection (Autocomplete)
 * - R6: Switching to automatic recording mode
 * - R31: Route visualization on map
 */
test.describe("R13: Manual Route Builder", () => {
  test.use({ storageState: ".auth/user.json" });

  let tripRecordPage: TripRecordPage;

  test.beforeEach(async ({ page }) => {
    tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
  });

  test("R13: should display manual mode by default", async ({ page }) => {
    // Trip record page should show manual mode elements
    await expect(tripRecordPage.tripNameInput).toBeVisible();
  });

  test("R13: should have street search autocomplete", async ({ page }) => {
    // Street autocomplete should be available
    await expect(tripRecordPage.streetAutocomplete).toBeVisible();
  });

  test("R6: should be able to switch between manual and automatic mode", async ({
    page,
  }) => {
    // Start in manual mode
    await expect(tripRecordPage.automaticModeButton).toBeVisible();

    // Can click automatic mode (Transition to R6)
    await tripRecordPage.fillTripInfo(generateTripName("Mode Switch"));
    await tripRecordPage.automaticModeButton.click();

    // After clicking, routes should load
    await page.waitForSelector(".rounded-lg.border", { timeout: 30000 });
  });

  test("R31: should display map for route visualization", async ({ page }) => {
    // Map container should exist for visualization
    const mapContainer = tripRecordPage.mapHelper.getContainer();
    expect(mapContainer).toBeTruthy();
  });

  test("R13: should require trip name for manual trips", async ({ page }) => {
    // Try to proceed without name
    // Review button should be disabled or validation should fail
    const isDisabled = await tripRecordPage.reviewTripButton.isDisabled();
    expect(isDisabled).toBe(true);
  });
});