/**
 * Trip Simulator Utility
 * Generates realistic simulated trip data with OSRM routes for demo purposes
 * Now street-aware: paths are composed of street segments
 */

import type { TripData } from "../components/trips/trip-review-screen";

export interface SimulatedTripParams {
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  pathName?: string;
}

export interface StreetSegment {
  name: string;
  startCoord: [number, number];
  endCoord: [number, number];
  status: "optimal" | "medium" | "sufficient" | "requires_maintenance";
}

export interface PathWithStreets {
  streets: StreetSegment[];
  totalDistance: number;
  totalDuration: number;
}

/**
 * Fetch real route from OSRM API via backend proxy
 */
async function fetchOSRMRoute(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number
): Promise<{
  distance: number; // meters
  duration: number; // seconds
  geometry: Array<[number, number]>;
} | null> {
  try {
    const coordinates = `${startLon},${startLat};${endLon},${endLat}`;
    const response = await fetch(`/api/osrm/route/bike/${coordinates}?geometries=geojson&overview=full`);

    if (!response.ok) {
      console.error("OSRM proxy error:", response.statusText);
      return null;
    }

    const data = (await response.json()) as {
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
      return null;
    }

    const route = data.routes[0];
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry.coordinates,
    };
  } catch (error) {
    console.error("Error fetching OSRM route:", error);
    return null;
  }
}

/**
 * Generate simulated GPS points along a route with realistic variations
 */
function generateGPSPoints(
  geometry: Array<[number, number]>,
  durationSeconds: number
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const pointCount = Math.max(10, Math.floor(durationSeconds / 10)); // ~10 second intervals

  for (let i = 0; i < pointCount; i++) {
    const progress = i / (pointCount - 1);
    const coordIndex = Math.floor(progress * (geometry.length - 1));
    const [lon, lat] = geometry[coordIndex];

    // Add small GPS noise
    const noiseScale = 0.00005;
    points.push([
      lon + (Math.random() - 0.5) * noiseScale,
      lat + (Math.random() - 0.5) * noiseScale,
    ]);
  }

  return points;
}

/**
 * Generate simulated obstacles along the route
 */
function generateObstacles(
  geometry: Array<[number, number]>,
  count: number = 2
): Array<{
  id: string;
  location: string;
  type: string;
  confirmed: boolean;
}> {
  const obstacles: Array<{
    id: string;
    location: string;
    type: string;
    confirmed: boolean;
  }> = [];

  const obstacleTypes = ["Pothole", "Debris", "Cracked pavement", "Broken glass", "Water puddle"];

  for (let i = 0; i < count; i++) {
    const randomGeomIndex = Math.floor(Math.random() * (geometry.length - 1));
    const [lon, lat] = geometry[randomGeomIndex];

    obstacles.push({
      id: `obstacle-${i}`,
      location: `At coordinates [${lon.toFixed(4)}, ${lat.toFixed(4)}]`,
      type: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)],
      confirmed: false,
    });
  }

  return obstacles;
}

/**
 * Get random weather for the trip
 */
function getWeatherForTrip(): {
  condition: string;
  temperature: number;
  windSpeed: number;
  humidity: number;
} {
  const conditions = ["sunny", "cloudy", "rainy", "windy"];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];

  return {
    condition,
    temperature: 15 + Math.random() * 10, // 15-25°C
    windSpeed: Math.floor(Math.random() * 20), // 0-20 km/h
    humidity: 40 + Math.floor(Math.random() * 40), // 40-80%
  };
}

/**
 * Generate a complete simulated trip with realistic data
 */
export async function generateSimulatedTrip(
  params: SimulatedTripParams
): Promise<TripData | null> {
  // Fetch real route from OSRM
  const osrmRoute = await fetchOSRMRoute(
    params.startLon,
    params.startLat,
    params.endLon,
    params.endLat
  );

  if (!osrmRoute) {
    console.error("Could not fetch route from OSRM");
    return null;
  }

  const durationSeconds = osrmRoute.duration;
  const distanceKm = osrmRoute.distance / 1000;
  const avgSpeedKmh = (distanceKm / durationSeconds) * 3600;

  // Generate simulated GPS track
  const gpsPoints = generateGPSPoints(osrmRoute.geometry, durationSeconds);

  // Generate simulated obstacles (2-4 obstacles per trip)
  const obstacleCount = 2 + Math.floor(Math.random() * 3);
  const obstacles = generateObstacles(osrmRoute.geometry, obstacleCount);

  // Generate weather data
  const weather = getWeatherForTrip();

  // Create trip data
  const now = new Date();
  const startTime = new Date(now.getTime() - durationSeconds * 1000);

  const tripData: TripData = {
    pathName: params.pathName || `Route recorded at ${now.toLocaleTimeString()}`,
    distance: parseFloat(distanceKm.toFixed(2)),
    duration: Math.round(durationSeconds / 60),
    avgSpeed: parseFloat(avgSpeedKmh.toFixed(1)),
    maxSpeed: parseFloat((avgSpeedKmh * 1.3).toFixed(1)), // 30% faster max speed
    startTime,
    endTime: now,
    pathStatus: Math.random() > 0.7 ? "requires_maintenance" : "medium",
    weather: {
      condition: weather.condition,
      temperature: parseFloat(weather.temperature.toFixed(1)),
      windSpeed: weather.windSpeed,
      humidity: weather.humidity,
    },
    obstacles,
    geometry: {
      type: "LineString",
      coordinates: gpsPoints,
    },
    collectionMode: "simulated",
  };

  return tripData;
}

/**
 * Decompose OSRM route into simulated "streets"
 * Makes paths street-aware by breaking them into segments
 */
export function decomposeRouteIntoStreets(
  geometry: Array<[number, number]>,
  pathName: string
): StreetSegment[] {
  const streets: StreetSegment[] = [];
  const streetNames = [
    "Main Street",
    "Park Avenue",
    "Central Drive",
    "Riverside Road",
    "North Lane",
    "South Boulevard",
    "East Street",
    "West Avenue",
    "Spring Road",
    "Summer Lane",
    "Autumn Drive",
    "Winter Street",
  ];

  const statuses: Array<"optimal" | "medium" | "sufficient" | "requires_maintenance"> = [
    "optimal",
    "medium",
    "sufficient",
    "requires_maintenance",
  ];

  // Break route into 3-7 segments (streets)
  const segmentCount = 3 + Math.floor(Math.random() * 5);
  const pointsPerSegment = Math.floor(geometry.length / segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const startIdx = i * pointsPerSegment;
    const endIdx = i === segmentCount - 1 ? geometry.length - 1 : (i + 1) * pointsPerSegment;

    if (startIdx >= endIdx) continue;

    const startCoord = geometry[startIdx];
    const endCoord = geometry[endIdx];

    streets.push({
      name: `${pathName} - ${streetNames[i % streetNames.length]}`,
      startCoord: [parseFloat(startCoord[0].toFixed(4)), parseFloat(startCoord[1].toFixed(4))],
      endCoord: [parseFloat(endCoord[0].toFixed(4)), parseFloat(endCoord[1].toFixed(4))],
      status: statuses[Math.floor(Math.random() * statuses.length)],
    });
  }

  return streets;
}

/**
 * Generate simulated trip from manual coordinates (faster, for testing)
 * Now returns street-decomposed paths
 */
export function generateSimulatedTripQuick(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  pathName?: string
): TripData {
  // Estimate distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = ((endLat - startLat) * Math.PI) / 180;
  const dLon = ((endLon - startLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startLat * Math.PI) / 180) *
      Math.cos((endLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Estimate duration at ~15 km/h average
  const avgSpeed = 15;
  const duration = Math.round((distance / avgSpeed) * 60);

  // Generate random route points
  const points: Array<[number, number]> = [];
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    const progress = i / (steps - 1);
    points.push([
      startLon + (endLon - startLon) * progress + (Math.random() - 0.5) * 0.001,
      startLat + (endLat - startLat) * progress + (Math.random() - 0.5) * 0.001,
    ]);
  }

  const now = new Date();
  const startTime = new Date(now.getTime() - duration * 60 * 1000);
  const weather = getWeatherForTrip();

  // Decompose into streets
  const streets = decomposeRouteIntoStreets(points, pathName || "Recorded Path");

  // Generate obstacles for streets
  const obstacles = streets.flatMap((street, streetIdx) =>
    Math.random() > 0.6 // 40% chance of obstacle per street
      ? [
          {
            id: `street-${streetIdx}-obs-0`,
            location: `On ${street.name}`,
            type: ["Pothole", "Debris", "Cracked pavement", "Water"][
              Math.floor(Math.random() * 4)
            ],
            confirmed: false,
          },
        ]
      : []
  );

  return {
    pathName: pathName || `Route recorded at ${now.toLocaleTimeString()}`,
    distance: parseFloat(distance.toFixed(2)),
    duration,
    avgSpeed,
    maxSpeed: parseFloat((avgSpeed * 1.3).toFixed(1)),
    startTime,
    endTime: now,
    pathStatus: Math.random() > 0.7 ? "requires_maintenance" : "medium",
    weather: {
      condition: weather.condition,
      temperature: parseFloat(weather.temperature.toFixed(1)),
      windSpeed: weather.windSpeed,
      humidity: weather.humidity,
    },
    obstacles,
    geometry: {
      type: "LineString",
      coordinates: points,
    },
    collectionMode: "simulated",
  };
}
