import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Login Page Object
 *
 * Handles authentication flows including sign in, sign up, and mode switching.
 * Maps to: /login route
 */
export class LoginPage extends BasePage {
  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly nameInput: Locator;
  readonly submitButton: Locator;

  // Mode switch buttons
  readonly switchToSignUpLink: Locator;
  readonly switchToSignInLink: Locator;

  // Feedback elements
  readonly errorMessage: Locator;
  readonly loadingState: Locator;

  // Card elements
  readonly cardTitle: Locator;
  readonly cardDescription: Locator;

  constructor(page: Page) {
    super(page);

    // Form inputs
    this.emailInput = page.locator("#email");
    this.passwordInput = page.locator("#password");
    this.nameInput = page.locator("#name");
    this.submitButton = page.locator('button[type="submit"]');

    // Mode switches
    this.switchToSignUpLink = page.getByRole("button", { name: "Sign up" });
    this.switchToSignInLink = page.getByRole("button", { name: "Sign in" });

    // Feedback
    this.errorMessage = page.locator(".bg-red-50");
    this.loadingState = page.getByText("Please wait...");

    // Card
    this.cardTitle = page.locator(".text-center h2, [class*='CardTitle']");
    this.cardDescription = page.locator("[class*='CardDescription']");
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await this.navigateTo("/login");
  }

  /**
   * Navigate to login page with redirect
   */
  async gotoWithRedirect(redirectPath: string): Promise<void> {
    await this.navigateTo(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  /**
   * Navigate directly to signup mode
   */
  async gotoSignUp(): Promise<void> {
    await this.navigateTo("/login?mode=signup");
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Sign up with name, email and password
   */
  async signUp(name: string, email: string, password: string): Promise<void> {
    // Switch to signup mode if not already
    if (await this.switchToSignUpLink.isVisible()) {
      await this.switchToSignUpLink.click();
    }

    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Switch to signup mode
   */
  async switchToSignUp(): Promise<void> {
    await this.switchToSignUpLink.click();
  }

  /**
   * Switch to signin mode
   */
  async switchToSignIn(): Promise<void> {
    await this.switchToSignInLink.click();
  }

  /**
   * Check if in signup mode
   */
  async isSignUpMode(): Promise<boolean> {
    return await this.nameInput.isVisible();
  }

  /**
   * Check if in signin mode
   */
  async isSignInMode(): Promise<boolean> {
    return !(await this.nameInput.isVisible());
  }

  /**
   * Get the error message text
   */
  async getErrorMessage(): Promise<string> {
    await expect(this.errorMessage).toBeVisible();
    return (await this.errorMessage.textContent()) || "";
  }

  /**
   * Expect an error message to be displayed
   */
  async expectError(message: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (typeof message === "string") {
      await expect(this.errorMessage).toContainText(message);
    } else {
      const text = await this.errorMessage.textContent();
      expect(text).toMatch(message);
    }
  }

  /**
   * Expect no error message
   */
  async expectNoError(): Promise<void> {
    await expect(this.errorMessage).not.toBeVisible();
  }

  /**
   * Expect successful authentication and redirect
   */
  async expectRedirectAfterAuth(expectedPath: string = "/routes"): Promise<void> {
    // Wait for redirect
    await expect(this.page).toHaveURL(new RegExp(expectedPath), {
      timeout: 10000,
    });
  }

  /**
   * Expect the form to be in loading state
   */
  async expectLoading(): Promise<void> {
    await expect(this.loadingState).toBeVisible();
    await expect(this.submitButton).toBeDisabled();
  }

  /**
   * Expect the signup mode title
   */
  async expectSignUpTitle(): Promise<void> {
    await expect(this.page.getByText("Create Account")).toBeVisible();
  }

  /**
   * Expect the signin mode title
   */
  async expectSignInTitle(): Promise<void> {
    await expect(this.page.getByText("Welcome Back")).toBeVisible();
  }

  /**
   * Check if password field has minLength validation
   */
  async getPasswordMinLength(): Promise<number> {
    const minLength = await this.passwordInput.getAttribute("minLength");
    return minLength ? parseInt(minLength) : 0;
  }
}
