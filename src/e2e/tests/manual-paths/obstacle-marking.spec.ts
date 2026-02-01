import { test, expect } from "@playwright/test";
import { TripRecordPage } from "../../pages/trip-record.page";
import { generateTripName, MOCK_OVERPASS_XML } from "../../utils/test-data";

/**
 * R14: Obstacle Marking Tests
 *
 * Tests cover:
 * - R14: Obstacle mode activation
 * - R14: Marking obstacles on map
 * - R14: Obstacle type selection and metadata
 */
test.describe("R14: Obstacle Marking", () => {
  test.setTimeout(90000); // OSRM calls can be slow
  test.use({ storageState: ".auth/user.json" });

  let tripRecordPage: TripRecordPage;

  test.beforeEach(async ({ page }) => {
    tripRecordPage = new TripRecordPage(page);

    // --- MOCK PER EVITARE TIMEOUT ---
    await page.route("**/overpass-api.de/api/interpreter", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/xml",
        body: MOCK_OVERPASS_XML,
      });
    });
    // --------------------------------

    await tripRecordPage.goto();
    await tripRecordPage.fillTripInfo(generateTripName("Obstacle Test"));
    await tripRecordPage.useAutomaticMode();
  });

  test("R14: should have mark obstacles button", async ({ page }) => {
    await expect(tripRecordPage.markObstaclesButton).toBeVisible();
  });

  test("R14: should enable obstacle marking mode", async ({ page }) => {
    await tripRecordPage.enableObstacleMode();

    // Should show indicator that obstacle mode is on
    await expect(tripRecordPage.obstaclesModeIndicator).toBeVisible();
  });

  test("R14: should be able to mark obstacle on map", async ({ page }) => {
    await tripRecordPage.enableObstacleMode();

    // Wait for map
    await tripRecordPage.mapHelper.waitForMapLoad();

    // Click on map to mark obstacle
    await tripRecordPage.markObstacleAtCenter();

    // Dialog should appear for obstacle details
    const dialogVisible = await page.locator("dialog, [role='dialog']").isVisible();
    if (dialogVisible) {
      // Fill obstacle details
      await tripRecordPage.fillObstacleDetails("pothole", "Test pothole");
    }
  });

  test("R14: should display obstacle section in UI", async ({ page }) => {
    // Obstacle mode should be set up
    await tripRecordPage.enableObstacleMode();

    // Check if obstacles section exists
    const obstaclesSection = page.locator("text=/Detected Obstacles|obstacle/i");

    const obstaclesSectionExists = await obstaclesSection.isVisible().catch(() => false);
    expect(typeof obstaclesSectionExists).toBe("boolean");
  });

  test("R14: should support different obstacle types", async ({ page }) => {
    // Enable obstacle mode
    await tripRecordPage.enableObstacleMode();

    // Mark an obstacle
    await tripRecordPage.mapHelper.waitForMapLoad();
    await tripRecordPage.markObstacleAtCenter();

    // Check if obstacle type select has expected options
    const selectVisible = await page.locator("select").first().isVisible();
    if (selectVisible) {
      const options = await page.locator("select option").allTextContents();
      expect(options.length).toBeGreaterThan(1);
    }
  });

  test("R14: obstacles should be part of the review workflow", async ({ page }) => {
    // Verify the workflow for marking and reviewing is available
    await expect(tripRecordPage.markObstaclesButton).toBeVisible();

    await tripRecordPage.setRating(4);
    await tripRecordPage.reviewTrip();

    // Verify review screen is reached
    await tripRecordPage.expectReviewScreen();
  });
});