import { Page, Locator, expect } from "@playwright/test";

/**
 * Base Page Object
 *
 * Provides common functionality for all page objects including
 * navigation, waiting, and dialog handling.
 */
export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigates to a specific path and waits for network to settle
   */
  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Waits for an API response matching the given URL pattern
   */
  async waitForApiResponse(urlPattern: RegExp): Promise<void> {
    await this.page.waitForResponse(urlPattern);
  }

  /**
   * Waits for a tRPC mutation to complete
   */
  async waitForTrpcMutation(procedureName: string): Promise<void> {
    await this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/trpc") &&
        response.url().includes(procedureName),
    );
  }

  /**
   * Waits for loading spinner to appear and disappear
   */
  async waitForLoadingComplete(timeout = 15000): Promise<void> {
    const spinner = this.page.locator(".animate-spin");

    try {
      // Wait for loading to start (if it does)
      await spinner.waitFor({ state: "visible", timeout: 1000 });
    } catch {
      // Loading may have completed before we checked
      return;
    }

    // Wait for loading to complete
    await spinner.waitFor({ state: "hidden", timeout });
  }

  /**
   * Handles window.confirm dialogs by accepting or dismissing
   */
  async handleConfirmDialog(accept: boolean = true): Promise<string> {
    return new Promise((resolve) => {
      this.page.once("dialog", async (dialog) => {
        const message = dialog.message();
        if (accept) {
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
        resolve(message);
      });
    });
  }

  /**
   * Handles window.alert dialogs
   */
  async handleAlertDialog(): Promise<string> {
    return new Promise((resolve) => {
      this.page.once("dialog", async (dialog) => {
        const message = dialog.message();
        await dialog.accept();
        resolve(message);
      });
    });
  }

  /**
   * Sets up a dialog handler that auto-accepts all dialogs
   */
  setupAutoAcceptDialogs(): void {
    this.page.removeAllListeners("dialog");
    this.page.on("dialog", async (dialog) => {
      await dialog.accept().catch(() => {});
    });
  }

  /**
   * Gets the current URL path
   */
  async getCurrentPath(): Promise<string> {
    return new URL(this.page.url()).pathname;
  }

  /**
   * Expects the page URL to match the given pattern
   */
  async expectUrl(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  /**
   * Expects some text to be visible on the page
   */
  async expectTextVisible(text: string | RegExp): Promise<void> {
    const locator =
      typeof text === "string"
        ? this.page.getByText(text)
        : this.page.locator(`text=${text.source}`);
    await expect(locator.first()).toBeVisible();
  }

  /**
   * Clicks a button by its text content
   */
  async clickButton(text: string | RegExp): Promise<void> {
    await this.page.getByRole("button", { name: text }).click();
  }

  /**
   * Fills an input field by its label
   */
  async fillByLabel(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  /**
   * Gets the page instance
   */
  getPage(): Page {
    return this.page;
  }
}
