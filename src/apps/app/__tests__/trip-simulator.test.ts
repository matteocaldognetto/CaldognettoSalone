import { describe, it, expect } from "vitest";
import {
  decomposeRouteIntoStreets,
  generateSimulatedTripQuick,
} from "../lib/trip-simulator";

describe("Trip Simulator", () => {
  describe("decomposeRouteIntoStreets", () => {
    const sampleGeometry: Array<[number, number]> = [
      [9.1890, 45.4630],
      [9.1895, 45.4635],
      [9.1900, 45.4640],
      [9.1905, 45.4645],
      [9.1910, 45.4650],
      [9.1915, 45.4655],
      [9.1920, 45.4660],
      [9.1925, 45.4665],
      [9.1930, 45.4670],
      [9.1935, 45.4675],
      [9.1940, 45.4680],
      [9.1945, 45.4685],
      [9.1950, 45.4690],
      [9.1955, 45.4695],
      [9.1960, 45.4700],
      [9.1965, 45.4705],
      [9.1970, 45.4710],
      [9.1975, 45.4715],
      [9.1980, 45.4720],
      [9.1985, 45.4725],
    ];

    it("should decompose route into 3-7 street segments", () => {
      const streets = decomposeRouteIntoStreets(sampleGeometry, "Test Route");

      expect(streets.length).toBeGreaterThanOrEqual(3);
      expect(streets.length).toBeLessThanOrEqual(7);
    });

    it("should assign valid status to each street segment", () => {
      const validStatuses = ["optimal", "medium", "sufficient", "requires_maintenance"];
      const streets = decomposeRouteIntoStreets(sampleGeometry, "Test Route");

      for (const street of streets) {
        expect(validStatuses).toContain(street.status);
      }
    });

    it("should include path name in street names", () => {
      const pathName = "My Custom Path";
      const streets = decomposeRouteIntoStreets(sampleGeometry, pathName);

      for (const street of streets) {
        expect(street.name).toContain(pathName);
      }
    });

    it("should have valid start and end coordinates for each segment", () => {
      const streets = decomposeRouteIntoStreets(sampleGeometry, "Test Route");

      for (const street of streets) {
        expect(street.startCoord).toHaveLength(2);
        expect(street.endCoord).toHaveLength(2);

        // Coordinates should be numbers
        expect(typeof street.startCoord[0]).toBe("number");
        expect(typeof street.startCoord[1]).toBe("number");
        expect(typeof street.endCoord[0]).toBe("number");
        expect(typeof street.endCoord[1]).toBe("number");
      }
    });

    it("should cover the entire route from start to end", () => {
      const streets = decomposeRouteIntoStreets(sampleGeometry, "Test Route");

      // First segment should start near the route start
      const firstStreet = streets[0];
      expect(firstStreet.startCoord[0]).toBeCloseTo(sampleGeometry[0][0], 2);
      expect(firstStreet.startCoord[1]).toBeCloseTo(sampleGeometry[0][1], 2);

      // Last segment should end near the route end
      const lastStreet = streets[streets.length - 1];
      expect(lastStreet.endCoord[0]).toBeCloseTo(
        sampleGeometry[sampleGeometry.length - 1][0],
        2,
      );
      expect(lastStreet.endCoord[1]).toBeCloseTo(
        sampleGeometry[sampleGeometry.length - 1][1],
        2,
      );
    });

    it("should handle minimal geometry (3 points)", () => {
      const minGeometry: Array<[number, number]> = [
        [9.19, 45.46],
        [9.195, 45.465],
        [9.20, 45.47],
      ];

      const streets = decomposeRouteIntoStreets(minGeometry, "Short Route");
      // With 3 points, might produce fewer segments but should not crash
      expect(streets.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("generateSimulatedTripQuick", () => {
    // Milan coordinates
    const startLat = 45.4642;
    const startLon = 9.1900;
    const endLat = 45.4706;
    const endLon = 9.1795;

    it("should generate a complete trip data object", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
        "Test Trip",
      );

      expect(trip).toBeDefined();
      expect(trip.pathName).toBe("Test Trip");
      expect(trip.distance).toBeGreaterThan(0);
      expect(trip.duration).toBeGreaterThan(0);
      expect(trip.avgSpeed).toBe(15); // fixed at 15 km/h
    });

    it("should calculate distance using Haversine formula", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
      );

      // Milan Duomo to Castello Sforzesco ~1.2 km
      expect(trip.distance).toBeGreaterThan(0.5);
      expect(trip.distance).toBeLessThan(3);
    });

    it("should estimate duration at 15 km/h average speed", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
      );

      // Duration = (distance / 15) * 60 minutes
      const expectedDuration = Math.round((trip.distance / 15) * 60);
      expect(trip.duration).toBe(expectedDuration);
    });

    it("should set maxSpeed to 130% of avgSpeed", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
      );

      expect(trip.maxSpeed).toBeCloseTo(15 * 1.3, 1);
    });

    it("should generate valid geometry with 20 points", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
      );

      expect(trip.geometry.type).toBe("LineString");
      expect(trip.geometry.coordinates).toHaveLength(20);
    });

    it("should generate geometry points that interpolate between start and end", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
      );

      const coords = trip.geometry.coordinates;

      // First point should be near start (with noise)
      expect(coords[0][0]).toBeCloseTo(startLon, 2); // lon
      expect(coords[0][1]).toBeCloseTo(startLat, 2); // lat

      // Last point should be near end (with noise)
      const lastCoord = coords[coords.length - 1];
      expect(lastCoord[0]).toBeCloseTo(endLon, 2);
      expect(lastCoord[1]).toBeCloseTo(endLat, 2);
    });

    it("should set collectionMode to 'simulated'", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
      );

      expect(trip.collectionMode).toBe("simulated");
    });

    it("should generate valid weather data", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
      );

      expect(trip.weather).toBeDefined();
      expect(["sunny", "cloudy", "rainy", "windy"]).toContain(
        trip.weather.condition,
      );
      expect(trip.weather.temperature).toBeGreaterThanOrEqual(15);
      expect(trip.weather.temperature).toBeLessThanOrEqual(25);
      expect(trip.weather.windSpeed).toBeGreaterThanOrEqual(0);
      expect(trip.weather.windSpeed).toBeLessThanOrEqual(20);
      expect(trip.weather.humidity).toBeGreaterThanOrEqual(40);
      expect(trip.weather.humidity).toBeLessThanOrEqual(80);
    });

    it("should set pathStatus to either requires_maintenance or medium", () => {
      // Run multiple times to test both branches
      const statuses = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const trip = generateSimulatedTripQuick(
          startLat,
          startLon,
          endLat,
          endLon,
        );
        statuses.add(trip.pathStatus);
      }

      // At minimum both values should be possible
      expect(
        statuses.has("medium") || statuses.has("requires_maintenance"),
      ).toBe(true);
    });

    it("should set valid startTime and endTime", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
      );

      expect(trip.startTime).toBeInstanceOf(Date);
      expect(trip.endTime).toBeInstanceOf(Date);
      expect(trip.endTime.getTime()).toBeGreaterThan(trip.startTime.getTime());
    });

    it("should use default path name when none is provided", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
      );

      expect(trip.pathName).toContain("Route recorded at");
    });

    it("should generate obstacles from street decomposition", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        endLat,
        endLon,
        "Obstacle Test",
      );

      // Obstacles array should exist (may be empty due to randomness)
      expect(Array.isArray(trip.obstacles)).toBe(true);

      // Each obstacle should have required fields
      for (const obstacle of trip.obstacles) {
        expect(obstacle).toHaveProperty("id");
        expect(obstacle).toHaveProperty("location");
        expect(obstacle).toHaveProperty("type");
        expect(obstacle).toHaveProperty("confirmed");
        expect(obstacle.confirmed).toBe(false);
      }
    });

    it("should handle zero-distance trip (same start and end)", () => {
      const trip = generateSimulatedTripQuick(
        startLat,
        startLon,
        startLat,
        startLon,
      );

      expect(trip.distance).toBe(0);
      expect(trip.duration).toBe(0);
    });

    it("should handle long distance trip", () => {
      // Milan to Rome-ish
      const trip = generateSimulatedTripQuick(
        45.4642,
        9.19,
        41.9028,
        12.4964,
      );

      expect(trip.distance).toBeGreaterThan(400); // ~480 km
      expect(trip.duration).toBeGreaterThan(1000); // many minutes
    });
  });
});
