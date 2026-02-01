import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";
import { MapHelper } from "../fixtures/map.fixture";

/**
 * Routes Page Object (Route Finder)
 *
 * Handles route searching and result viewing.
 * Maps to: /routes route
 */
export class RoutesPage extends BasePage {
  // Search form elements
  readonly startStreetInput: Locator;
  readonly endStreetInput: Locator;
  readonly searchButton: Locator;

  // Results elements
  readonly routeResults: Locator;
  readonly resultsSection: Locator;
  readonly noResultsMessage: Locator;

  // Loading states
  readonly searchingSpinner: Locator;

  // Info box
  readonly infoBox: Locator;

  // Map helper
  readonly mapHelper: MapHelper;

  constructor(page: Page) {
    super(page);

    // Search form - labels are divs, not proper label elements
    // Use text container + sibling input pattern
    this.startStreetInput = page.getByText("Start Street").locator("..").locator("input");
    this.endStreetInput = page.getByText("End Street").locator("..").locator("input");
    this.searchButton = page.getByRole("button", { name: /Search Routes/i });

    // Results
    this.routeResults = page.locator("[class*='route-result'], .cursor-pointer");
    this.resultsSection = page.getByText("Results").locator("..");
    this.noResultsMessage = page.getByText(/No routes found/i);

    // Loading
    this.searchingSpinner = page.locator(".animate-spin");

    // Info
    this.infoBox = page.locator(".bg-blue-50");

    // Map
    this.mapHelper = new MapHelper(page);
  }

  /**
   * Navigate to routes page
   */
  async goto(): Promise<void> {
    await this.navigateTo("/routes");
  }

  /**
   * Navigate to routes page with search params
   */
  async gotoWithSearch(startStreet: string, endStreet: string): Promise<void> {
    await this.navigateTo(
      `/routes?startStreet=${encodeURIComponent(startStreet)}&endStreet=${encodeURIComponent(endStreet)}`,
    );
  }

  /**
   * Fill start street input with autocomplete selection
   */
  async fillStartStreet(street: string): Promise<void> {
    // Close any previous dropdowns with Escape first
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(300);

    // Use JavaScript click to bypass overlay interception
    await this.startStreetInput.evaluate((el: HTMLElement) => el.click());
    await this.startStreetInput.fill(street);
    // Wait for autocomplete suggestions to appear
    await this.page.waitForTimeout(500);
    // Click the first suggestion button (if visible)
    try {
      const suggestions = this.page.locator(`button:has-text("${street.split(" ")[0]}")`);
      if (await suggestions.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestions.first().click();
      }
    } catch {
      // No suggestions, continue
    }
    // Close any open dropdown by pressing Escape
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(200);
  }

  /**
   * Fill end street input with autocomplete selection
   */
  async fillEndStreet(street: string): Promise<void> {
    // Close any previous dropdowns with Escape first
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(300);

    // Use JavaScript click to bypass overlay interception
    await this.endStreetInput.evaluate((el: HTMLElement) => el.click());
    await this.endStreetInput.fill(street);
    // Wait for autocomplete suggestions to appear
    await this.page.waitForTimeout(500);
    // Click the first suggestion button (if visible)
    try {
      const suggestions = this.page.locator(`button:has-text("${street.split(" ")[0]}")`);
      if (await suggestions.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        await suggestions.first().click();
      }
    } catch {
      // No suggestions, continue
    }
    // Close any open dropdown by pressing Escape
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(200);
  }

  /**
   * Perform a route search
   */
  async searchRoute(startStreet: string, endStreet: string): Promise<void> {
    await this.fillStartStreet(startStreet);
    await this.page.waitForTimeout(300);
    await this.fillEndStreet(endStreet);
    await this.page.waitForTimeout(300);

    // Wait for search button to become enabled
    try {
      await this.searchButton.waitFor({ state: "attached", timeout: 5000 });
      const isEnabled = await this.searchButton.isEnabled();
      if (isEnabled) {
        await this.searchButton.click();
        await this.waitForSearchComplete();
      }
    } catch {
      // Search button may remain disabled if streets not recognized
    }
  }

  /**
   * Wait for search to complete
   */
  async waitForSearchComplete(timeout = 15000): Promise<void> {
    try {
      await this.searchingSpinner.waitFor({ state: "visible", timeout: 2000 });
      await this.searchingSpinner.waitFor({ state: "hidden", timeout });
    } catch {
      // Search may complete very quickly
    }
  }

  /**
   * Get route count
   */
  async getRouteCount(): Promise<number> {
    await this.waitForSearchComplete();
    return await this.routeResults.count();
  }

  /**
   * Select route at index
   */
  async selectRoute(index: number): Promise<void> {
    await this.routeResults.nth(index).click();
  }

  /**
   * Select route by name
   */
  async selectRouteByName(name: string): Promise<void> {
    await this.page.locator(`text=${name}`).first().click();
  }

  /**
   * Check if routes were found
   */
  async hasRoutes(): Promise<boolean> {
    const count = await this.getRouteCount();
    return count > 0;
  }

  /**
   * Expect routes to be displayed
   */
  async expectRoutesDisplayed(minCount = 1): Promise<void> {
    await this.waitForSearchComplete();
    const count = await this.getRouteCount();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  /**
   * Expect no routes found message
   */
  async expectNoRoutesFound(): Promise<void> {
    await this.waitForSearchComplete();
    await expect(this.noResultsMessage).toBeVisible();
  }

  /**
   * Expect searching state
   */
  async expectSearching(): Promise<void> {
    await expect(this.searchingSpinner).toBeVisible();
  }

  /**
   * Expect map to be loaded
   */
  async expectMapLoaded(): Promise<void> {
    await this.mapHelper.waitForMapLoad();
  }

  /**
   * Expect path on map
   */
  async expectPathOnMap(): Promise<void> {
    await this.mapHelper.expectPathDisplayed();
  }

  /**
   * Expect the info box to be visible (when no search)
   */
  async expectInfoBox(): Promise<void> {
    await expect(this.infoBox).toBeVisible();
  }

  /**
   * Get route scores (if displayed)
   */
  async getRouteScores(): Promise<number[]> {
    const scoreElements = this.page.locator("[class*='score']");
    const scores: number[] = [];

    const count = await scoreElements.count();
    for (let i = 0; i < count; i++) {
      const text = await scoreElements.nth(i).textContent();
      if (text) {
        const score = parseFloat(text);
        if (!isNaN(score)) {
          scores.push(score);
        }
      }
    }

    return scores;
  }
}
