import { test, expect } from "@playwright/test";
import { TripRecordPage } from "../../pages/trip-record.page";
import { generateTripName, MOCK_OVERPASS_XML } from "../../utils/test-data";

test.describe("R6-R12: Automatic Collection Mode", () => {
  test.use({ storageState: ".auth/user.json" });
  test.setTimeout(90000);

  let tripRecordPage: TripRecordPage;

  test.beforeEach(async ({ page }) => {
    tripRecordPage = new TripRecordPage(page);
    // Mock API per evitare il timeout dei 90 secondi
    await page.route("**/overpass-api.de/api/interpreter", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/xml", body: MOCK_OVERPASS_XML });
    });
    await tripRecordPage.goto();
  });

  test("R6: should have automatic mode button", async () => {
    await expect(tripRecordPage.automaticModeButton).toBeVisible();
  });

  test("R7: should generate routes when automatic mode is activated", async () => {
    await tripRecordPage.fillTripInfo(generateTripName("Auto Routes"));
    await tripRecordPage.useAutomaticMode();
    const routeCount = await tripRecordPage.getRouteCount();
    expect(routeCount).toBeGreaterThan(0);
  });

  test("R8: should display generated routes with distance", async ({ page }) => {
    await tripRecordPage.fillTripInfo(generateTripName("Route Distance"));
    await tripRecordPage.useAutomaticMode();
    const routeCards = page.locator(".rounded-lg.border.bg-white");
    await expect(routeCards.first()).toBeVisible();
    expect(await routeCards.first().textContent()).toBeTruthy();
  });

  test("R12: should auto-fill trip data in automatic mode", async () => {
    await tripRecordPage.fillTripInfo(generateTripName("Auto Fill"));
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.expectWeatherSection();
  });

  test("R6: should display multiple routes in automatic mode", async () => {
    await tripRecordPage.fillTripInfo(generateTripName("Multi Routes"));
    await tripRecordPage.useAutomaticMode();
    const routeCount = await tripRecordPage.getRouteCount();
    expect(routeCount).toBeGreaterThanOrEqual(1);
  });

  test("R10: should be able to complete trip in automatic mode", async ({ page }) => {
    const tripName = generateTripName("Complete Auto");
    await tripRecordPage.fillTripInfo(tripName);
    await tripRecordPage.useAutomaticMode();
    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.expectReviewScreen();
    page.once("dialog", (dialog) => dialog.accept().catch(() => { }));
    await tripRecordPage.saveTrip();
    await expect(page).toHaveURL("/trips");
  });
});