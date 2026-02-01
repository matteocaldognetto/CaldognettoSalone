import { Locator, Page, expect } from "@playwright/test";
import { MapHelper } from "../fixtures/map.fixture";
import { BasePage } from "./base.page";

/**
 * Trip Record Page Object
 *
 * Handles trip recording in both manual and automatic modes.
 * Maps to: /trip-record route
 */
export class TripRecordPage extends BasePage {
  // Trip info inputs
  readonly tripNameInput: Locator;
  readonly tripDescriptionInput: Locator;
  readonly durationInput: Locator;

  // Mode buttons
  readonly automaticModeButton: Locator;
  readonly manualModeIndicator: Locator;

  // Route building
  readonly streetAutocomplete: Locator;
  readonly routesList: Locator;

  // Obstacle marking
  readonly markObstaclesButton: Locator;
  readonly obstaclesModeIndicator: Locator;
  readonly obstaclesCount: Locator;

  // Weather
  readonly weatherSection: Locator;
  readonly weatherConditionSelect: Locator;
  readonly temperatureInput: Locator;
  readonly humidityInput: Locator;
  readonly windSpeedInput: Locator;

  // Rating
  readonly ratingStars: Locator;

  // Actions
  readonly reviewTripButton: Locator;
  readonly saveTripButton: Locator;
  readonly publishButton: Locator;
  readonly cancelButton: Locator;

  // Review screen
  readonly reviewScreen: Locator;
  readonly totalDistanceCard: Locator;
  readonly statisticsCards: Locator;

  // Map
  readonly mapHelper: MapHelper;

  constructor(page: Page) {
    super(page);

    // Trip info
    this.tripNameInput = page.locator("#trip-name, input[name='name']");
    this.tripDescriptionInput = page.locator(
      "#trip-description, textarea[name='description']",
    );
    this.durationInput = page.locator("#duration, input[name='duration']");

    // Modes
    this.automaticModeButton = page.getByRole("button", {
      name: /Automatic Mode/i,
    });
    this.manualModeIndicator = page.getByText(/Manual Mode/i);

    // Route building
    this.streetAutocomplete = page.locator(
      'input[placeholder*="Search for a street"], input[placeholder*="street"]',
    );
    this.routesList = page.locator(".space-y-2");

    // Obstacles
    this.markObstaclesButton = page.getByRole("button", {
      name: /Mark Obstacles/i,
    });
    this.obstaclesModeIndicator = page.getByText(/Obstacle Mode ON/i);
    this.obstaclesCount = page.locator("text=/Detected Obstacles \\(\\d+\\)/i");

    // Weather
    this.weatherSection = page.getByText(/Weather Conditions/i).locator("..");
    this.weatherConditionSelect = page.getByLabel(/Weather Condition/i);
    this.temperatureInput = page.locator(
      '#temperature, input[name="temperature"]',
    );
    this.humidityInput = page.locator('#humidity, input[name="humidity"]');
    this.windSpeedInput = page.locator('#windSpeed, input[name="windSpeed"]');

    // Rating
    this.ratingStars = page.locator('button:has(svg[class*="lucide-star"])');

    // Actions
    this.reviewTripButton = page.getByRole("button", { name: /Review Trip/i });
    this.saveTripButton = page.getByRole("button", { name: /Save as Private|Save Trip|Saving/i });
    this.publishButton = page.getByRole("button", { name: /Publish/i });
    this.cancelButton = page.getByRole("button", { name: /Cancel/i });

    // Review
    this.reviewScreen = page.locator("text=/Trip Summary|Review/i").locator("..");
    this.totalDistanceCard = page.locator("text=/Distance/i").locator("..");
    this.statisticsCards = page.locator(".rounded-lg.border.p-3");

    // Map
    this.mapHelper = new MapHelper(page);
  }

  /**
   * Navigate to trip record page
   */
  async goto(): Promise<void> {
    await this.navigateTo("/trip-record");
  }

  /**
   * Fill trip name
   */
  async fillTripName(name: string): Promise<void> {
    await this.tripNameInput.fill(name);
  }

  /**
   * Fill trip description
   */
  async fillTripDescription(description: string): Promise<void> {
    await this.tripDescriptionInput.fill(description);
  }

  /**
   * Fill basic trip info
   */
  async fillTripInfo(name: string, description?: string): Promise<void> {
    await this.fillTripName(name);
    if (description) {
      await this.fillTripDescription(description);
    }
  }

  /**
   * Set duration in minutes
   */
  async setDuration(minutes: number): Promise<void> {
    await this.durationInput.fill(String(minutes));
  }

  /**
   * Click Automatic Mode button and wait for routes to load
   * Note: This makes multiple OSRM API calls and may take time
   */
  async useAutomaticMode(): Promise<void> {
    await this.automaticModeButton.click();

    // Wait for either:
    // 1. The modal with "Automatic Mode Complete" (success case)
    // 2. Or a loading indicator that eventually leads to the modal
    
    // First, wait a moment for the API call to start
    await this.page.waitForTimeout(500);
    
    // Wait for modal to appear (Automatic Mode Complete)
    // OSRM calls can be slow, so use a longer timeout
    // Use a more flexible selector that matches partial text
    await this.page.waitForSelector("text=Automatic Mode Complete", {
      timeout: 120000, // Increased to 2 minutes for slow OSRM responses
    });

    // Click "Keep These Routes" to dismiss the modal
    await this.page.getByRole("button", { name: /Keep These Routes/i }).click();

    // Wait for modal to close
    await this.page.waitForTimeout(500);
  }

  /**
   * Set rating (1-5 stars)
   */
  async setRating(stars: number): Promise<void> {
    if (stars < 1 || stars > 5) {
      throw new Error("Rating must be between 1 and 5");
    }
    await this.ratingStars.nth(stars - 1).click();
  }

  /**
   * Enable obstacle marking mode
   */
  async enableObstacleMode(): Promise<void> {
    await this.markObstaclesButton.click();
    await expect(this.obstaclesModeIndicator).toBeVisible();
  }

  /**
   * Mark an obstacle on the map
   */
  async markObstacleAtCenter(): Promise<void> {
    await this.mapHelper.clickAtCenter();
  }

  /**
   * Fill obstacle dialog
   */
  async fillObstacleDetails(type: string, description?: string): Promise<void> {
    await this.page.selectOption("select", type);
    if (description) {
      await this.page.fill("textarea", description);
    }
    await this.page.getByRole("button", { name: /Save|Add/i }).click();
  }

  /**
   * Set weather condition
   */
  async setWeatherCondition(condition: string): Promise<void> {
    await this.weatherConditionSelect.selectOption(condition);
  }

  /**
   * Set temperature
   */
  async setTemperature(celsius: number): Promise<void> {
    await this.temperatureInput.fill(String(celsius));
  }

  /**
   * Click Review Trip button
   */
  async reviewTrip(): Promise<void> {
    await this.reviewTripButton.click();
    // Wait for review screen (modal) to appear
    await this.totalDistanceCard.waitFor({ state: "visible", timeout: 5000 });
  }

  /**
   * Save trip (from review screen)
   */
  async saveTrip(): Promise<void> {
    // Set up dialog listener before clicking
    const dialogPromise = this.page.waitForEvent("dialog");
    await this.saveTripButton.click();
    
    // Wait for result dialog
    const dialog = await dialogPromise;
    const message = dialog.message();
    
    // Verify success
    if (!message.includes("saved with")) {
      console.error(`[Test] Save failed with alert: ${message}`);
      await dialog.accept().catch(() => {});
      throw new Error(`Trip save failed: ${message}`);
    }
    
    await dialog.accept().catch(() => {});
  }

  /**
   * Publish trip (from review screen)
   */
  async publishTrip(): Promise<void> {
    this.setupAutoAcceptDialogs();
    await this.publishButton.click();
  }

  /**
   * Get route count
   */
  async getRouteCount(): Promise<number> {
    // Routes are displayed as cards with street names
    // In automatic mode: bg-white border border-blue-200
    // In manual mode: p-3 border rounded-lg bg-white
    const automaticRoutes = this.page.locator(".border-blue-200.bg-white");
    const manualRoutes = this.page.locator(".rounded-lg.border.bg-white");

    const autoCount = await automaticRoutes.count();
    const manualCount = await manualRoutes.count();

    return Math.max(autoCount, manualCount);
  }

  /**
   * Get obstacle count
   */
  async getObstacleCount(): Promise<number> {
    const countText = await this.obstaclesCount.textContent();
    if (countText) {
      const match = countText.match(/\((\d+)\)/);
      return match ? parseInt(match[1]) : 0;
    }
    return 0;
  }

  /**
   * Expect routes to be loaded
   */
  async expectRoutesCount(count: number): Promise<void> {
    const routes = this.page.locator(".rounded-lg.border.bg-white");
    await expect(routes).toHaveCount(count);
  }

  /**
   * Expect review screen to be visible
   */
  async expectReviewScreen(): Promise<void> {
    await expect(this.totalDistanceCard).toBeVisible();
  }

  /**
   * Expect statistics to be displayed
   */
  async expectStatistics(): Promise<void> {
    await expect(this.totalDistanceCard).toBeVisible();
    await expect(this.page.getByText(/Duration/i)).toBeVisible();
  }

  /**
   * Expect weather section to be visible
   */
  async expectWeatherSection(): Promise<void> {
    await expect(this.weatherSection).toBeVisible();
  }

  /**
   * Expect Review Trip button to be disabled
   */
  async expectReviewButtonDisabled(): Promise<void> {
    await expect(this.reviewTripButton).toBeDisabled();
  }

  /**
   * Expect Review Trip button to be enabled
   */
  async expectReviewButtonEnabled(): Promise<void> {
    await expect(this.reviewTripButton).toBeEnabled();
  }
}
