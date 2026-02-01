import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";
import { MapHelper } from "../fixtures/map.fixture";

/**
 * Paths Page Object (Discover Paths)
 *
 * Handles viewing community published paths.
 * Maps to: /paths route (public)
 */
export class PathsPage extends BasePage {
  // Header
  readonly pageTitle: Locator;

  // Path list
  readonly pathCards: Locator;
  readonly emptyState: Locator;

  // CTA for guests
  readonly guestCTA: Locator;
  readonly signInButton: Locator;

  // Map
  readonly mapHelper: MapHelper;

  constructor(page: Page) {
    super(page);

    // Header
    this.pageTitle = page.getByRole("heading", { name: /Discover Bike Paths/i });

    // Paths
    this.pathCards = page.locator(".rounded-lg.border");
    this.emptyState = page.getByText(/No paths/i);

    // Guest CTA - be specific to avoid matching header Sign In button
    this.guestCTA = page.getByText(/Want to contribute/i);
    // The CTA sign in button is in the banner (bg-primary section)
    this.signInButton = page.locator(".bg-primary").getByRole("button", { name: /Sign In/i });

    // Map
    this.mapHelper = new MapHelper(page);
  }

  /**
   * Navigate to paths page
   */
  async goto(): Promise<void> {
    await this.navigateTo("/paths");
  }

  /**
   * Get path count
   */
  async getPathCount(): Promise<number> {
    return await this.pathCards.count();
  }

  /**
   * Click Sign In button (for guests)
   * Uses JavaScript click to bypass TanStack DevTools overlay
   */
  async clickSignIn(): Promise<void> {
    // Use JavaScript click to bypass overlay
    await this.signInButton.evaluate((el: HTMLElement) => el.click());
  }

  /**
   * Check if guest CTA is visible
   */
  async hasGuestCTA(): Promise<boolean> {
    return await this.guestCTA.isVisible();
  }

  /**
   * Expect page title to be visible
   */
  async expectPageTitle(): Promise<void> {
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Expect empty state
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Expect paths to be displayed
   */
  async expectPathsDisplayed(minCount = 1): Promise<void> {
    const count = await this.getPathCount();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  /**
   * Expect map to be loaded
   */
  async expectMapLoaded(): Promise<void> {
    await this.mapHelper.waitForMapLoad();
  }

  /**
   * Expect guest CTA visible
   */
  async expectGuestCTA(): Promise<void> {
    await expect(this.guestCTA).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }
}
