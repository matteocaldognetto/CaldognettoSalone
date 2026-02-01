import { test as setup, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { TEST_USER } from "@utils/test-data";

/**
 * Authentication Setup
 *
 * This setup file runs before all other tests to create an authenticated
 * session and save it to storage state for reuse across tests.
 *
 * The auth state is saved to .auth/user.json and loaded by tests that
 * depend on the "setup" project.
 *
 * If the test user doesn't exist, it will be created automatically.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "../.auth/user.json");

setup("authenticate", async ({ page }) => {
  // Navigate to login page
  await page.goto("/login");
  await page.waitForSelector("#email");

  // Try to login first
  await page.fill("#email", TEST_USER.email);
  await page.fill("#password", TEST_USER.password);
  await page.click('button[type="submit"]');

  // Wait a moment for response
  await page.waitForTimeout(2000);

  // Check if we're still on login page (login failed = user doesn't exist)
  const currentUrl = page.url();
  const isStillOnLogin = currentUrl.includes("/login");

  if (isStillOnLogin) {
    // Check if there's an error (user doesn't exist)
    const errorVisible = await page.locator(".bg-red-50").isVisible();

    if (errorVisible) {
      console.log("Test user does not exist, creating...");

      // Switch to signup mode
      await page.getByRole("button", { name: "Sign up" }).click();
      await page.waitForSelector("#name");

      // Fill signup form
      await page.fill("#name", TEST_USER.name);
      await page.fill("#email", TEST_USER.email);
      await page.fill("#password", TEST_USER.password);

      // Submit
      await page.click('button[type="submit"]');
    }
  }

  // Wait for successful redirect to authenticated area
  await expect(page).toHaveURL(/\/(routes|trips|paths)/, { timeout: 15000 });

  // Verify we're authenticated by checking for authenticated content
  await page.waitForLoadState("networkidle");

  // Save storage state (cookies, localStorage, etc.)
  await page.context().storageState({ path: authFile });

  console.log(`Auth state saved to ${authFile}`);
});
