import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Trips Page Object (My Paths)
 *
 * Handles trip list viewing, deletion, and publishing.
 * Maps to: /trips route
 */
export class TripsPage extends BasePage {
  // Header elements
  readonly pageTitle: Locator;
  readonly recordPathButton: Locator;

  // Trip list elements
  readonly tripCards: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;

  // Trip card actions
  readonly viewButtons: Locator;
  readonly makePublicButtons: Locator;
  readonly deleteButtons: Locator;

  // Confirmation dialogs
  readonly deleteConfirmationDialog: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;
  readonly publishConfirmationDialog: Locator;
  readonly publishConfirmButton: Locator;
  readonly publishCancelButton: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.pageTitle = page.getByRole("heading", { name: "My Paths" });
    this.recordPathButton = page.getByRole("button", { name: /Record Path/i });

    // Trip list
    this.tripCards = page.locator(".hover\\:shadow-md");
    this.emptyState = page.getByText("No paths yet");
    this.loadingState = page.getByText("Loading your paths...");

    // Actions
    this.viewButtons = page.getByRole("button", { name: /View/i });
    this.makePublicButtons = page.getByRole("button", {
      name: /Make Public|Published/i,
    });
    this.deleteButtons = page.locator('button:has(svg[class*="text-red"])');

    // Confirmation dialogs
    this.deleteConfirmationDialog = page.getByRole("dialog").filter({ hasText: /Delete Trip|Delete Forever/i });
    this.deleteConfirmButton = page.getByRole("button", { name: /Delete Forever/i });
    this.deleteCancelButton = this.deleteConfirmationDialog.getByRole("button", { name: /Cancel/i });
    this.publishConfirmationDialog = page.getByRole("dialog").filter({ hasText: /Publish to Community/i });
    this.publishConfirmButton = page.getByRole("button", { name: /Yes, Publish Path/i });
    this.publishCancelButton = this.publishConfirmationDialog.getByRole("button", { name: /Cancel/i });
  }

  /**
   * Navigate to trips page
   */
  async goto(): Promise<void> {
    await this.navigateTo("/trips");
  }

  /**
   * Click Record Path button to go to trip recording
   */
  async clickRecordPath(): Promise<void> {
    await this.recordPathButton.click();
  }

  /**
   * Get all trip cards
   */
  async getTripCards(): Promise<Locator> {
    return this.tripCards;
  }

  /**
   * Get trip card by name
   */
  getTripCardByName(name: string): Locator {
    // Use exact match to find the trip card by its full name
    return this.page.locator(".hover\\:shadow-md").filter({ has: this.page.getByText(name, { exact: true }) });
  }

  /**
   * Get trip count
   */
  async getTripCount(): Promise<number> {
    await this.waitForLoadingComplete();
    return await this.tripCards.count();
  }

  /**
   * Click View button on a specific trip
   */
  async viewTrip(tripName: string): Promise<void> {
    const tripCard = this.getTripCardByName(tripName);
    await tripCard.getByRole("button", { name: /View/i }).click();
  }

  /**
   * Click View button on trip at index
   */
  async viewTripAtIndex(index: number): Promise<void> {
    await this.viewButtons.nth(index).click();
  }

  /**
   * Click Make Public button on a specific trip
   */
  async makePublic(tripName: string): Promise<void> {
    const tripCard = this.getTripCardByName(tripName);
    await tripCard.getByRole("button", { name: /Make Public/i }).click();
  }

  /**
   * Click Delete button on a specific trip
   */
  async deleteTrip(tripName: string): Promise<void> {
    const tripCard = this.getTripCardByName(tripName);
    await tripCard.locator('button:has(svg[class*="text-red"])').click();
  }

  /**
   * Delete trip at index (handles confirmation dialog)
   */
  async deleteTripAtIndex(index: number): Promise<void> {
    await this.deleteButtons.nth(index).click();
    // Wait for and confirm the delete dialog
    await expect(this.deleteConfirmationDialog).toBeVisible({ timeout: 5000 });
    await this.deleteConfirmButton.click();
    // Wait for dialog to close
    await expect(this.deleteConfirmationDialog).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Make trip public by index (handles confirmation dialog)
   */
  async makePublicAtIndex(index: number): Promise<void> {
    await this.makePublicButtons.nth(index).click();
    // Wait for and confirm the publish dialog
    await expect(this.publishConfirmationDialog).toBeVisible({ timeout: 5000 });
    await this.publishConfirmButton.click();
    // Wait for dialog to close
    await expect(this.publishConfirmationDialog).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Check if trip is published
   */
  async isTripPublished(tripName: string): Promise<boolean> {
    const tripCard = this.getTripCardByName(tripName);
    const publishedButton = tripCard.getByRole("button", { name: "Published" });
    return await publishedButton.isVisible();
  }

  /**
   * Get trip statistics from card
   */
  async getTripStats(tripName: string): Promise<{
    distance: string;
    duration: string;
    avgSpeed: string;
  }> {
    const tripCard = this.getTripCardByName(tripName);

    const distanceText =
      (await tripCard
        .locator('span:has-text("Distance") + span')
        .first()
        .textContent()) || "";
    const durationText =
      (await tripCard
        .locator('span:has-text("Duration") + span')
        .first()
        .textContent()) || "";
    const avgSpeedText =
      (await tripCard
        .locator('span:has-text("Avg Speed") + span')
        .first()
        .textContent()) || "";

    return {
      distance: distanceText.trim(),
      duration: durationText.trim(),
      avgSpeed: avgSpeedText.trim(),
    };
  }

  /**
   * Expect empty state to be visible
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Expect trips to be loaded
   */
  async expectTripsLoaded(): Promise<void> {
    await expect(this.loadingState).not.toBeVisible();
  }

  /**
   * Expect a specific trip to be visible
   */
  async expectTripVisible(tripName: string): Promise<void> {
    // Wait for loading to complete first
    await this.waitForLoadingComplete();

    // Retry with delay in case data needs time to sync
    let lastError;
    for (let i = 0; i < 3; i++) {
      try {
        await expect(this.getTripCardByName(tripName)).toBeVisible({ timeout: 3000 });
        return;
      } catch (error) {
        lastError = error;
        if (i < 2) {
          // Refresh page and wait before retry
          await this.page.reload();
          await this.page.waitForLoadState("networkidle");
          await this.waitForLoadingComplete();
          await this.page.waitForTimeout(1000);
        }
      }
    }
    throw lastError;
  }

  /**
   * Expect a specific trip not to be visible
   */
  async expectTripNotVisible(tripName: string): Promise<void> {
    await expect(this.getTripCardByName(tripName)).not.toBeVisible();
  }

  /**
   * Expect trip count
   */
  async expectTripCount(count: number): Promise<void> {
    await expect(this.tripCards).toHaveCount(count);
  }

  /**
   * Expect weather data in trip card
   */
  async expectWeatherData(tripName: string): Promise<void> {
    const tripCard = this.getTripCardByName(tripName);
    await expect(tripCard.getByText("Weather")).toBeVisible();
  }
}
