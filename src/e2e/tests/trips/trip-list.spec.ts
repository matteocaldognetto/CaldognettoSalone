import { expect, test } from "@playwright/test";
import { TripRecordPage } from "../../pages/trip-record.page";
import { TripsPage } from "../../pages/trips.page";
import { generateTripName, MOCK_OVERPASS_XML } from "../../utils/test-data";

/**
 * R33: Trip List Management Tests
 *
 * Tests cover:
 * - R33: Viewing past recorded trips
 * - R33: Trip card display and management
 * - R15: Publishing private trips
 */
test.describe("R33: Trip List Management", () => {
  test.setTimeout(180000); // Increased timeout for Overpass API calls in automatic mode
  test.use({ storageState: ".auth/user.json" });

  let tripsPage: TripsPage;

  test.beforeEach(async ({ page }) => {
    tripsPage = new TripsPage(page);

    // Mock Overpass API to prevent rate limiting and timeouts
    await page.route("**/overpass-api.de/api/interpreter", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/xml",
        body: MOCK_OVERPASS_XML,
      });
    });
  });

  test("R33: should display trips page with header", async ({ page }) => {
    await tripsPage.goto();

    await expect(tripsPage.pageTitle).toBeVisible();
    await expect(tripsPage.recordPathButton).toBeVisible();
  });

  test("R33: should show empty state or list when visiting trips", async ({ page }) => {
    await tripsPage.goto();

    // Either trips are shown or empty state
    await tripsPage.expectTripsLoaded();
  });

  test("R33: should display trip cards with statistics", async ({ page }) => {
    // First create a trip
    const tripName = generateTripName("Stats Display");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // Go to trips list
    await tripsPage.goto();

    // Verify trips loaded and at least one trip exists
    await tripsPage.expectTripsLoaded();
    const tripCount = await tripsPage.getTripCount();
    expect(tripCount).toBeGreaterThan(0);
  });

  test("R33: should be able to delete a trip", async ({ page }) => {
    // First create a trip
    const tripName = generateTripName("Delete Test");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(3);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // Go to trips and delete
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();
    const countBefore = await tripsPage.getTripCount();

    // Delete first trip (page object handles dialog confirmation)
    await tripsPage.deleteTripAtIndex(0);

    // Wait for deletion to complete and list to update
    await page.waitForTimeout(1000);

    // Verify deletion
    const countAfter = await tripsPage.getTripCount();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("R33: should navigate to trip detail when clicking View", async ({
    page,
  }) => {
    // First create a trip
    const tripName = generateTripName("View Detail");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // Go to trips and click view
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();
    await tripsPage.viewTripAtIndex(0);

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/trip-detail/);
  });

  test("R15: should be able to make trip public from list", async ({ page }) => {
    // First create a trip
    const tripName = generateTripName("Public Trip");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(5);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // Go to trips and make public
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();

    // Make first trip public (page object handles dialog confirmation)
    const makePublicButton = tripsPage.makePublicButtons.nth(0);
    const buttonText = await makePublicButton.textContent();

    // Only proceed if button is enabled (not already published)
    if (buttonText?.includes("Make Public")) {
      await tripsPage.makePublicAtIndex(0);
      await page.waitForTimeout(1000);
    }

    // Verify button shows "Published"
    await expect(makePublicButton).toContainText("Published", { timeout: 10000 });
  });
});