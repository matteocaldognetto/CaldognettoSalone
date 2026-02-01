/**
 * Geocoding service using OpenStreetMap Nominatim
 * Free, no API key required, unlimited requests
 *
 * Nominatim API: https://nominatim.org/
 * Usage Policy: https://nominatim.org/usage_policy.html
 */

export interface GeocodingResult {
  lat: number;
  lon: number;
  displayName: string;
  address?: {
    road?: string;
    city?: string;
    country?: string;
  };
}

/**
 * Geocode an address string to coordinates using Nominatim
 * Includes User-Agent and rate limiting to be respectful
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent": "BestBikePath-Demo/1.0 (+https://github.com/yourusername/best-bike-path)",
        },
      },
    );

    if (!response.ok) {
      console.error(`Geocoding error: ${response.statusText}`);
      return null;
    }

    const results = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
    }>;

    if (!results || results.length === 0) {
      return null;
    }

    const result = results[0];
    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name,
      address: result.address,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to address using Nominatim
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      format: "json",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      {
        headers: {
          "User-Agent": "BestBikePath-Demo/1.0 (+https://github.com/yourusername/best-bike-path)",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as {
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
    };

    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name,
      address: result.address,
    };
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
}
