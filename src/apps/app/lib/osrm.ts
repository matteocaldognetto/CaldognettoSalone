/**
 * OSRM (Open Source Routing Machine) utilities
 * Uses the public OSRM service for distance/routing calculations
 */

export interface RouteResult {
  distance: number; // meters
  duration: number; // seconds
  coordinates: Array<[number, number]>; // [lon, lat] pairs
}

const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1";

/**
 * Calculate distance between two coordinates using OSRM
 * @param startLon Start longitude
 * @param startLat Start latitude
 * @param endLon End longitude
 * @param endLat End latitude
 * @returns Distance in meters
 */
export async function getDistance(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
): Promise<number | null> {
  try {
    const response = await fetch(
      `${OSRM_BASE_URL}/bike/${startLon},${startLat};${endLon},${endLat}?overview=false`,
    );

    if (!response.ok) {
      console.error("OSRM error:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error("No route found by OSRM");
      return null;
    }

    // Return distance in meters
    return data.routes[0].distance;
  } catch (error) {
    console.error("Failed to fetch distance from OSRM:", error);
    return null;
  }
}

/**
 * Get full route data between two coordinates
 * Calls the Hono OSRM proxy endpoint
 * @param startLon Start longitude
 * @param startLat Start latitude
 * @param endLon End longitude
 * @param endLat End latitude
 * @returns Route data with distance, duration, and coordinates
 */
export async function getRoute(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
): Promise<RouteResult | null> {
  try {
    const coordinates = `${startLon},${startLat};${endLon},${endLat}`;
    const response = await fetch(
      `/api/osrm/route/bike/${coordinates}?overview=full&geometries=geojson`,
    );

    if (!response.ok) {
      console.error("OSRM proxy error:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error("No route found by OSRM");
      return null;
    }

    const route = data.routes[0];
    const geometry = route.geometry;

    return {
      distance: route.distance,
      duration: route.duration,
      coordinates: geometry.coordinates || [],
    };
  } catch (error) {
    console.error("Failed to fetch route from OSRM proxy:", error);
    return null;
  }
}

/**
 * Generate random coordinates within Milan
 * Useful for demo/simulation purposes
 */
export function generateRandomCoordinates(): {
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
} {
  // Milan center coordinates
  const baseLat = 45.4642;
  const baseLon = 9.1900;

  // Random variation within ~3km
  const variation = 0.03;

  return {
    startLat: baseLat + (Math.random() - 0.5) * variation,
    startLon: baseLon + (Math.random() - 0.5) * variation,
    endLat: baseLat + (Math.random() - 0.5) * variation,
    endLon: baseLon + (Math.random() - 0.5) * variation,
  };
}

/**
 * Generate a random end point from a given start point
 * Used for chaining sequential routes in automatic mode
 * @param startLat Current latitude
 * @param startLon Current longitude
 * @returns New end coordinates that are ~0.5-1.5km away
 */
export function generateNextPoint(
  startLat: number,
  startLon: number,
): { endLat: number; endLon: number } {
  // Milan bounds to keep routes within the city
  const minLat = 45.43;
  const maxLat = 45.50;
  const minLon = 9.14;
  const maxLon = 9.25;

  // Generate a point 0.5-1.5km away in a random direction
  // ~0.01 degrees ≈ 1.1km at Milan's latitude
  const distance = 0.005 + Math.random() * 0.01; // 0.5-1.5km
  const angle = Math.random() * 2 * Math.PI;

  let endLat = startLat + distance * Math.cos(angle);
  let endLon = startLon + distance * Math.sin(angle) / Math.cos(startLat * Math.PI / 180);

  // Clamp to Milan bounds
  endLat = Math.max(minLat, Math.min(maxLat, endLat));
  endLon = Math.max(minLon, Math.min(maxLon, endLon));

  return { endLat, endLon };
}
