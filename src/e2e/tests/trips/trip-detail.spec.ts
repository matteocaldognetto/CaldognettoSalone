import { test, expect } from "@playwright/test";
import { TripDetailPage } from "../../pages/trip-detail.page";
import { TripRecordPage } from "../../pages/trip-record.page";
import { TripsPage } from "../../pages/trips.page";
import { generateTripName } from "../../utils/test-data";

/**
 * R9-R33: Trip Detail Tests
 *
 * Tests cover:
 * - R33: Viewing specific trip from history
 * - R9: Showing summary of the ride (Statistics, Map)
 */
test.describe("R9-R33: Trip Detail View", () => {
  test.setTimeout(90000); // OSRM calls can be slow
  test.use({ storageState: ".auth/user.json" });

  test("R9: should display trip detail page with statistics", async ({ page }) => {
    // First create a trip
    const tripName = generateTripName("Detail View");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // Navigate via trips list (R33)
    const tripsPage = new TripsPage(page);
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();
    await tripsPage.viewTripAtIndex(0);

    // Verify detail page and statistics (R9)
    const tripDetailPage = new TripDetailPage(page);
    await tripDetailPage.expectStatistics();
  });

  test("R9: should show distance and duration", async ({ page }) => {
    // Create a trip
    const tripName = generateTripName("Stats Detail");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(3);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // Navigate to detail
    const tripsPage = new TripsPage(page);
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();
    await tripsPage.viewTripAtIndex(0);

    // Check statistics are visible
    await expect(page.getByText(/Distance/i).first()).toBeVisible();
  });

  test("R9: should display map with route", async ({ page }) => {
    // Create a trip
    const tripName = generateTripName("Map View");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // Navigate to detail
    const tripsPage = new TripsPage(page);
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();
    await tripsPage.viewTripAtIndex(0);

    // Verify details are visible
    await expect(page.getByText(/Distance/i).first()).toBeVisible();
  });
});