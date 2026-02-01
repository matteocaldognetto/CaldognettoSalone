import { test as base, Page, BrowserContext } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { LoginPage } from "@pages/login.page";
import { TEST_USER } from "@utils/test-data";

// Path to store authenticated session state
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_STATE_PATH = path.join(__dirname, "../.auth/user.json");

/**
 * Authentication Fixture Types
 */
type AuthFixtures = {
  /** Page with authenticated session loaded from storage state */
  authenticatedPage: Page;
  /** Page without authentication (guest) */
  guestPage: Page;
  /** LoginPage instance for the current page */
  loginPage: LoginPage;
  /** Helper to perform login */
  performLogin: (email?: string, password?: string) => Promise<void>;
};

/**
 * Extended test with authentication fixtures
 *
 * Usage:
 * ```ts
 * import { test } from '@fixtures/auth.fixture';
 *
 * test('authenticated test', async ({ authenticatedPage }) => {
 *   // Page is already logged in
 * });
 *
 * test('guest test', async ({ guestPage }) => {
 *   // Page is not logged in
 * });
 * ```
 */
export const test = base.extend<AuthFixtures>({
  // Authenticated page with pre-loaded session
  authenticatedPage: async ({ browser }, use) => {
    let context: BrowserContext;

    try {
      // Try to use stored auth state
      context = await browser.newContext({
        storageState: AUTH_STATE_PATH,
      });
    } catch {
      // If auth state doesn't exist, create fresh context
      context = await browser.newContext();
    }

    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // Guest page without authentication
  guestPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // LoginPage instance
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  // Helper function to perform login
  performLogin: async ({ page }, use) => {
    const performLogin = async (
      email = TEST_USER.email,
      password = TEST_USER.password,
    ) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.signIn(email, password);
      await loginPage.expectRedirectAfterAuth("/routes");
    };

    await use(performLogin);
  },
});

export { expect } from "@playwright/test";
