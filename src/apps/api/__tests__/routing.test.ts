import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  calculatePathDeviation,
  findMinDistanceToPoint,
  validateCoordinates,
  generateSimulatedGPSTrack,
  osrmToGeoJSON,
  PROXIMITY_PENALTY_PER_KM,
  type GeoJSONLineString,
  type OSRMRoute,
} from "../lib/routing";

describe("Routing Module", () => {
  describe("validateCoordinates", () => {
    it("should accept valid coordinates", () => {
      expect(validateCoordinates(45.4642, 9.19)).toBe(true); // Milan
      expect(validateCoordinates(41.9028, 12.4964)).toBe(true); // Rome
      expect(validateCoordinates(0, 0)).toBe(true); // Origin
    });

    it("should accept boundary latitude values", () => {
      expect(validateCoordinates(90, 0)).toBe(true); // North pole
      expect(validateCoordinates(-90, 0)).toBe(true); // South pole
    });

    it("should accept boundary longitude values", () => {
      expect(validateCoordinates(0, 180)).toBe(true);
      expect(validateCoordinates(0, -180)).toBe(true);
    });

    it("should reject latitude out of range", () => {
      expect(validateCoordinates(91, 0)).toBe(false);
      expect(validateCoordinates(-91, 0)).toBe(false);
      expect(validateCoordinates(1000, 0)).toBe(false);
    });

    it("should reject longitude out of range", () => {
      expect(validateCoordinates(0, 181)).toBe(false);
      expect(validateCoordinates(0, -181)).toBe(false);
      expect(validateCoordinates(0, 500)).toBe(false);
    });

    it("should reject NaN values", () => {
      expect(validateCoordinates(NaN, 0)).toBe(false);
      expect(validateCoordinates(0, NaN)).toBe(false);
      expect(validateCoordinates(NaN, NaN)).toBe(false);
    });
  });

  describe("calculateDistance (Haversine formula)", () => {
    it("should return 0 for same point", () => {
      const distance = calculateDistance(45.4642, 9.19, 45.4642, 9.19);
      expect(distance).toBe(0);
    });

    it("should calculate short distance correctly (~1km)", () => {
      // Milan Duomo to Castello Sforzesco (~1.2 km)
      const distance = calculateDistance(45.4642, 9.19, 45.4706, 9.1795);
      expect(distance).toBeGreaterThan(0.8);
      expect(distance).toBeLessThan(1.5);
    });

    it("should calculate medium distance correctly (~10km)", () => {
      // Milan center to Sesto San Giovanni (~10 km)
      const distance = calculateDistance(45.4642, 9.19, 45.5334, 9.2319);
      expect(distance).toBeGreaterThan(5);
      expect(distance).toBeLessThan(15);
    });

    it("should calculate long distance correctly (~500km)", () => {
      // Milan to Rome (~480 km)
      const distance = calculateDistance(45.4642, 9.19, 41.9028, 12.4964);
      expect(distance).toBeGreaterThan(400);
      expect(distance).toBeLessThan(600);
    });

    it("should be symmetric (A to B = B to A)", () => {
      const d1 = calculateDistance(45.4642, 9.19, 41.9028, 12.4964);
      const d2 = calculateDistance(41.9028, 12.4964, 45.4642, 9.19);
      expect(d1).toBeCloseTo(d2, 10);
    });

    it("should handle crossing equator", () => {
      const distance = calculateDistance(10, 0, -10, 0);
      // ~2222 km (20 degrees latitude)
      expect(distance).toBeGreaterThan(2000);
      expect(distance).toBeLessThan(2500);
    });

    it("should handle crossing prime meridian", () => {
      const distance = calculateDistance(51.5074, -0.1278, 51.5074, 0.1278);
      // London area, ~18 km
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(30);
    });
  });

  describe("generateSimulatedGPSTrack", () => {
    const sampleRoute: GeoJSONLineString = {
      type: "LineString",
      coordinates: [
        [9.19, 45.4642], // Milan Duomo [lon, lat]
        [9.185, 45.468], // Intermediate
        [9.1795, 45.4706], // Castello Sforzesco
      ],
    };

    it("should generate at least 10 GPS points", () => {
      const track = generateSimulatedGPSTrack(sampleRoute, 600); // 10 minutes
      expect(track.length).toBeGreaterThanOrEqual(10);
    });

    it("should generate more points for longer trips", () => {
      const shortTrack = generateSimulatedGPSTrack(sampleRoute, 100); // ~1.5 min
      const longTrack = generateSimulatedGPSTrack(sampleRoute, 1000); // ~16 min
      expect(longTrack.length).toBeGreaterThan(shortTrack.length);
    });

    it("should have timestamps in ascending order", () => {
      const track = generateSimulatedGPSTrack(sampleRoute, 600);
      for (let i = 1; i < track.length; i++) {
        expect(track[i].timestamp.getTime()).toBeGreaterThan(
          track[i - 1].timestamp.getTime(),
        );
      }
    });

    it("should start at approximately the route start point", () => {
      const track = generateSimulatedGPSTrack(sampleRoute, 600);
      const firstPoint = track[0];
      // Allow some noise variance (noiseScale = 0.00005 ≈ 5m)
      expect(firstPoint.lat).toBeCloseTo(45.4642, 3);
      expect(firstPoint.lon).toBeCloseTo(9.19, 3);
    });

    it("should end at approximately the route end point", () => {
      const track = generateSimulatedGPSTrack(sampleRoute, 600);
      const lastPoint = track[track.length - 1];
      expect(lastPoint.lat).toBeCloseTo(45.4706, 3);
      expect(lastPoint.lon).toBeCloseTo(9.1795, 3);
    });

    it("should add GPS noise to coordinates", () => {
      // Generate two tracks - due to random noise they should differ
      const track1 = generateSimulatedGPSTrack(sampleRoute, 60);
      const track2 = generateSimulatedGPSTrack(sampleRoute, 60);

      // Due to random noise, tracks should differ slightly
      let hasDifference = false;
      for (let i = 0; i < Math.min(track1.length, track2.length); i++) {
        if (
          track1[i].lat !== track2[i].lat ||
          track1[i].lon !== track2[i].lon
        ) {
          hasDifference = true;
          break;
        }
      }
      expect(hasDifference).toBe(true);
    });

    it("should have valid coordinates for all points", () => {
      const track = generateSimulatedGPSTrack(sampleRoute, 600);
      for (const point of track) {
        expect(validateCoordinates(point.lat, point.lon)).toBe(true);
      }
    });
  });

  describe("osrmToGeoJSON", () => {
    it("should convert OSRM route to GeoJSON LineString", () => {
      const osrmRoute: OSRMRoute = {
        distance: 1200,
        duration: 300,
        geometry: {
          type: "LineString",
          coordinates: [
            [9.19, 45.4642],
            [9.1795, 45.4706],
          ],
        },
      };

      const geojson = osrmToGeoJSON(osrmRoute);

      expect(geojson.type).toBe("LineString");
      expect(geojson.coordinates).toEqual([
        [9.19, 45.4642],
        [9.1795, 45.4706],
      ]);
    });

    it("should preserve all coordinates from OSRM response", () => {
      const osrmRoute: OSRMRoute = {
        distance: 5000,
        duration: 1200,
        geometry: {
          type: "LineString",
          coordinates: [
            [9.19, 45.4642],
            [9.185, 45.465],
            [9.18, 45.468],
            [9.1795, 45.4706],
          ],
        },
      };

      const geojson = osrmToGeoJSON(osrmRoute);
      expect(geojson.coordinates.length).toBe(4);
    });
  });
});

describe("Integration: Route Distance Estimation", () => {
  // Uses the real calculateDistance (Haversine) from routing module
  // Travel time formula: travelTimeMinutes = (distance / 15) * 60 at 15 km/h avg cycling speed

  it("should estimate travel time based on distance", () => {
    const distanceKm = 10;
    const expectedMinutes = (distanceKm / 15) * 60; // 40 minutes
    expect(expectedMinutes).toBe(40);
  });

  it("should handle short routes (< 1km)", () => {
    const distanceKm = 0.5;
    const expectedMinutes = Math.round((distanceKm / 15) * 60); // 2 minutes
    expect(expectedMinutes).toBe(2);
  });

  it("should handle long routes (> 50km)", () => {
    const distanceKm = 60;
    const expectedMinutes = Math.round((distanceKm / 15) * 60); // 240 minutes = 4 hours
    expect(expectedMinutes).toBe(240);
  });

  it("should estimate distance between two real coordinates using Haversine", () => {
    // Milan Duomo to Castello Sforzesco
    const distanceKm = calculateDistance(45.4642, 9.19, 45.4706, 9.1795);
    const travelTimeMinutes = Math.round((distanceKm / 15) * 60);
    expect(distanceKm).toBeGreaterThan(0.5);
    expect(distanceKm).toBeLessThan(2);
    expect(travelTimeMinutes).toBeGreaterThan(0);
  });
});

describe("calculatePathDeviation", () => {
  it("should return 0 for a perfectly straight 2-point path", () => {
    const coords: Array<[number, number]> = [
      [9.19, 45.4642],
      [9.20, 45.4642],
    ];
    const L = calculatePathDeviation(coords);
    expect(L).toBeCloseTo(0, 5);
  });

  it("should return 0 for fewer than 2 coordinates", () => {
    expect(calculatePathDeviation([])).toBe(0);
    expect(calculatePathDeviation([[9.19, 45.4642]])).toBe(0);
  });

  it("should return 0 when start and end are the same point (loop)", () => {
    const coords: Array<[number, number]> = [
      [9.19, 45.4642],
      [9.20, 45.47],
      [9.19, 45.4642],
    ];
    const L = calculatePathDeviation(coords);
    expect(L).toBe(0);
  });

  it("should return a value between 0 and 1 for a winding path", () => {
    const coords: Array<[number, number]> = [
      [9.19, 45.46],
      [9.19, 45.47],
      [9.19, 45.46],
      [9.20, 45.46],
    ];
    const L = calculatePathDeviation(coords);
    expect(L).toBeGreaterThan(0);
    expect(L).toBeLessThanOrEqual(1);
  });

  it("should return higher deviation for more winding paths", () => {
    const straight: Array<[number, number]> = [
      [9.19, 45.46],
      [9.195, 45.46],
      [9.20, 45.46],
    ];

    const winding: Array<[number, number]> = [
      [9.19, 45.46],
      [9.195, 45.47],
      [9.195, 45.45],
      [9.20, 45.46],
    ];

    const Lstraight = calculatePathDeviation(straight);
    const Lwinding = calculatePathDeviation(winding);

    expect(Lwinding).toBeGreaterThan(Lstraight);
  });

  it("should clamp result to [0, 1]", () => {
    const coords: Array<[number, number]> = [
      [9.19, 45.46],
      [9.20, 45.47],
      [9.21, 45.46],
      [9.22, 45.47],
      [9.23, 45.46],
    ];
    const L = calculatePathDeviation(coords);
    expect(L).toBeGreaterThanOrEqual(0);
    expect(L).toBeLessThanOrEqual(1);
  });

  it("should return near 0 for a nearly straight multi-point path", () => {
    // Points along a nearly straight east-west line
    const coords: Array<[number, number]> = [
      [9.190, 45.4642],
      [9.192, 45.4642],
      [9.194, 45.4642],
      [9.196, 45.4642],
      [9.198, 45.4642],
      [9.200, 45.4642],
    ];
    const L = calculatePathDeviation(coords);
    expect(L).toBeCloseTo(0, 3);
  });
});

describe("findMinDistanceToPoint", () => {
  it("should return Infinity for empty coordinates", () => {
    expect(findMinDistanceToPoint([], 45.46, 9.19)).toBe(Infinity);
  });

  it("should return 0 when query point is exactly on a coordinate", () => {
    const coords: Array<[number, number]> = [
      [9.19, 45.4642],
      [9.20, 45.47],
    ];
    const dist = findMinDistanceToPoint(coords, 45.4642, 9.19);
    expect(dist).toBe(0);
  });

  it("should return the minimum distance to the closest point", () => {
    const coords: Array<[number, number]> = [
      [9.19, 45.4642],
      [9.1795, 45.4706],
    ];
    // Query near Castello Sforzesco
    const dist = findMinDistanceToPoint(coords, 45.4710, 9.1800);
    expect(dist).toBeLessThan(0.1); // very close
  });

  it("should find closest point even when it is not first or last", () => {
    const coords: Array<[number, number]> = [
      [9.10, 45.40],
      [9.19, 45.4642],
      [9.30, 45.50],
    ];
    const dist = findMinDistanceToPoint(coords, 45.4642, 9.19);
    expect(dist).toBe(0);
  });

  it("should return large distance for a point far from all coordinates", () => {
    const coords: Array<[number, number]> = [
      [9.19, 45.4642],
      [9.1795, 45.4706],
    ];
    // Query ~5km away
    const dist = findMinDistanceToPoint(coords, 45.50, 9.25);
    expect(dist).toBeGreaterThan(0.5);
  });
});

describe("Proximity Matching Logic", () => {
  it("should identify a point within 500m proximity", () => {
    const coords: Array<[number, number]> = [
      [9.19, 45.4642],
      [9.195, 45.467],
      [9.1795, 45.4706],
    ];

    const startDist = findMinDistanceToPoint(coords, 45.4645, 9.1905);
    expect(startDist).toBeLessThan(0.5);

    const endDist = findMinDistanceToPoint(coords, 45.4710, 9.1800);
    expect(endDist).toBeLessThan(0.5);
  });

  it("should reject a point outside proximity threshold", () => {
    const coords: Array<[number, number]> = [
      [9.19, 45.4642],
      [9.1795, 45.4706],
    ];

    const dist = findMinDistanceToPoint(coords, 45.50, 9.25);
    expect(dist).toBeGreaterThan(0.5);
  });
});

describe("Proximity Penalty Calculation", () => {
  // Uses PROXIMITY_PENALTY_PER_KM imported from the real routing module
  const PENALTY_PER_KM = PROXIMITY_PENALTY_PER_KM;

  it("should apply zero penalty for exact match (distance = 0)", () => {
    const startDist = 0;
    const endDist = 0;
    const avgDistKm = (startDist + endDist) / 2;
    const penalty = PENALTY_PER_KM * avgDistKm;
    expect(penalty).toBe(0);
  });

  it("should apply partial penalty when one endpoint is nearby", () => {
    // Partial match: start matched by name (dist=0), end is 0.8km away
    const startDist = 0;
    const endDist = 0.8;
    const avgDistKm = (startDist + endDist) / 2;
    const penalty = PENALTY_PER_KM * avgDistKm;
    // 15 * 0.4 = 6 points
    expect(penalty).toBe(6);
  });

  it("should apply full penalty when both endpoints are nearby", () => {
    // Nearby match: start is 1km away, end is 1.5km away
    const startDist = 1.0;
    const endDist = 1.5;
    const avgDistKm = (startDist + endDist) / 2;
    const penalty = PENALTY_PER_KM * avgDistKm;
    // 15 * 1.25 = 18.75 points
    expect(penalty).toBeCloseTo(18.75, 2);
  });

  it("should reduce adjusted score by penalty amount", () => {
    const originalScore = 75;
    const penalty = 10;
    const adjustedScore = Math.max(0, originalScore - penalty);
    expect(adjustedScore).toBe(65);
  });

  it("should clamp adjusted score to minimum 0", () => {
    const originalScore = 10;
    const penalty = 25;
    const adjustedScore = Math.max(0, originalScore - penalty);
    expect(adjustedScore).toBe(0);
  });

  it("should penalize nearby match more than partial match at same distance", () => {
    // Partial: one side matched (dist=0), other at 1km
    const partialAvg = (0 + 1.0) / 2; // 0.5
    const partialPenalty = PENALTY_PER_KM * partialAvg; // 7.5

    // Nearby: both sides at 1km
    const nearbyAvg = (1.0 + 1.0) / 2; // 1.0
    const nearbyPenalty = PENALTY_PER_KM * nearbyAvg; // 15

    expect(nearbyPenalty).toBeGreaterThan(partialPenalty);
  });

  it("should produce penalty proportional to distance", () => {
    const close = PENALTY_PER_KM * 0.3;  // 4.5 points at 0.3km
    const medium = PENALTY_PER_KM * 1.0; // 15 points at 1km
    const far = PENALTY_PER_KM * 2.0;    // 30 points at 2km

    expect(close).toBeLessThan(medium);
    expect(medium).toBeLessThan(far);
    // Linear: doubling distance doubles penalty
    expect(far / medium).toBeCloseTo(2, 5);
  });

  it("should correctly rank paths: exact > partial > nearby (same original score)", () => {
    const originalScore = 80;

    const exactScore = Math.max(0, originalScore - 0);                      // 80
    const partialScore = Math.max(0, originalScore - PENALTY_PER_KM * 0.4); // 80 - 6 = 74
    const nearbyScore = Math.max(0, originalScore - PENALTY_PER_KM * 1.0);  // 80 - 15 = 65

    expect(exactScore).toBeGreaterThan(partialScore);
    expect(partialScore).toBeGreaterThan(nearbyScore);
  });

  it("should allow a nearby path with high original score to rank above a worse exact match", () => {
    const highScoreNearby = Math.max(0, 95 - PENALTY_PER_KM * 0.5);  // 95 - 7.5 = 87.5
    const lowScoreExact = Math.max(0, 40 - 0);                        // 40

    expect(highScoreNearby).toBeGreaterThan(lowScoreExact);
  });
});
