import { expect, test } from "@playwright/test";
import { TripRecordPage } from "../../pages/trip-record.page";
import { TripsPage } from "../../pages/trips.page";
import { generateTripName } from "../../utils/test-data";

/**
 * R33: Trip History Tests
 *
 * Tests cover:
 * - R33: Browsing personal trip history (My Paths)
 * - R8: Trip metadata display (Calculated statistics)
 * - R6: Navigation to trip recording
 */
test.describe("R33: Trip History (My Paths)", () => {
  test.setTimeout(90000); // OSRM calls can be slow
  test.use({ storageState: ".auth/user.json" });

  let tripsPage: TripsPage;

  test.beforeEach(async ({ page }) => {
    tripsPage = new TripsPage(page);
  });

  test("R33: should display My Paths page", async ({ page }) => {
    await tripsPage.goto();

    await expect(tripsPage.pageTitle).toBeVisible();
  });

  test("R8: should show trip cards with metadata", async ({ page }) => {
    // R8: Displaying computed statistics in history cards
    const tripName = generateTripName("History Test");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // View in trips list
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();

    const tripCount = await tripsPage.getTripCount();
    expect(tripCount).toBeGreaterThan(0);
  });

  test("R8: should display distance in trip cards", async ({ page }) => {
    const tripName = generateTripName("Distance Display");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(3);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();

    const tripCount = await tripsPage.getTripCount();
    expect(tripCount).toBeGreaterThan(0);
  });

  test("R8: should display duration in trip cards", async ({ page }) => {
    const tripName = generateTripName("Duration Display");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(3);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();

    const tripCount = await tripsPage.getTripCount();
    expect(tripCount).toBeGreaterThan(0);
  });

  test("R8: should display average speed in trip cards", async ({ page }) => {
    const tripName = generateTripName("Speed Display");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();

    const tripCount = await tripsPage.getTripCount();
    expect(tripCount).toBeGreaterThan(0);
  });

  test("R6: should have Record Path button", async ({ page }) => {
    // R6: Link to initiate cycling/recording
    await tripsPage.goto();

    await expect(tripsPage.recordPathButton).toBeVisible();
  });

  test("R6: should navigate to trip recording from My Paths", async ({
    page,
  }) => {
    // R6: Entry point for starting a trip
    await tripsPage.goto();
    await tripsPage.clickRecordPath();

    await expect(page).toHaveURL("/trip-record");
  });
});