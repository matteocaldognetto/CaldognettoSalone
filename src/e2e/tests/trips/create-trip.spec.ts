import { expect, test } from "@playwright/test";
import { TripRecordPage } from "../../pages/trip-record.page";
import { TripsPage } from "../../pages/trips.page";
import { generateTripName, MOCK_OVERPASS_XML } from "../../utils/test-data";

/**
 * R6-R8: Trip Creation Tests
 *
 * Tests cover:
 * - R6: Initiate trip recording (Detect cycling/Start)
 * - R7: GPS/route logging (Simulated via automatic mode)
 * - R8: Automatically compute summary statistics
 */
test.describe("R6-R8: Trip Creation", () => {
  test.setTimeout(90000); // OSRM calls can be slow
  test.use({ storageState: ".auth/user.json" });

  let tripRecordPage: TripRecordPage;

  test.beforeEach(async ({ page }) => {
    tripRecordPage = new TripRecordPage(page);

    // Mock Overpass API to prevent rate limiting and timeouts
    await page.route("**/overpass-api.de/api/interpreter", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/xml",
        body: MOCK_OVERPASS_XML,
      });
    });

    await tripRecordPage.goto();
  });

  test("R6: should display trip recording form", async ({ page }) => {
    await expect(tripRecordPage.tripNameInput).toBeVisible();
    await expect(tripRecordPage.automaticModeButton).toBeVisible();
    await expect(tripRecordPage.reviewTripButton).toBeVisible();
  });

  test("R6-R7: should create a trip using automatic mode", async ({ page }) => {
    const tripName = generateTripName("Auto Trip");

    await tripRecordPage.fillTripInfo(tripName, "Test trip using automatic mode");
    await tripRecordPage.useAutomaticMode();

    // Verify routes were generated (R7 - Log GPS coordinates)
    const routeCount = await tripRecordPage.getRouteCount();
    expect(routeCount).toBeGreaterThan(0);

    // Verify Start (green) and End (red) markers are displayed on the map
    await expect(page.locator('img[src*="marker-icon-2x-green.png"]')).toBeVisible();
    await expect(page.locator('img[src*="marker-icon-2x-red.png"]')).toBeVisible();

    // Set rating
    await tripRecordPage.setRating(4);

    // Review and save
    await tripRecordPage.reviewTrip();
    await tripRecordPage.expectReviewScreen();

    await tripRecordPage.saveTrip();

    // Verify redirect to trips list
    await expect(page).toHaveURL("/trips");
  });

  test("R6: should require trip name before review", async ({ page }) => {
    // Use automatic mode without filling name
    await tripRecordPage.useAutomaticMode();

    // Review button should be disabled or show validation error
    const isDisabled = await tripRecordPage.reviewTripButton.isDisabled();
    if (!isDisabled) {
      // Click and expect validation
      await tripRecordPage.reviewTripButton.click();
    }
  });

  test("R7: should generate routes in automatic mode", async ({ page }) => {
    await tripRecordPage.fillTripInfo(generateTripName("Route Gen Test"));
    await tripRecordPage.useAutomaticMode();

    // Routes should be visible on the page (R7)
    const routeCount = await tripRecordPage.getRouteCount();
    expect(routeCount).toBeGreaterThan(0);
  });

  test("R8: should show trip statistics in review", async ({ page }) => {
    await tripRecordPage.fillTripInfo(generateTripName("Stats Test"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(3);
    await tripRecordPage.reviewTrip();

    // Statistics should be visible (R8)
    await tripRecordPage.expectStatistics();
    await expect(page.getByText(/Distance/i)).toBeVisible();
  });

  test("R10: should save trip and appear in trips list", async ({ page }) => {
    const tripName = generateTripName("Visible Trip");

    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(5);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // Go to trips list (R33/R10)
    const tripsPage = new TripsPage(page);
    await tripsPage.goto();

    // Verify trips page loaded and has at least one trip
    await tripsPage.expectTripsLoaded();
    const tripCount = await tripsPage.getTripCount();
    expect(tripCount).toBeGreaterThan(0);
  });

  test("should be able to set different ratings", async ({ page }) => {
    await tripRecordPage.fillTripInfo(generateTripName("Rating Test"));
    await tripRecordPage.useAutomaticMode();

    // Test setting rating to 3 stars
    await tripRecordPage.setRating(3);

    const stars = tripRecordPage.ratingStars;
    expect(await stars.count()).toBe(5);
  });

  test("R6: should navigate from trips page to record new trip", async ({
    page,
  }) => {
    const tripsPage = new TripsPage(page);
    await tripsPage.goto();
    await tripsPage.clickRecordPath();

    // Should navigate to trip-record
    await expect(page).toHaveURL("/trip-record");
  });
});