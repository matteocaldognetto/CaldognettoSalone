import { test, expect } from "@playwright/test";
import { TripRecordPage } from "../../pages/trip-record.page";
import { generateTripName } from "../../utils/test-data";

/**
 * R8-R9: Trip Statistics Tests
 *
 * Tests cover:
 * - R8: Automatically compute summary statistics (Distance, Duration, Speed)
 * - R9: Show summary of the ride
 */
test.describe("R8-R9: Trip Statistics", () => {
  test.setTimeout(180000); // OSRM + Overpass calls can be slow (3 minutes)
  test.use({ storageState: ".auth/user.json" });

  let tripRecordPage: TripRecordPage;

  test.beforeEach(async ({ page }) => {
    tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
  });

  test("R8: should calculate total distance from routes", async ({ page }) => {
    await tripRecordPage.fillTripInfo(generateTripName("Distance Calc"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();

    // Distance should be displayed (R9)
    await expect(page.getByText(/Distance/i)).toBeVisible();
    // Check for distance units (km or m)
    const distanceText = await page.getByText(/\d+(\.\d+)?\s*(km|m)/).first().textContent();
    expect(distanceText).toBeTruthy();
  });

  test("R8: should track trip duration", async ({ page }) => {
    await tripRecordPage.fillTripInfo(generateTripName("Duration Track"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(3);
    await tripRecordPage.reviewTrip();

    // Duration should be displayed (R9)
    await expect(page.getByText(/Duration/i)).toBeVisible();
  });

  test("R8: should calculate average speed", async ({ page }) => {
    await tripRecordPage.fillTripInfo(generateTripName("Speed Calc"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();

    // Average speed should be displayed (R9)
    await expect(page.getByText(/Average Speed|Avg Speed/i)).toBeVisible();
  });

  test("R9: should display statistics cards in review screen", async ({ page }) => {
    await tripRecordPage.fillTripInfo(generateTripName("Stats Cards"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(5);
    await tripRecordPage.reviewTrip();

    // All statistics should be visible
    await tripRecordPage.expectStatistics();

    // Verify distance, duration, and speed are all visible
    await expect(page.getByText(/Distance/i)).toBeVisible();
    await expect(page.getByText(/Duration/i)).toBeVisible();
    await expect(page.getByText(/Average Speed|Avg Speed/i)).toBeVisible();
  });

  test("R8: should display non-zero distance for automatic mode trips", async ({
    page,
  }) => {
    await tripRecordPage.fillTripInfo(generateTripName("Non-zero Distance"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();

    // Get distance text and verify it's not zero
    const distanceText = await page
      .locator("text=/\\d+(\\.\\d+)?\\s*(km|m)/i")
      .first()
      .textContent();
    expect(distanceText).toBeTruthy();

    // Extract number and verify > 0
    const match = distanceText?.match(/(\d+(\.\d+)?)/);
    if (match) {
      const distance = parseFloat(match[1]);
      expect(distance).toBeGreaterThan(0);
    }
  });
});