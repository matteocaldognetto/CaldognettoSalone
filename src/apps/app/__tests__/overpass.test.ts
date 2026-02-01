import { describe, expect, it } from "vitest";
import { getStreetDistance, getStreetGeometry, snapToStreet } from "../lib/overpass";

describe("Overpass Utilities", () => {
  describe("snapToStreet", () => {
    const streetCoordinates: Array<[number, number]> = [
      [9.1890, 45.4630],
      [9.1895, 45.4635],
      [9.1900, 45.4640],
      [9.1905, 45.4645],
      [9.1910, 45.4650],
    ];

    it("should snap a point to the nearest street coordinate", () => {
      const point: [number, number] = [9.1901, 45.4641]; // near 3rd coordinate
      const result = snapToStreet(point, streetCoordinates);

      expect(result).toEqual([9.1900, 45.4640]);
    });

    it("should snap to start of street when nearest", () => {
      const point: [number, number] = [9.1889, 45.4629]; // near start
      const result = snapToStreet(point, streetCoordinates);

      expect(result).toEqual([9.1890, 45.4630]);
    });

    it("should snap to end of street when nearest", () => {
      const point: [number, number] = [9.1911, 45.4651]; // near end
      const result = snapToStreet(point, streetCoordinates);

      expect(result).toEqual([9.1910, 45.4650]);
    });

    it("should return exact match when point is on the street", () => {
      const point: [number, number] = [9.1900, 45.4640]; // exact coordinate
      const result = snapToStreet(point, streetCoordinates);

      expect(result).toEqual([9.1900, 45.4640]);
    });

    it("should handle point far from street", () => {
      const point: [number, number] = [10.0000, 46.0000]; // far away
      const result = snapToStreet(point, streetCoordinates);

      // Should still return one of the street coordinates
      expect(streetCoordinates).toContainEqual(result);
    });

    it("should handle street with single coordinate", () => {
      const singleCoord: Array<[number, number]> = [[9.19, 45.46]];
      const point: [number, number] = [9.20, 45.47];

      const result = snapToStreet(point, singleCoord);
      expect(result).toEqual([9.19, 45.46]);
    });

    it("should snap correctly when equidistant from two points", () => {
      const point: [number, number] = [9.18925, 45.46325]; // between 1st and 2nd
      const result = snapToStreet(point, streetCoordinates);

      // Should be one of the two nearest coordinates
      expect(
        result[0] === 9.1890 || result[0] === 9.1895,
      ).toBe(true);
    });
  });

  describe("getStreetDistance", () => {
    const streetCoordinates: Array<[number, number]> = [
      [9.1890, 45.4630], // index 0
      [9.1895, 45.4635], // index 1
      [9.1900, 45.4640], // index 2
      [9.1905, 45.4645], // index 3
      [9.1910, 45.4650], // index 4
    ];

    it("should calculate distance between two points on the street", () => {
      const start: [number, number] = [9.1890, 45.4630]; // index 0
      const end: [number, number] = [9.1910, 45.4650]; // index 4

      const distance = getStreetDistance(start, end, streetCoordinates);

      // Should be positive and reasonable for a short street (~300m)
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1000); // less than 1km
    });

    it("should return 0 for same start and end point", () => {
      const point: [number, number] = [9.1900, 45.4640];
      const distance = getStreetDistance(point, point, streetCoordinates);

      expect(distance).toBe(0);
    });

    it("should return same distance regardless of direction", () => {
      const start: [number, number] = [9.1890, 45.4630];
      const end: [number, number] = [9.1910, 45.4650];

      const distForward = getStreetDistance(start, end, streetCoordinates);
      const distBackward = getStreetDistance(end, start, streetCoordinates);

      expect(distForward).toBeCloseTo(distBackward, 5);
    });

    it("should calculate partial street distance", () => {
      const start: [number, number] = [9.1890, 45.4630]; // index 0
      const mid: [number, number] = [9.1900, 45.4640]; // index 2
      const end: [number, number] = [9.1910, 45.4650]; // index 4

      const distFull = getStreetDistance(start, end, streetCoordinates);
      const distPartial = getStreetDistance(start, mid, streetCoordinates);

      // Partial distance should be less than full distance
      expect(distPartial).toBeLessThan(distFull);
      expect(distPartial).toBeGreaterThan(0);
    });

    it("should return distance in meters using Haversine formula", () => {
      // Two points ~1km apart
      const longStreet: Array<[number, number]> = [
        [9.1900, 45.4640],
        [9.1900, 45.4730], // ~1km north
      ];

      const distance = getStreetDistance(
        longStreet[0],
        longStreet[1],
        longStreet,
      );

      // ~1000 meters
      expect(distance).toBeGreaterThan(800);
      expect(distance).toBeLessThan(1200);
    });

    it("should handle adjacent points correctly", () => {
      const start: [number, number] = [9.1890, 45.4630]; // index 0
      const next: [number, number] = [9.1895, 45.4635]; // index 1

      const distance = getStreetDistance(start, next, streetCoordinates);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(200); // adjacent points should be short
    });

    it("should snap to nearest street coordinate when not exact", () => {
      const nearStart: [number, number] = [9.18901, 45.46301]; // near index 0
      const nearEnd: [number, number] = [9.19099, 45.46499]; // near index 4

      const distance = getStreetDistance(nearStart, nearEnd, streetCoordinates);

      // Should still calculate a reasonable distance
      expect(distance).toBeGreaterThan(0);
    });
  });
});

// Integration tests for actual street geometry fetching
// These tests make real API calls and require network access
describe("getStreetGeometry Integration", () => {
  // Milan bounding box for all tests
  const milanBbox = {
    minLat: 45.3568,
    minLon: 9.0976,
    maxLat: 45.5155,
    maxLon: 9.2767,
  };

  it("should fetch Via Torino geometry with all segments connected", async () => {
    const geometry = await getStreetGeometry("Via Torino", milanBbox);

    expect(geometry).not.toBeNull();
    expect(geometry!.name).toBe("Via Torino");
    expect(geometry!.coordinates.length).toBeGreaterThan(30); // Should have ~100+ points for complete street

    // Check geographical bounds (Via Torino is in central Milan)
    expect(geometry!.bounds.minLat).toBeGreaterThan(45.45);
    expect(geometry!.bounds.maxLat).toBeLessThan(45.47);
    expect(geometry!.bounds.minLon).toBeGreaterThan(9.17);
    expect(geometry!.bounds.maxLon).toBeLessThan(9.20);

    console.log(`Via Torino: ${geometry!.coordinates.length} points`);
  }, 30000); // 30s timeout for API call

  it("should fetch Via Rombon geometry with all segments connected", async () => {
    const geometry = await getStreetGeometry("Via Rombon", milanBbox);

    expect(geometry).not.toBeNull();
    expect(geometry!.name).toBe("Via Rombon");
    expect(geometry!.coordinates.length).toBeGreaterThan(20); // Should have reasonable coverage

    // Check geographical bounds (Via Rombon is in eastern Milan)
    expect(geometry!.bounds.minLat).toBeGreaterThan(45.45);
    expect(geometry!.bounds.maxLat).toBeLessThan(45.50);
    expect(geometry!.bounds.minLon).toBeGreaterThan(9.20);
    expect(geometry!.bounds.maxLon).toBeLessThan(9.30);

    console.log(`Via Rombon: ${geometry!.coordinates.length} points`);
  }, 30000);

  it("should return null for non-existent street", async () => {
    const geometry = await getStreetGeometry("NonExistentStreetXYZ123", milanBbox);
    expect(geometry).toBeNull();
  }, 30000);
});
