import { describe, it, expect } from "vitest";
import {
  filterSuggestions,
  shouldFetchSuggestions,
  handleKeyNavigation,
} from "../lib/autocomplete-utils";
import {
  formatDuration,
  formatDistance,
  calculateAverageSpeed,
} from "../lib/format-utils";
import { getStatusColor, calculateBounds } from "../lib/map-utils";
import { validateReportForm } from "../lib/report-utils";

/**
 * Component logic tests
 * These tests verify the business logic used by React components
 * by importing the real utility functions.
 */

describe("StreetAutocomplete Logic", () => {
  describe("Suggestion filtering", () => {
    const mockPhotonResponse = {
      features: [
        {
          properties: { name: "Via Roma", type: "street" },
          geometry: { coordinates: [9.19, 45.46] },
        },
        {
          properties: { name: "Piazza Duomo", type: "square" },
          geometry: { coordinates: [9.19, 45.46] },
        },
        {
          properties: { name: "Via Milano", type: "road" },
          geometry: { coordinates: [9.18, 45.47] },
        },
        {
          properties: { name: "Corso Buenos Aires", type: "residential" },
          geometry: { coordinates: [9.21, 45.48] },
        },
        {
          properties: { name: "Stazione Centrale", type: "station" },
          geometry: { coordinates: [9.20, 45.48] },
        },
      ],
    };

    it("should filter only street, road, and residential types", () => {
      const filtered = filterSuggestions(mockPhotonResponse.features);

      expect(filtered.length).toBe(3);
      expect(filtered.map((s) => s.name)).toEqual([
        "Via Roma",
        "Via Milano",
        "Corso Buenos Aires",
      ]);
    });

    it("should exclude non-street types like square and station", () => {
      const filtered = filterSuggestions(mockPhotonResponse.features);
      const types = filtered.map((s) => s.type);

      expect(types).not.toContain("square");
      expect(types).not.toContain("station");
    });

    it("should map coordinates correctly (swap lon/lat)", () => {
      const filtered = filterSuggestions(mockPhotonResponse.features);
      const viaRoma = filtered.find((s) => s.name === "Via Roma");

      // Photon returns [lon, lat], we map to {lat, lon}
      expect(viaRoma?.lat).toBe(45.46); // Second element -> lat
      expect(viaRoma?.lon).toBe(9.19); // First element -> lon
    });

    it("should handle empty features array", () => {
      const filtered = filterSuggestions([]);
      expect(filtered).toEqual([]);
    });
  });

  describe("Search query validation", () => {
    it("should not search for single character queries", () => {
      expect(shouldFetchSuggestions("V")).toBe(false);
      expect(shouldFetchSuggestions("a")).toBe(false);
    });

    it("should search for queries with 2+ characters", () => {
      expect(shouldFetchSuggestions("Vi")).toBe(true);
      expect(shouldFetchSuggestions("Via")).toBe(true);
      expect(shouldFetchSuggestions("Via Roma")).toBe(true);
    });

    it("should not search for whitespace-only queries", () => {
      expect(shouldFetchSuggestions("   ")).toBe(false);
      expect(shouldFetchSuggestions(" ")).toBe(false);
    });

    it("should trim whitespace before checking length", () => {
      expect(shouldFetchSuggestions(" V ")).toBe(false); // "V" after trim
      expect(shouldFetchSuggestions(" Vi ")).toBe(true); // "Vi" after trim
    });
  });

  describe("Keyboard navigation", () => {
    it("should move down in the list with ArrowDown", () => {
      expect(handleKeyNavigation("ArrowDown", 0, 5)).toBe(1);
      expect(handleKeyNavigation("ArrowDown", 2, 5)).toBe(3);
    });

    it("should wrap to first item when at end", () => {
      expect(handleKeyNavigation("ArrowDown", 4, 5)).toBe(0);
    });

    it("should move up in the list with ArrowUp", () => {
      expect(handleKeyNavigation("ArrowUp", 3, 5)).toBe(2);
      expect(handleKeyNavigation("ArrowUp", 1, 5)).toBe(0);
    });

    it("should wrap to last item when at beginning", () => {
      expect(handleKeyNavigation("ArrowUp", 0, 5)).toBe(4);
    });

    it("should return -1 for empty suggestions", () => {
      expect(handleKeyNavigation("ArrowDown", -1, 0)).toBe(-1);
    });
  });
});

describe("Trip Statistics Calculations", () => {
  describe("formatDuration", () => {
    it("should format seconds only", () => {
      expect(formatDuration(45)).toBe("45s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(125)).toBe("2m 5s");
      expect(formatDuration(600)).toBe("10m 0s");
    });

    it("should format hours and minutes", () => {
      expect(formatDuration(3665)).toBe("1h 1m");
      expect(formatDuration(7200)).toBe("2h 0m");
    });

    it("should handle zero", () => {
      expect(formatDuration(0)).toBe("0s");
    });
  });

  describe("formatDistance", () => {
    it("should format meters for short distances", () => {
      expect(formatDistance(500)).toBe("500 m");
      expect(formatDistance(999)).toBe("999 m");
    });

    it("should format kilometers for longer distances", () => {
      expect(formatDistance(1000)).toBe("1.00 km");
      expect(formatDistance(5280)).toBe("5.28 km");
    });

    it("should round meters to nearest integer", () => {
      expect(formatDistance(123.7)).toBe("124 m");
    });
  });

  describe("calculateAverageSpeed", () => {
    it("should calculate average cycling speed", () => {
      // 10 km in 40 minutes = 15 km/h
      const speed = calculateAverageSpeed(10000, 2400);
      expect(speed).toBe(15);
    });

    it("should handle zero duration", () => {
      expect(calculateAverageSpeed(1000, 0)).toBe(0);
    });

    it("should handle very short trips", () => {
      // 100m in 30 seconds
      const speed = calculateAverageSpeed(100, 30);
      expect(speed).toBe(12); // 12 km/h
    });
  });
});

describe("Map Utilities", () => {
  describe("Status color mapping", () => {
    it("should return green for optimal status", () => {
      expect(getStatusColor("optimal")).toBe("#22c55e");
    });

    it("should return yellow for medium status", () => {
      expect(getStatusColor("medium")).toBe("#eab308");
    });

    it("should return orange for sufficient status", () => {
      expect(getStatusColor("sufficient")).toBe("#f97316");
    });

    it("should return red for requires_maintenance status", () => {
      expect(getStatusColor("requires_maintenance")).toBe("#ef4444");
    });

    it("should return gray for null status", () => {
      expect(getStatusColor(null)).toBe("#9ca3af");
    });

    it("should return gray for unknown status", () => {
      expect(getStatusColor("invalid")).toBe("#9ca3af");
    });
  });

  describe("Bounding box calculation", () => {
    it("should calculate bounds for route coordinates", () => {
      const coords: Array<[number, number]> = [
        [9.19, 45.46],
        [9.18, 45.47],
        [9.21, 45.45],
      ];

      const bounds = calculateBounds(coords);

      expect(bounds[0][0]).toBe(45.45); // min lat
      expect(bounds[0][1]).toBe(9.18); // min lon
      expect(bounds[1][0]).toBe(45.47); // max lat
      expect(bounds[1][1]).toBe(9.21); // max lon
    });

    it("should handle single point", () => {
      const coords: Array<[number, number]> = [[9.19, 45.46]];
      const bounds = calculateBounds(coords);

      expect(bounds[0]).toEqual([45.46, 9.19]);
      expect(bounds[1]).toEqual([45.46, 9.19]);
    });

    it("should handle empty coordinates", () => {
      const bounds = calculateBounds([]);
      expect(bounds).toEqual([
        [0, 0],
        [0, 0],
      ]);
    });
  });
});

describe("Report Form Validation", () => {
  it("should accept valid trip-based report", () => {
    const errors = validateReportForm({
      status: "optimal",
      tripRouteId: "route-123",
    });
    expect(errors).toEqual([]);
  });

  it("should accept valid street-based report", () => {
    const errors = validateReportForm({
      status: "medium",
      streetName: "Via Roma",
      lat: 45.46,
      lon: 9.19,
    });
    expect(errors).toEqual([]);
  });

  it("should reject report without tripRouteId or location", () => {
    const errors = validateReportForm({
      status: "optimal",
    });
    expect(errors).toContain("Street name is required for standalone reports");
    expect(errors).toContain("Location is required for standalone reports");
  });

  it("should reject invalid status", () => {
    const errors = validateReportForm({
      status: "excellent", // invalid
      tripRouteId: "route-123",
    });
    expect(errors).toContain("Invalid status value");
  });

  it("should reject empty street name", () => {
    const errors = validateReportForm({
      status: "optimal",
      streetName: "   ", // whitespace only
      lat: 45.46,
      lon: 9.19,
    });
    expect(errors).toContain("Street name is required for standalone reports");
  });
});
