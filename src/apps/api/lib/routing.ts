import type { DB } from "./db";

/**
 * Routing and GPS simulation using:
 * - OSRM (Open Source Routing Machine) for actual routing
 * - GPS simulation for demo trips
 */

interface RouteResult {
  id: string;
  name: string;
  distance: number; // km
  travelTimeMinutes: number;
  score: number; // adjusted score (after proximity penalty)
  originalScore: number;
  matchType: "exact" | "partial" | "nearby";
  proximityPenalty: number;
  geometry?: GeoJSONLineString; // Route geometry from OSRM
  streets: Array<{
    id: string;
    name: string;
    currentStatus: string | null;
  }>;
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: Array<[number, number]>; // [lon, lat] pairs
}

export interface OSRMRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    coordinates: Array<[number, number]>;
    type: "LineString";
  };
}

/**
 * Call OSRM routing API (free public instance)
 * Returns actual cycling route between two points
 */
export async function getOSRMRoute(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
): Promise<OSRMRoute | null> {
  try {
    // OSRM uses [lon, lat] format
    const url = `https://router.project-osrm.org/route/v1/bike/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&overview=full`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.error(`OSRM error: ${response.status} ${response.statusText}`);
      return null;
    }

    let responseText = "";
    try {
      responseText = await response.text();
      if (!responseText) {
        console.error("OSRM returned empty response");
        return null;
      }
      const data = JSON.parse(responseText) as {
        routes?: Array<{
          distance: number;
          duration: number;
          geometry: {
            type: "LineString";
            coordinates: Array<[number, number]>;
          };
        }>;
      };

      if (!data.routes || data.routes.length === 0) {
        console.warn("OSRM: No routes found for given coordinates");
        return null;
      }

      const route = data.routes[0];
      return {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
      };
    } catch (parseError) {
      console.error("OSRM JSON parse error:", parseError, "Response:", responseText.substring(0, 200));
      return null;
    }
  } catch (error) {
    console.error("OSRM routing error:", error);
    return null;
  }
}

/**
 * Generate simulated GPS points along a route
 * Creates realistic-looking GPS track by adding slight variations
 * Useful for demo purposes without requiring actual device location
 */
export function generateSimulatedGPSTrack(
  routeGeometry: GeoJSONLineString,
  tripDurationSeconds: number,
): Array<{ lat: number; lon: number; timestamp: Date }> {
  const coordinates = routeGeometry.coordinates;
  const startTime = new Date();
  const gpsPoints: Array<{ lat: number; lon: number; timestamp: Date }> = [];

  // Generate GPS points at regular intervals
  const pointCount = Math.max(10, Math.floor(tripDurationSeconds / 10)); // One point every ~10 seconds
  const timeInterval = tripDurationSeconds / pointCount;

  for (let i = 0; i < pointCount; i++) {
    const progress = i / (pointCount - 1); // 0 to 1
    const coordIndex = Math.floor(progress * (coordinates.length - 1));
    const [lon, lat] = coordinates[coordIndex];

    // Add small random variations to simulate GPS noise
    const noiseScale = 0.00005; // ~5 meters
    const noisyLat = lat + (Math.random() - 0.5) * noiseScale;
    const noisyLon = lon + (Math.random() - 0.5) * noiseScale;

    gpsPoints.push({
      lat: noisyLat,
      lon: noisyLon,
      timestamp: new Date(startTime.getTime() + i * timeInterval * 1000),
    });
  }

  return gpsPoints;
}

/**
 * Convert OSRM response to GeoJSON LineString
 */
export function osrmToGeoJSON(route: OSRMRoute): GeoJSONLineString {
  return {
    type: "LineString",
    coordinates: route.geometry.coordinates,
  };
}

/**
 * Calculate path deviation from the straight line between start and end.
 * Returns a value in [0, 1] where 0 = straight line, 1 = infinitely winding.
 * Formula: L = 1 - (straightLineDistance / actualPathDistance)
 *
 * @param coordinates - Array of [lon, lat] pairs from GeoJSON LineString
 * @returns Deviation factor L in range [0, 1]
 */
export function calculatePathDeviation(
  coordinates: Array<[number, number]>,
): number {
  if (coordinates.length < 2) {
    return 0;
  }

  let actualPathDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    actualPathDistance += calculateDistance(
      coordinates[i][1],
      coordinates[i][0],
      coordinates[i + 1][1],
      coordinates[i + 1][0],
    );
  }

  if (actualPathDistance === 0) {
    return 0;
  }

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const straightLineDistance = calculateDistance(
    first[1], first[0],
    last[1], last[0],
  );

  if (straightLineDistance === 0) {
    return 0;
  }

  const L = 1 - (straightLineDistance / actualPathDistance);
  return Math.max(0, Math.min(1, L));
}

/**
 * Find the minimum distance (in km) from any coordinate in a path
 * geometry to a given query point.
 *
 * @param coordinates - Array of [lon, lat] pairs from path geometry
 * @param queryLat - Query point latitude
 * @param queryLon - Query point longitude
 * @returns Minimum distance in km, or Infinity if coordinates array is empty
 */
export function findMinDistanceToPoint(
  coordinates: Array<[number, number]>,
  queryLat: number,
  queryLon: number,
): number {
  if (coordinates.length === 0) {
    return Infinity;
  }

  let minDist = Infinity;
  for (const [lon, lat] of coordinates) {
    const dist = calculateDistance(lat, lon, queryLat, queryLon);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

/** Penalty points subtracted per km of average distance from query points */
export const PROXIMITY_PENALTY_PER_KM = 15;

interface MatchInfo {
  matchType: "exact" | "partial" | "nearby";
  startDist: number; // km, 0 for name-matched endpoints
  endDist: number;   // km, 0 for name-matched endpoints
}

/**
 * Find routes between two street names.
 * Searches existing paths in the database that contain both streets.
 *
 * When coordinates are provided, also returns paths that pass *nearby*
 * the query points (within `nearbyThresholdKm`), applying a linear
 * score penalty proportional to the distance.
 *
 * Match levels:
 *  - exact:   both street names found in path → penalty 0
 *  - partial: one street name matches, other endpoint within radius → penalty on non-matched side
 *  - nearby:  no name match, but path geometry within radius of both points → penalty on both sides
 */
export async function findRoutes(
  startStreetName: string,
  endStreetName: string,
  db: DB,
  options?: {
    startLat?: number;
    startLon?: number;
    endLat?: number;
    endLon?: number;
    proximityThresholdKm?: number;
    nearbyThresholdKm?: number;
  },
): Promise<RouteResult[] | null> {
  try {
    // Get all paths from database with their streets
    const allPaths = await db.query.path.findMany({
      with: {
        pathSegments: {
          with: {
            street: true,
          },
        },
      },
    });

    if (!allPaths || allPaths.length === 0) {
      return null;
    }

    const nearbyThreshold = options?.nearbyThresholdKm ?? 2;
    const hasCoordinates = options?.startLat != null && options?.startLon != null
      && options?.endLat != null && options?.endLon != null;

    // Classify each path into exact / partial / nearby, or skip it
    const matched: Array<{ path: any; match: MatchInfo }> = [];

    for (const p of allPaths) {
      if (!p.pathSegments || p.pathSegments.length === 0) continue;

      const streetNames = (p as any).pathSegments.map((seg: any) =>
        seg.street.name?.toLowerCase(),
      );

      const hasStart = streetNames.some((name: string) =>
        name?.includes(startStreetName.toLowerCase()),
      );
      const hasEnd = streetNames.some((name: string) =>
        name?.includes(endStreetName.toLowerCase()),
      );

      // Level 1: exact — both street names present
      if (hasStart && hasEnd) {
        matched.push({
          path: p,
          match: { matchType: "exact", startDist: 0, endDist: 0 },
        });
        continue;
      }

      // Levels 2 & 3 require coordinates and path geometry
      if (!hasCoordinates || !p.geometry || !(p.geometry as any).coordinates) {
        continue;
      }

      const coords = (p.geometry as any).coordinates as Array<[number, number]>;
      const startDist = findMinDistanceToPoint(coords, options!.startLat!, options!.startLon!);
      const endDist = findMinDistanceToPoint(coords, options!.endLat!, options!.endLon!);

      // Level 2: partial — one name matches, other endpoint is nearby
      if (hasStart && endDist <= nearbyThreshold) {
        matched.push({
          path: p,
          match: { matchType: "partial", startDist: 0, endDist },
        });
        continue;
      }
      if (hasEnd && startDist <= nearbyThreshold) {
        matched.push({
          path: p,
          match: { matchType: "partial", startDist, endDist: 0 },
        });
        continue;
      }

      // Level 3: nearby — no name match, but geometry close to both points
      if (startDist <= nearbyThreshold && endDist <= nearbyThreshold) {
        matched.push({
          path: p,
          match: { matchType: "nearby", startDist, endDist },
        });
      }
    }

    if (matched.length === 0) {
      return null;
    }

    // Map matched paths to RouteResult with proximity penalty
    const routes: RouteResult[] = matched.map(({ path: p, match }) => {
      const originalScore = p.score ? parseFloat(p.score) : 50;

      // Calculate linear proximity penalty
      const avgDistKm = (match.startDist + match.endDist) / 2;
      const proximityPenalty = parseFloat(
        (PROXIMITY_PENALTY_PER_KM * avgDistKm).toFixed(2),
      );
      const score = Math.max(0, originalScore - proximityPenalty);

      // Get streets from path segments
      const streets = p.pathSegments
        ? (p as any).pathSegments.map((segment: any) => ({
            id: segment.street.id,
            name: segment.street.name,
            currentStatus: segment.street.currentStatus,
          }))
        : [];

      // Estimate distance from path geometry
      let distance = 5;
      let travelTimeMinutes = 20;

      if (p.geometry && (p.geometry as any).coordinates) {
        const coords = (p.geometry as any).coordinates;
        let totalDist = 0;
        for (let i = 0; i < coords.length - 1; i++) {
          totalDist += calculateDistance(
            coords[i][1],
            coords[i][0],
            coords[i + 1][1],
            coords[i + 1][0],
          );
        }
        distance = parseFloat(totalDist.toFixed(2));
        travelTimeMinutes = Math.round((distance / 15) * 60); // ~15 km/h average
      }

      return {
        id: p.id,
        name: p.name,
        distance,
        travelTimeMinutes,
        score,
        originalScore,
        matchType: match.matchType,
        proximityPenalty,
        geometry: p.geometry as GeoJSONLineString | undefined,
        streets,
      };
    });

    // Sort by adjusted score descending, with proximity as tiebreaker
    routes.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 1) return scoreDiff;

      // Tiebreaker: prefer exact > partial > nearby
      const matchOrder = { exact: 0, partial: 1, nearby: 2 };
      const matchDiff = matchOrder[a.matchType] - matchOrder[b.matchType];
      if (matchDiff !== 0) return matchDiff;

      // Further tiebreaker: total proximity (lower = better)
      return (a.proximityPenalty - b.proximityPenalty);
    });

    return routes.length > 0 ? routes : null;
  } catch (error) {
    console.error("Error finding routes:", error);
    return null;
  }
}

/**
 * Validate if coordinates are valid
 */
export function validateCoordinates(lat: number, lon: number): boolean {
  return (
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !isNaN(lat) &&
    !isNaN(lon)
  );
}

/**
 * Calculate distance between two coordinates in km
 * Using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
