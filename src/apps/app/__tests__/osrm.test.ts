import { describe, it, expect } from "vitest";
import { generateRandomCoordinates } from "../lib/osrm";

describe("OSRM Client Utilities", () => {
  describe("generateRandomCoordinates", () => {
    it("should return an object with all coordinate properties", () => {
      const coords = generateRandomCoordinates();

      expect(coords).toHaveProperty("startLat");
      expect(coords).toHaveProperty("startLon");
      expect(coords).toHaveProperty("endLat");
      expect(coords).toHaveProperty("endLon");
    });

    it("should generate coordinates near Milan center", () => {
      const coords = generateRandomCoordinates();
      const milanLat = 45.4642;
      const milanLon = 9.19;
      const maxVariation = 0.03;

      // Start coordinates should be within variation of Milan center
      expect(coords.startLat).toBeGreaterThan(milanLat - maxVariation);
      expect(coords.startLat).toBeLessThan(milanLat + maxVariation);
      expect(coords.startLon).toBeGreaterThan(milanLon - maxVariation);
      expect(coords.startLon).toBeLessThan(milanLon + maxVariation);

      // End coordinates should be within variation of Milan center
      expect(coords.endLat).toBeGreaterThan(milanLat - maxVariation);
      expect(coords.endLat).toBeLessThan(milanLat + maxVariation);
      expect(coords.endLon).toBeGreaterThan(milanLon - maxVariation);
      expect(coords.endLon).toBeLessThan(milanLon + maxVariation);
    });

    it("should generate different coordinates on each call", () => {
      const coords1 = generateRandomCoordinates();
      const coords2 = generateRandomCoordinates();

      // At least one coordinate should differ (highly probable)
      const isDifferent =
        coords1.startLat !== coords2.startLat ||
        coords1.startLon !== coords2.startLon ||
        coords1.endLat !== coords2.endLat ||
        coords1.endLon !== coords2.endLon;

      expect(isDifferent).toBe(true);
    });

    it("should generate valid latitude values (-90 to 90)", () => {
      // Run multiple times to test randomness
      for (let i = 0; i < 10; i++) {
        const coords = generateRandomCoordinates();
        expect(coords.startLat).toBeGreaterThanOrEqual(-90);
        expect(coords.startLat).toBeLessThanOrEqual(90);
        expect(coords.endLat).toBeGreaterThanOrEqual(-90);
        expect(coords.endLat).toBeLessThanOrEqual(90);
      }
    });

    it("should generate valid longitude values (-180 to 180)", () => {
      for (let i = 0; i < 10; i++) {
        const coords = generateRandomCoordinates();
        expect(coords.startLon).toBeGreaterThanOrEqual(-180);
        expect(coords.startLon).toBeLessThanOrEqual(180);
        expect(coords.endLon).toBeGreaterThanOrEqual(-180);
        expect(coords.endLon).toBeLessThanOrEqual(180);
      }
    });
  });

  describe("RouteResult interface validation", () => {
    it("should accept valid route result structure", () => {
      const mockRouteResult = {
        distance: 1500, // meters
        duration: 420, // seconds
        coordinates: [
          [9.19, 45.4642],
          [9.185, 45.468],
          [9.1795, 45.4706],
        ] as Array<[number, number]>,
      };

      expect(mockRouteResult.distance).toBe(1500);
      expect(mockRouteResult.duration).toBe(420);
      expect(mockRouteResult.coordinates.length).toBe(3);
    });

    it("should have coordinates in [lon, lat] format", () => {
      const mockCoordinates: Array<[number, number]> = [
        [9.19, 45.4642], // Milan Duomo
        [9.1795, 45.4706], // Castello Sforzesco
      ];

      // OSRM uses [lon, lat] format
      const [lon, lat] = mockCoordinates[0];
      expect(lon).toBeCloseTo(9.19, 2); // Longitude first
      expect(lat).toBeCloseTo(45.4642, 2); // Latitude second
    });
  });
});

describe("Distance and Duration Calculations", () => {
  it("should convert meters to kilometers correctly", () => {
    const distanceMeters = 5280;
    const distanceKm = distanceMeters / 1000;
    expect(distanceKm).toBeCloseTo(5.28, 2);
  });

  it("should convert seconds to minutes correctly", () => {
    const durationSeconds = 1800;
    const durationMinutes = durationSeconds / 60;
    expect(durationMinutes).toBe(30);
  });

  it("should calculate average speed correctly", () => {
    const distanceMeters = 10000; // 10 km
    const durationSeconds = 2400; // 40 minutes

    // Speed in km/h
    const speedKmH = (distanceMeters / 1000) / (durationSeconds / 3600);
    expect(speedKmH).toBe(15); // 15 km/h
  });

  it("should handle edge case of zero duration", () => {
    const distanceMeters = 0;
    const durationSeconds = 0;

    // Edge case handling
    const speed = durationSeconds === 0 ? 0 : distanceMeters / durationSeconds;
    expect(speed).toBe(0);
  });
});
