import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/login.page";
import { SettingsPage } from "../../pages/settings.page";
import { TEST_USER } from "../../utils/test-data";

/**
 * R5: User Logout Tests
 *
 * Tests cover:
 * - Logout functionality
 * - Session termination
 * - Protected route access after logout
 */
test.describe("R5: User Logout", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signIn(TEST_USER.email, TEST_USER.password);
    await loginPage.expectRedirectAfterAuth("/routes");
  });

  test("R5: should logout from settings page", async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // Verify we're authenticated
    expect(await settingsPage.isAuthenticated()).toBe(true);

    // Logout
    await settingsPage.logout();

    // Should redirect to login
    await settingsPage.expectLoggedOut();
  });

  test("R5: should not be able to access protected routes after logout", async ({
    page,
  }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.logout();
    await settingsPage.expectLoggedOut();

    // Try to access protected route
    await page.goto("/trips");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("R5: should clear session data after logout", async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.logout();

    // Clear any remaining client-side state by refreshing
    await page.reload();

    // Try to access protected route
    await page.goto("/trip-record");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("R5: should be able to login again after logout", async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.logout();

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signIn(TEST_USER.email, TEST_USER.password);

    // Should be authenticated again
    await loginPage.expectRedirectAfterAuth("/routes");
  });
});