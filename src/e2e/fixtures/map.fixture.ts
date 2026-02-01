import { Page, Locator, expect } from "@playwright/test";

/**
 * Map Helper Fixture
 *
 * Provides utilities for interacting with Leaflet maps in e2e tests.
 * Handles map loading, clicking, and marker/path assertions.
 */
export class MapHelper {
  private mapContainer: Locator;

  constructor(private page: Page) {
    this.mapContainer = page.locator(".leaflet-container");
  }

  /**
   * Waits for the map to be fully loaded with tiles
   */
  async waitForMapLoad(timeout = 10000): Promise<void> {
    // Wait for map container
    await this.mapContainer.waitFor({ state: "visible", timeout });

    // Wait for tiles to load
    await this.page.waitForFunction(
      () => {
        const tiles = document.querySelectorAll(".leaflet-tile-loaded");
        return tiles.length > 0;
      },
      { timeout },
    );
  }

  /**
   * Clicks on the map at a specific position (relative to map container)
   */
  async clickAtPosition(x: number, y: number): Promise<void> {
    await this.waitForMapLoad();
    await this.mapContainer.click({ position: { x, y } });
  }

  /**
   * Clicks at the center of the map
   */
  async clickAtCenter(): Promise<void> {
    await this.waitForMapLoad();
    const box = await this.mapContainer.boundingBox();
    if (box) {
      await this.clickAtPosition(box.width / 2, box.height / 2);
    }
  }

  /**
   * Clicks at a random position on the map
   */
  async clickAtRandomPosition(): Promise<void> {
    await this.waitForMapLoad();
    const box = await this.mapContainer.boundingBox();
    if (box) {
      // Click somewhere in the middle third of the map
      const x = box.width / 3 + Math.random() * (box.width / 3);
      const y = box.height / 3 + Math.random() * (box.height / 3);
      await this.clickAtPosition(x, y);
    }
  }

  /**
   * Gets all visible path/polyline elements on the map
   */
  async getPaths(): Promise<Locator> {
    await this.waitForMapLoad();
    return this.page.locator(".leaflet-interactive");
  }

  /**
   * Gets all visible markers on the map
   */
  async getMarkers(): Promise<Locator> {
    await this.waitForMapLoad();
    return this.page.locator(".leaflet-marker-icon");
  }

  /**
   * Asserts that at least one path is displayed on the map
   */
  async expectPathDisplayed(): Promise<void> {
    await this.waitForMapLoad();
    const paths = await this.getPaths();
    await expect(paths.first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Asserts that at least one marker is displayed on the map
   */
  async expectMarkerDisplayed(): Promise<void> {
    await this.waitForMapLoad();
    const markers = await this.getMarkers();
    await expect(markers.first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Asserts that a specific number of markers are displayed
   */
  async expectMarkerCount(count: number): Promise<void> {
    await this.waitForMapLoad();
    const markers = await this.getMarkers();
    await expect(markers).toHaveCount(count);
  }

  /**
   * Zooms the map in
   */
  async zoomIn(): Promise<void> {
    const zoomInButton = this.page.locator(".leaflet-control-zoom-in");
    await zoomInButton.click();
    // Wait for zoom animation
    await this.page.waitForTimeout(300);
  }

  /**
   * Zooms the map out
   */
  async zoomOut(): Promise<void> {
    const zoomOutButton = this.page.locator(".leaflet-control-zoom-out");
    await zoomOutButton.click();
    // Wait for zoom animation
    await this.page.waitForTimeout(300);
  }

  /**
   * Pans the map by dragging
   */
  async panMap(deltaX: number, deltaY: number): Promise<void> {
    await this.waitForMapLoad();
    const box = await this.mapContainer.boundingBox();
    if (box) {
      const startX = box.width / 2;
      const startY = box.height / 2;

      await this.page.mouse.move(startX, startY);
      await this.page.mouse.down();
      await this.page.mouse.move(startX + deltaX, startY + deltaY);
      await this.page.mouse.up();

      // Wait for pan animation
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Gets the map container locator
   */
  getContainer(): Locator {
    return this.mapContainer;
  }
}

/**
 * Creates a MapHelper instance for the given page
 */
export function createMapHelper(page: Page): MapHelper {
  return new MapHelper(page);
}
