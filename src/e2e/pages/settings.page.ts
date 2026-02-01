import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Settings Page Object
 *
 * Handles user profile settings and session management.
 * Maps to: /settings route
 */
export class SettingsPage extends BasePage {
  // Profile section
  readonly nameInput: Locator;
  readonly emailDisplay: Locator;
  readonly saveButton: Locator;

  // Session section
  readonly logoutButton: Locator;

  // Feedback
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);

    // Profile
    this.nameInput = page.locator('#name, input[name="name"]');
    this.emailDisplay = page.locator("text=@").locator("..");
    this.saveButton = page.getByRole("button", { name: /Save|Update/i });

    // Session
    this.logoutButton = page.getByRole("button", { name: /Logout|Sign Out/i });

    // Feedback
    this.successMessage = page.locator(".bg-green-50, .text-green-600");
    this.errorMessage = page.locator(".bg-red-50, .text-red-600");
  }

  /**
   * Navigate to settings page
   */
  async goto(): Promise<void> {
    await this.navigateTo("/settings");
  }

  /**
   * Update profile name
   */
  async updateName(newName: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(newName);
    await this.saveButton.click();
  }

  /**
   * Get current name value
   */
  async getCurrentName(): Promise<string> {
    return (await this.nameInput.inputValue()) || "";
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  /**
   * Check if logout button is visible (indicates authenticated)
   */
  async isAuthenticated(): Promise<boolean> {
    return await this.logoutButton.isVisible();
  }

  /**
   * Expect success message
   */
  async expectSuccess(): Promise<void> {
    await expect(this.successMessage).toBeVisible();
  }

  /**
   * Expect error message
   */
  async expectError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
  }

  /**
   * Expect redirected after logout (app redirects to /routes, a public page)
   */
  async expectLoggedOut(): Promise<void> {
    // After logout, user is redirected to routes page (not login)
    await expect(this.page).toHaveURL(/\/(routes|paths|login)/);
  }
}
