import { test, expect } from "@playwright/test";
import { RoutesPage } from "../../pages/routes.page";
import { TripRecordPage } from "../../pages/trip-record.page";
import { TripsPage } from "../../pages/trips.page";
import { generateTripName, MOCK_OVERPASS_XML } from "../../utils/test-data";

test.describe("R29-R6-R14: Daily Cyclist Commute Journey", () => {
  test.setTimeout(120000);
  test.use({ storageState: ".auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await page.route("**/overpass-api.de/api/interpreter", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/xml", body: MOCK_OVERPASS_XML });
    });
  });

  test("R29-R14: record daily commute with conditions", async ({ page }) => {
    const routesPage = new RoutesPage(page);
    await routesPage.gotoWithSearch("Via Torino", "Corso Buenos Aires");
    await routesPage.waitForSearchComplete();
    await page.goto("/trip-record");
    const tripRecordPage = new TripRecordPage(page);
    const tripName = generateTripName("Morning Commute");
    await tripRecordPage.fillTripInfo(tripName, "Daily commute to office");
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.enableObstacleMode();
    await tripRecordPage.setRating(3);
    await tripRecordPage.reviewTrip();
    page.on("dialog", (dialog) => dialog.accept().catch(() => { }));
    await tripRecordPage.saveTrip();
    await expect(page).toHaveURL("/trips");
    const tripsPage = new TripsPage(page);
    await tripsPage.expectTripVisible(tripName);
  });
});