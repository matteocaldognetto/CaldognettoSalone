/**
 * Test Data Generators and Constants
 *
 * Provides reusable test data for e2e tests.
 * All generated data is unique to avoid test collisions.
 */

// Default test user credentials (should be seeded in test database)
export const TEST_USER = {
  email: "e2e-test@example.com",
  password: "TestPassword123!",
  name: "E2E Test User",
} as const;

// Sample street names from Milan (used in the app)
export const TEST_STREETS = [
  "Via Torino",
  "Corso Buenos Aires",
  "Via Monte Napoleone",
  "Via della Moscova",
  "Corso Vittorio Emanuele Secondo",
  "Via Paolo Sarpi",
  "Viale Monza",
  "Via Padova",
] as const;

// Obstacle types matching the app's enum
export const OBSTACLE_TYPES = [
  "pothole",
  "debris",
  "water",
  "gravel",
  "broken_surface",
] as const;

// Route status values matching the app's enum
export const ROUTE_STATUS = [
  "optimal",
  "medium",
  "sufficient",
  "requires_maintenance",
] as const;

// Weather conditions matching the app's enum
export const WEATHER_CONDITIONS = [
  "clear",
  "cloudy",
  "rainy",
  "windy",
  "snowy",
  "foggy",
] as const;

/**
 * Generates a unique email address for test isolation
 */
export function generateUniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/**
 * Generates a unique trip name with timestamp
 */
export function generateTripName(prefix = "Test Trip"): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  return `${prefix} - ${timestamp}`;
}

/**
 * Generates a unique user for registration tests
 */
export function generateTestUser() {
  const id = Date.now().toString(36);
  return {
    name: `Test User ${id}`,
    email: generateUniqueEmail(),
    password: "SecurePassword123!",
  };
}

/**
 * Generates random trip metadata
 */
export function generateTripData() {
  return {
    name: generateTripName(),
    description: `E2E test trip created at ${new Date().toISOString()}`,
    rating: Math.floor(Math.random() * 5) + 1,
    duration: Math.floor(Math.random() * 60) + 10, // 10-70 minutes
  };
}

/**
 * Generates random weather data
 */
export function generateWeatherData() {
  return {
    condition:
      WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)],
    temperature: Math.floor(Math.random() * 30) + 5, // 5-35 degrees
    humidity: Math.floor(Math.random() * 60) + 30, // 30-90%
    windSpeed: Math.floor(Math.random() * 30) + 5, // 5-35 km/h
  };
}

/**
 * Gets two random different streets for route testing
 */
export function getRandomStreetPair(): [string, string] {
  const shuffled = [...TEST_STREETS].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

export const MOCK_OVERPASS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="Overpass API">
<note>The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.</note>
<meta osm_base="2024-05-20T12:00:00Z"/>
  <way id="1001">
    <tag k="name" v="Test Street 1"/>
    <tag k="highway" v="residential"/>
    <nd ref="1" lat="45.4642" lon="9.1900"/>
    <nd ref="2" lat="45.4652" lon="9.1910"/>
    <nd ref="3" lat="45.4662" lon="9.1920"/>
  </way>
  <node id="1" lat="45.4642" lon="9.1900"/>
  <node id="2" lat="45.4652" lon="9.1910"/>
  <node id="3" lat="45.4662" lon="9.1920"/>
</osm>
`;

export const MOCK_OSRM_RESPONSE = {
  code: "Ok",
  routes: [
    {
      geometry: {
        coordinates: [
          [9.1900, 45.4642],
          [9.1910, 45.4652],
          [9.1920, 45.4662]
        ],
        type: "LineString"
      },
      legs: [{ summary: "", weight: 100, duration: 60, distance: 500 }],
      weight_name: "cyclability",
      weight: 100,
      duration: 60,
      distance: 500
    }
  ],
  waypoints: [
    { hint: "start", distance: 0, name: "Start", location: [9.1900, 45.4642] },
    { hint: "end", distance: 0, name: "End", location: [9.1920, 45.4662] }
  ]
};
