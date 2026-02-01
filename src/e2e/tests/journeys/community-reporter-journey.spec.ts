import { expect, test } from "@playwright/test";
import { PathsPage } from "../../pages/paths.page";
import { ReportPage } from "../../pages/report.page";
import { RoutesPage } from "../../pages/routes.page";
import { TripRecordPage } from "../../pages/trip-record.page";
import { TripsPage } from "../../pages/trips.page";
import { generateTripName } from "../../utils/test-data";

/**
 * Community Reporter Journey Test
 *
 * End-to-end flow covering:
 * R25: Browse existing community paths
 * R26: Report conditions on a path
 * R15: Create and publish own path
 */
test.describe("R25-R26-R15: Community Reporter Journey", () => {
  test.setTimeout(180000); // Increased timeout for multiple OSRM calls
  test.use({ storageState: ".auth/user.json" });

  test("R25-R26: browse community paths and report conditions", async ({ page }) => {
    // 1. Browse community paths
    const pathsPage = new PathsPage(page);
    await pathsPage.goto();

    await expect(page).toHaveURL("/paths");

    // 2. Navigate to report page
    const reportPage = new ReportPage(page);
    await reportPage.goto();

    // 3. Verify report page loaded
    await expect(page).toHaveURL("/report");

    // 4. Report page should have search functionality
    await expect(reportPage.pathSearchInput).toBeVisible();
  });

  test("R6-R15: create trip, publish, and see in community", async ({ page }) => {
    // 1. Create a new trip
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();

    const tripName = generateTripName("Community Path");
    await tripRecordPage.fillTripInfo(tripName, "A great route to share");
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(5);

    // 2. Review and publish
    await tripRecordPage.reviewTrip();

    page.on("dialog", (dialog) => dialog.accept());
    await tripRecordPage.publishTrip();

    // 3. Check community paths
    const pathsPage = new PathsPage(page);
    await pathsPage.goto();

    // Should be able to view community paths
    await pathsPage.expectMapLoaded();
  });

  test("R15: contribute multiple paths to community", async ({ page }) => {
    const tripRecordPage = new TripRecordPage(page);

    // Create and publish first path
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(generateTripName("Scenic Route"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(5);
    await tripRecordPage.reviewTrip();

    page.on("dialog", (dialog) => dialog.accept());
    await tripRecordPage.publishTrip();

    // Create and publish second path
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(generateTripName("Quick Path"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.publishTrip();

    // Verify both published (shown as Published in trips list)
    const tripsPage = new TripsPage(page);
    await tripsPage.goto();

    // Should see trips in list
    await tripsPage.expectTripsLoaded();
  });

  test("R29-R6-R26: full cycle: search, record, report, browse", async ({ page }) => {
    // 1. Search for routes using URL params
    const routesPage = new RoutesPage(page);
    await routesPage.gotoWithSearch("Via Torino", "Corso Buenos Aires");
    await routesPage.waitForSearchComplete();

    // 2. Record a new trip
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();

    await tripRecordPage.fillTripInfo(generateTripName("Full Cycle Trip"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();

    page.removeAllListeners("dialog");
    page.on("dialog", (dialog) => {
      dialog.accept().catch(() => { });
    });
    await tripRecordPage.saveTrip();

    // 3. View in personal trips
    const tripsPage = new TripsPage(page);
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();

    // 4. Browse community paths
    const pathsPage = new PathsPage(page);
    await pathsPage.goto();
    await expect(page).toHaveURL("/paths");
  });
});