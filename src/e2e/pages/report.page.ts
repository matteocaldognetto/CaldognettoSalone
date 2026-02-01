import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";
import { MapHelper } from "../fixtures/map.fixture";

/**
 * Report Page Object (Path Condition Reporting)
 *
 * Handles reporting conditions on existing community paths.
 * Maps to: /report route
 */
export class ReportPage extends BasePage {
  // Search
  readonly pathSearchInput: Locator;
  readonly searchResults: Locator;

  // Selected path info
  readonly selectedPathName: Locator;
  readonly pathDetails: Locator;

  // Condition reporting
  readonly streetStatusSelects: Locator;
  readonly ratingStars: Locator;
  readonly notesTextarea: Locator;

  // Obstacle marking
  readonly markObstaclesButton: Locator;

  // Actions
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  // Map
  readonly mapHelper: MapHelper;

  constructor(page: Page) {
    super(page);

    // Search
    this.pathSearchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="path"]',
    );
    this.searchResults = page.locator(".cursor-pointer, .hover\\:bg-gray-50");

    // Selected path
    this.selectedPathName = page.locator("h3, .font-semibold").first();
    this.pathDetails = page.locator(".space-y-4");

    // Reporting
    this.streetStatusSelects = page.locator(
      'select:has-text("optimal"), select:has-text("medium")',
    );
    this.ratingStars = page.locator('button:has(svg[class*="lucide-star"])');
    this.notesTextarea = page.locator(
      'textarea[placeholder*="notes"], textarea[name="notes"]',
    );

    // Obstacles
    this.markObstaclesButton = page.getByRole("button", {
      name: /Mark Obstacles/i,
    });

    // Actions
    this.submitButton = page.getByRole("button", { name: /Submit|Report/i });
    this.cancelButton = page.getByRole("button", { name: /Cancel/i });

    // Map
    this.mapHelper = new MapHelper(page);
  }

  /**
   * Navigate to report page
   */
  async goto(): Promise<void> {
    await this.navigateTo("/report");
  }

  /**
   * Search for a path
   */
  async searchPath(pathName: string): Promise<void> {
    await this.pathSearchInput.fill(pathName);
  }

  /**
   * Select a path from search results
   */
  async selectPath(index: number = 0): Promise<void> {
    await this.searchResults.nth(index).click();
  }

  /**
   * Select path by name
   */
  async selectPathByName(name: string): Promise<void> {
    await this.page.locator(`text=${name}`).first().click();
  }

  /**
   * Set rating for the path
   */
  async setRating(stars: number): Promise<void> {
    await this.ratingStars.nth(stars - 1).click();
  }

  /**
   * Add notes
   */
  async addNotes(notes: string): Promise<void> {
    await this.notesTextarea.fill(notes);
  }

  /**
   * Set street status
   */
  async setStreetStatus(streetIndex: number, status: string): Promise<void> {
    await this.streetStatusSelects.nth(streetIndex).selectOption(status);
  }

  /**
   * Submit the report
   */
  async submitReport(): Promise<void> {
    this.setupAutoAcceptDialogs();
    await this.submitButton.click();
  }

  /**
   * Expect path to be selected
   */
  async expectPathSelected(pathName: string): Promise<void> {
    await expect(this.page.getByText(pathName)).toBeVisible();
  }

  /**
   * Expect submit button to be enabled
   */
  async expectSubmitEnabled(): Promise<void> {
    await expect(this.submitButton).toBeEnabled();
  }

  /**
   * Expect map to be loaded
   */
  async expectMapLoaded(): Promise<void> {
    await this.mapHelper.waitForMapLoad();
  }
}
