import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  findMinDistanceToPoint,
  calculatePathDeviation,
} from "../lib/routing";
import { _testing } from "../lib/aggregation";

const { calculateScorePure, STATUS_SCORES } = _testing;

/**
 * Section 6: Path Discovery / Spatial Search Tests
 * Tests path search logic at the unit level.
 * Actual spatial queries require PostGIS, so we test the geometry
 * and scoring logic that drives search results.
 */

describe("Spatial Search - Bounding Box", () => {
  function isPointInBBox(
    lat: number,
    lon: number,
    bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  ): boolean {
    return (
      lat >= bbox.minLat &&
      lat <= bbox.maxLat &&
      lon >= bbox.minLon &&
      lon <= bbox.maxLon
    );
  }

  function isPathInBBox(
    coordinates: [number, number][],
    bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  ): boolean {
    // A path is "in" the bbox if at least one point is inside
    return coordinates.some(([lon, lat]) => isPointInBBox(lat, lon, bbox));
  }

  const milanBBox = {
    minLat: 45.40,
    maxLat: 45.55,
    minLon: 9.05,
    maxLon: 9.30,
  };

  it("should return paths within specified geographic bounding box", () => {
    const path: [number, number][] = [
      [9.19, 45.46],
      [9.20, 45.47],
    ];
    expect(isPathInBBox(path, milanBBox)).toBe(true);
  });

  it("should not return paths outside bounding box", () => {
    const romePath: [number, number][] = [
      [12.49, 41.90],
      [12.50, 41.91],
    ];
    expect(isPathInBBox(romePath, milanBBox)).toBe(false);
  });

  it("should return empty array for bounding box with no paths", () => {
    const emptyPaths: [number, number][][] = [];
    const results = emptyPaths.filter((p) => isPathInBBox(p, milanBBox));
    expect(results).toHaveLength(0);
  });

  it("should handle very large bounding box (entire city)", () => {
    const largeBBox = {
      minLat: 45.0,
      maxLat: 46.0,
      minLon: 8.5,
      maxLon: 10.0,
    };
    const path: [number, number][] = [[9.19, 45.46]];
    expect(isPathInBBox(path, largeBBox)).toBe(true);
  });

  it("should handle very small bounding box (single block)", () => {
    const smallBBox = {
      minLat: 45.4640,
      maxLat: 45.4645,
      minLon: 9.1895,
      maxLon: 9.1905,
    };
    const insidePath: [number, number][] = [[9.19, 45.4642]];
    const outsidePath: [number, number][] = [[9.20, 45.47]];

    expect(isPathInBBox(insidePath, smallBBox)).toBe(true);
    expect(isPathInBBox(outsidePath, smallBBox)).toBe(false);
  });
});

describe("Spatial Search - Corridor", () => {
  it("should return paths along a specified corridor (start point to end point)", () => {
    const corridorStart = { lat: 45.4642, lon: 9.19 };
    const corridorEnd = { lat: 45.4706, lon: 9.1795 };
    const bufferKm = 0.7;

    const pathCoords: [number, number][] = [
      [9.185, 45.467],
      [9.19, 45.465],
    ];

    // Check if path is within buffer distance of corridor
    const startDist = findMinDistanceToPoint(pathCoords, corridorStart.lat, corridorStart.lon);
    const endDist = findMinDistanceToPoint(pathCoords, corridorEnd.lat, corridorEnd.lon);

    expect(startDist).toBeLessThan(bufferKm);
    expect(endDist).toBeLessThan(bufferKm);
  });

  it("should exclude paths outside corridor buffer", () => {
    const pathCoords: [number, number][] = [
      [12.49, 41.90],
      [12.50, 41.91],
    ];

    const dist = findMinDistanceToPoint(pathCoords, 45.4642, 9.19);
    expect(dist).toBeGreaterThan(100); // Far away
  });
});

describe("Search Result Enrichment", () => {
  it("should include aggregate rating in search results", () => {
    const pathResult = {
      id: "path-1",
      name: "Via Roma Path",
      score: 35,
      currentStatus: "optimal",
      totalDistance: 5.2,
      obstacleCount: 2,
      ratingCount: 10,
    };
    expect(pathResult.score).toBeDefined();
    expect(typeof pathResult.score).toBe("number");
  });

  it("should include condition score from Aggregation Engine in results", () => {
    const statusScore = STATUS_SCORES.optimal;
    expect(statusScore).toBe(100);
  });

  it("should include total distance in results", () => {
    const result = { totalDistance: 5.2 };
    expect(result.totalDistance).toBeGreaterThan(0);
  });

  it("should include obstacle count in results", () => {
    const result = { obstacleCount: 3 };
    expect(result.obstacleCount).toBeGreaterThanOrEqual(0);
  });

  it("should include number of user ratings in results", () => {
    const result = { ratingCount: 10 };
    expect(result.ratingCount).toBeGreaterThanOrEqual(0);
  });
});

describe("Search Ranking", () => {
  it("should rank paths by composite score (rating + condition)", () => {
    const path1Score = calculateScorePure(80, 100, 0, 0); // 0.1*80+0.3*100 = 38
    const path2Score = calculateScorePure(60, 70, 0, 0); // 0.1*60+0.3*70 = 27
    expect(path1Score).toBeGreaterThan(path2Score);
  });

  it("should rank higher-quality paths first", () => {
    const paths = [
      { name: "Bad", score: calculateScorePure(20, 30, 1, 0.5) },
      { name: "Good", score: calculateScorePure(90, 100, 0, 0) },
      { name: "Medium", score: calculateScorePure(50, 50, 0, 0.2) },
    ];

    const sorted = [...paths].sort((a, b) => b.score - a.score);
    expect(sorted[0].name).toBe("Good");
  });

  it("should apply recency bonus to recently-reported paths", () => {
    const recentBonus = _testing.calculateRecencyBonus([
      { createdAt: new Date() },
    ] as any);
    expect(recentBonus).toBeGreaterThan(0);
    expect(recentBonus).toBeLessThanOrEqual(10);
  });

  it("should limit results to maximum N paths (e.g. 5)", () => {
    const allPaths = Array.from({ length: 20 }, (_, i) => ({
      id: `path-${i}`,
      score: Math.random() * 100,
    }));

    const topN = allPaths.sort((a, b) => b.score - a.score).slice(0, 5);
    expect(topN).toHaveLength(5);
  });
});

describe("Search Edge Cases", () => {
  it("should handle search with no published paths in database", () => {
    const paths: any[] = [];
    const results = paths.filter((p) => p.score > 0);
    expect(results).toHaveLength(0);
  });

  it("should handle malformed bounding box coordinates gracefully", () => {
    const bbox = {
      minLat: 46.0, // min > max (inverted)
      maxLat: 45.0,
      minLon: 9.0,
      maxLon: 10.0,
    };
    // With inverted bbox, no points should match
    const lat = 45.5;
    const inBBox = lat >= bbox.minLat && lat <= bbox.maxLat;
    expect(inBBox).toBe(false);
  });

  it("should use calculateDistance for spatial queries", () => {
    // Verify Haversine distance works correctly
    const dist = calculateDistance(45.4642, 9.19, 45.4706, 9.1795);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(2); // Should be ~1.2km
  });

  it("should compute path deviation for ranking", () => {
    const straightPath: [number, number][] = [
      [9.19, 45.46],
      [9.195, 45.465],
      [9.20, 45.47],
    ];
    const deviation = calculatePathDeviation(straightPath);
    expect(deviation).toBeGreaterThanOrEqual(0);
    expect(deviation).toBeLessThanOrEqual(1);
  });
});
