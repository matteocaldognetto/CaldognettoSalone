import { test, expect } from "@playwright/test";
import { PathsPage } from "../../pages/paths.page";
import { LoginPage } from "../../pages/login.page";
import { TripRecordPage } from "../../pages/trip-record.page";
import { TripsPage } from "../../pages/trips.page";
import { RoutesPage } from "../../pages/routes.page";
import { generateTestUser, generateTripName } from "../../utils/test-data";

/**
 * New User Journey Test
 *
 * End-to-end flow covering:
 * R3: Browsing as guest
 * R1: Signing up for an account
 * R6/R10: Recording and saving first trip
 * R33: Viewing in history
 */
test.describe("R3-R1-R33: New User Journey", () => {
  test.setTimeout(90000); // OSRM calls can be slow
  test.use({ storageState: { cookies: [], origins: [] } }); // Start as guest

  test("R1: complete new user onboarding flow", async ({ page }) => {
    // 1. Land on public paths page
    const pathsPage = new PathsPage(page);
    await pathsPage.goto();
    await pathsPage.expectPageTitle();

    // 2. Click Sign In from CTA
    await pathsPage.clickSignIn();
    await expect(page).toHaveURL(/\/login/);

    // 3. Create account
    const loginPage = new LoginPage(page);
    const testUser = generateTestUser();

    await loginPage.switchToSignUp();
    await loginPage.signUp(testUser.name, testUser.email, testUser.password);

    // 4. Wait for redirect after auth
    await page.waitForURL(/\/(routes|trips|paths)/, { timeout: 15000 });

    // 5. Navigate to record first trip
    await page.goto("/trip-record");

    // 6. Create trip with automatic mode
    const tripRecordPage = new TripRecordPage(page);
    const tripName = generateTripName("My First Trip");

    await tripRecordPage.fillTripInfo(tripName, "First trip as a new user");
    await tripRecordPage.useAutomaticMode();

    // 7. Set rating and review
    await tripRecordPage.setRating(5);
    await tripRecordPage.reviewTrip();
    await tripRecordPage.expectReviewScreen();

    // 8. Setup dialog handler and save
    page.removeAllListeners("dialog");
    page.on("dialog", (dialog) => {
      dialog.accept().catch(() => { });
    });
    await tripRecordPage.saveTrip();

    // 9. Verify redirect to trips page
    await page.waitForURL(/\/trips/, { timeout: 15000 });
  });

  test("R3-R29: new user can search routes before signing up", async ({ page }) => {
    // 1. Start on routes page as guest
    const routesPage = new RoutesPage(page);
    await routesPage.gotoWithSearch("Via Torino", "Corso Buenos Aires");

    // 2. Page should load without requiring authentication
    await expect(page).toHaveURL(/\/routes/);

    // 3. Wait for search to complete
    await routesPage.waitForSearchComplete();
  });

  test("R3-R1: guest to authenticated user transition", async ({ page }) => {
    // 1. Browse as guest
    await page.goto("/paths");
    await expect(page).toHaveURL("/paths");

    // 2. Try to access protected route
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/login/);

    // 3. Sign up
    const testUser = generateTestUser();
    const loginPage = new LoginPage(page);
    await loginPage.switchToSignUp();
    await loginPage.signUp(testUser.name, testUser.email, testUser.password);

    // 4. Should redirect back to trips (the original destination)
    await expect(page).toHaveURL("/trips", { timeout: 10000 });

    // 5. Can access protected content - use heading to be specific
    await expect(page.getByRole("heading", { name: "My Paths" })).toBeVisible();
  });
});