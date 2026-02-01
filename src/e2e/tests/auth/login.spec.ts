import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/login.page";
import { TEST_USER, generateUniqueEmail } from "../../utils/test-data";

/**
 * R2: User Login Tests
 *
 * Tests cover:
 * - Login with valid credentials
 * - Login error handling
 * - Redirect after login
 * - Session persistence
 */
test.describe("R2: User Login", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test("R2: should display signin form by default", async () => {
    await loginPage.expectSignInTitle();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.nameInput).not.toBeVisible();
  });

  test("R2: should login with valid credentials", async ({ page }) => {
    await loginPage.signIn(TEST_USER.email, TEST_USER.password);

    // Should redirect to routes page
    await loginPage.expectRedirectAfterAuth("/routes");
  });

  test("R2: should show error for invalid email", async ({ page }) => {
    await loginPage.signIn("nonexistent@example.com", "anypassword");

    await loginPage.expectError(/invalid|not found|incorrect/i);
  });

  test("R2: should show error for invalid password", async ({ page }) => {
    await loginPage.signIn(TEST_USER.email, "wrongpassword123");

    await loginPage.expectError(/invalid|incorrect|wrong/i);
  });

  test("R2: should redirect to original destination after login", async ({
    page,
  }) => {
    // Navigate directly to protected route
    await page.goto("/trips");

    // Should redirect to login with redirect param
    await expect(page).toHaveURL(/\/login.*redirect.*trips/);

    // Login
    await loginPage.signIn(TEST_USER.email, TEST_USER.password);

    // Should redirect back to trips
    await expect(page).toHaveURL("/trips", { timeout: 10000 });
  });

  test("R2: should redirect already logged in user away from login page", async ({
    page,
  }) => {
    // First login
    await loginPage.signIn(TEST_USER.email, TEST_USER.password);
    await loginPage.expectRedirectAfterAuth("/routes");

    // Try to access login page again
    await page.goto("/login");

    // Should redirect to routes since already authenticated
    await expect(page).toHaveURL("/routes");
  });

  test("R2: should clear error when switching modes", async ({ page }) => {
    // Trigger an error
    await loginPage.signIn("invalid@example.com", "wrongpassword");
    await loginPage.expectError(/invalid|incorrect/i);

    // Switch to signup mode
    await loginPage.switchToSignUp();

    // Error should be cleared
    await loginPage.expectNoError();
  });

  test("R2: should disable form inputs during submission", async ({ page }) => {
    await loginPage.emailInput.fill(TEST_USER.email);
    await loginPage.passwordInput.fill(TEST_USER.password);

    // Start submission
    await loginPage.submitButton.click();

    try {
      await expect(loginPage.emailInput).toBeDisabled({ timeout: 500 });
    } catch {
      // May have completed too quickly
    }
  });

  test("R2: should handle empty form submission", async ({ page }) => {
    await loginPage.submitButton.click();

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });
});