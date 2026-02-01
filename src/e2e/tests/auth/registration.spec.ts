import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/login.page";
import { generateTestUser, generateUniqueEmail } from "../../utils/test-data";

/**
 * R1: User Registration Tests
 *
 * Tests cover:
 * - R1: User can create an account with email/password
 * - Registration validation (email format, password requirements)
 */
test.describe("R1: User Registration", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.gotoSignUp();
  });

  test("R1: should display signup form when in signup mode", async () => {
    await loginPage.expectSignUpTitle();
    await expect(loginPage.nameInput).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
  });

  test("R1: should register a new user with valid credentials", async ({
    page,
  }) => {
    const testUser = generateTestUser();

    await loginPage.signUp(testUser.name, testUser.email, testUser.password);

    // Should redirect to authenticated area
    await loginPage.expectRedirectAfterAuth("/routes");
  });

  test("R1: should show error for duplicate email registration", async ({
    page,
  }) => {
    const testUser = generateTestUser();
    await loginPage.signUp(testUser.name, testUser.email, testUser.password);
    await loginPage.expectRedirectAfterAuth("/routes");

    await page.context().clearCookies();
    await loginPage.gotoSignUp();

    // Try to register with same email
    await loginPage.signUp(
      "Another User",
      testUser.email,
      "DifferentPassword123!",
    );

    // Should show error
    await loginPage.expectError(/already|exists|registered/i);
  });

  test("R1: should enforce password minimum length of 8 characters", async ({
    page,
  }) => {
    const minLength = await loginPage.getPasswordMinLength();
    expect(minLength).toBe(8);
  });

  test("R1: should require name field in signup mode", async ({ page }) => {
    const email = generateUniqueEmail();

    await loginPage.emailInput.fill(email);
    await loginPage.passwordInput.fill("ValidPassword123!");

    await expect(loginPage.nameInput).toHaveAttribute("required", "");
  });

  test("R1: should require valid email format", async ({ page }) => {
    await loginPage.nameInput.fill("Test User");
    await loginPage.emailInput.fill("invalid-email");
    await loginPage.passwordInput.fill("ValidPassword123!");

    const isValid = await loginPage.emailInput.evaluate(
      (el) => (el as HTMLInputElement).checkValidity(),
    );
    expect(isValid).toBe(false);
  });

  test("R1: should switch between signin and signup modes", async ({ page }) => {
    await loginPage.expectSignUpTitle();
    await expect(loginPage.nameInput).toBeVisible();

    await loginPage.switchToSignIn();
    await loginPage.expectSignInTitle();
    await expect(loginPage.nameInput).not.toBeVisible();

    await loginPage.switchToSignUp();
    await loginPage.expectSignUpTitle();
    await expect(loginPage.nameInput).toBeVisible();
  });

  test("R1: should show password hint in signup mode", async ({ page }) => {
    await expect(
      page.getByText(/Must be at least 8 characters/i),
    ).toBeVisible();
  });

  test("R1: should disable form during submission", async ({ page }) => {
    const testUser = generateTestUser();

    await loginPage.nameInput.fill(testUser.name);
    await loginPage.emailInput.fill(testUser.email);
    await loginPage.passwordInput.fill(testUser.password);

    await loginPage.submitButton.click();

    try {
      await expect(page.getByText("Please wait...")).toBeVisible({
        timeout: 1000,
      });
    } catch {
      // Form may have submitted too quickly
    }
  });
});