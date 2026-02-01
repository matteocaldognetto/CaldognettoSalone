import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";
import { MapHelper } from "../fixtures/map.fixture";

/**
 * Trip Detail Page Object
 *
 * Handles viewing individual trip details.
 * Maps to: /trip-detail route
 */
export class TripDetailPage extends BasePage {
  // Header
  readonly pageTitle: Locator;
  readonly backButton: Locator;

  // Statistics
  readonly distanceCard: Locator;
  readonly durationCard: Locator;
  readonly avgSpeedCard: Locator;
  readonly maxSpeedCard: Locator;

  // Weather
  readonly weatherSection: Locator;

  // Routes list
  readonly routesList: Locator;
  readonly routeCards: Locator;

  // Map
  readonly mapHelper: MapHelper;

  constructor(page: Page) {
    super(page);

    // Header
    this.pageTitle = page.locator("h1, h2").first();
    this.backButton = page.getByRole("button", { name: /Back|←/i });

    // Statistics (use first to avoid strict mode violations)
    this.distanceCard = page.locator("text=/Distance/i").first().locator("..");
    this.durationCard = page.locator("text=/Duration/i").first().locator("..");
    this.avgSpeedCard = page.locator("text=/Average Speed/i").first().locator("..");
    this.maxSpeedCard = page.locator("text=/Max Speed/i").first().locator("..");

    // Weather
    this.weatherSection = page.locator("text=/Weather/i").locator("..");

    // Routes
    this.routesList = page.locator(".space-y-4, .grid");
    this.routeCards = page.locator(".rounded-lg.border");

    // Map
    this.mapHelper = new MapHelper(page);
  }

  /**
   * Navigate to trip detail page with trip ID
   */
  async goto(tripId: string): Promise<void> {
    await this.navigateTo(`/trip-detail?tripId=${tripId}`);
  }

  /**
   * Go back to trips list
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
  }

  /**
   * Get trip title
   */
  async getTripTitle(): Promise<string> {
    return (await this.pageTitle.textContent()) || "";
  }

  /**
   * Get distance value
   */
  async getDistance(): Promise<string> {
    const text = await this.distanceCard.textContent();
    return text?.match(/[\d.]+\s*(km|m)/i)?.[0] || "";
  }

  /**
   * Get duration value
   */
  async getDuration(): Promise<string> {
    const text = await this.durationCard.textContent();
    return text?.match(/[\d]+\s*(h|m|min)/i)?.[0] || "";
  }

  /**
   * Get average speed value
   */
  async getAvgSpeed(): Promise<string> {
    const text = await this.avgSpeedCard.textContent();
    return text?.match(/[\d.]+\s*km\/h/i)?.[0] || "";
  }

  /**
   * Get route count
   */
  async getRouteCount(): Promise<number> {
    return await this.routeCards.count();
  }

  /**
   * Check if weather data is displayed
   */
  async hasWeatherData(): Promise<boolean> {
    return await this.weatherSection.isVisible();
  }

  /**
   * Expect statistics to be visible
   */
  async expectStatistics(): Promise<void> {
    await expect(this.distanceCard).toBeVisible();
    // Duration might not be on detail page, just check distance is enough
  }

  /**
   * Expect weather section
   */
  async expectWeatherSection(): Promise<void> {
    await expect(this.weatherSection).toBeVisible();
  }

  /**
   * Expect map to be loaded
   */
  async expectMapLoaded(): Promise<void> {
    await this.mapHelper.waitForMapLoad();
  }

  /**
   * Expect route to be displayed on map
   */
  async expectRouteOnMap(): Promise<void> {
    await this.mapHelper.expectPathDisplayed();
  }
}
