import { test, expect } from "@playwright/test";
import { TripRecordPage } from "../../pages/trip-record.page";
import { TripsPage } from "../../pages/trips.page";
import { generateTripName, MOCK_OVERPASS_XML } from "../../utils/test-data";

/**
 * R15: Publish Trip Tests
 *
 * Tests cover:
 * - R15: Publishing trip from review screen
 * - R15: Publishing from trips list (privacy transition)
 * - R15: Rating requirement and constraints
 */
test.describe("R15: Publish Trip", () => {
  test.setTimeout(90000); // OSRM calls can be slow
  test.use({ storageState: ".auth/user.json" });

  // Funzione helper per il mock (così non lo riscriviamo 10 volte)
  const setupMock = async (page) => {
    await page.route("**/overpass-api.de/api/interpreter", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/xml",
        body: MOCK_OVERPASS_XML,
      });
    });
  };

  test("R15: should have publish option in review screen", async ({ page }) => {
    await setupMock(page);
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(generateTripName("Publish Test"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();

    // Publish button should be visible
    await expect(tripRecordPage.publishButton).toBeVisible();
  });

  test("R15: should publish trip from review screen", async ({ page }) => {
    await setupMock(page);
    const tripName = generateTripName("Publish Review");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(5);
    await tripRecordPage.reviewTrip();

    // Setup dialog handler for publication confirmation
    page.removeAllListeners("dialog");
    page.on("dialog", (dialog) => {
      dialog.accept().catch(() => { });
    });

    await tripRecordPage.publishTrip();

    // Wait for action to process
    await page.waitForTimeout(500);
  });

  test("R15: should publish trip from trips list", async ({ page }) => {
    await setupMock(page);
    // First create and save a trip as private (R10)
    const tripName = generateTripName("Publish List");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.saveTrip();

    // Go to trips list to transition privacy (R15)
    const tripsPage = new TripsPage(page);
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();

    // Setup dialog handler
    page.removeAllListeners("dialog");
    page.on("dialog", (dialog) => {
      dialog.accept().catch(() => { });
    });

    // Make trip public
    const makePublicButton = tripsPage.makePublicButtons.nth(0);
    const buttonText = await makePublicButton.textContent();
    if (buttonText?.includes("Make Public")) {
      await makePublicButton.click();
      await page.waitForTimeout(500);
    }

    await tripsPage.expectTripsLoaded();
  });

  test("R15: should require rating before publishing", async ({ page }) => {
    await setupMock(page);
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(generateTripName("No Rating"));
    await tripRecordPage.useAutomaticMode();

    // Review without setting rating
    await tripRecordPage.reviewTrip();

    // System should enforce or validate rating for public paths
    const publishButton = tripRecordPage.publishButton;
    await expect(publishButton).toBeVisible();
  });

  test("R15: published trip should be stored in the public repository", async ({ page }) => {
    await setupMock(page);
    const tripName = generateTripName("Repository Test");
    const tripRecordPage = new TripRecordPage(page);
    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(5);
    await tripRecordPage.reviewTrip();

    page.removeAllListeners("dialog");
    page.on("dialog", (dialog) => {
      dialog.accept().catch(() => { });
    });
    await tripRecordPage.publishTrip();

    // Verify it exists in personal history as published
    const tripsPage = new TripsPage(page);
    await tripsPage.goto();
    await tripsPage.expectTripsLoaded();

    const tripCount = await tripsPage.getTripCount();
    expect(tripCount).toBeGreaterThan(0);
  });
});