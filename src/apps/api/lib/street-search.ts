/**
 * Street search service using OpenStreetMap Nominatim
 * Caches results in-memory (infinite TTL for demo)
 *
 * Nominatim API: https://nominatim.org/
 * Usage Policy: https://nominatim.org/usage_policy.html
 */

export interface StreetResult {
  id: string;
  name: string;
  city?: string;
  country?: string;
  lat: number;
  lon: number;
  geometry?: {
    type: "LineString";
    coordinates: Array<[number, number]>;
  };
}

// In-memory cache (infinite TTL for demo)
const streetCache = new Map<string, StreetResult[]>();

/**
 * Search for streets by name using Nominatim
 * Results are cached in-memory indefinitely
 */
export async function searchStreets(
  query: string,
  city?: string,
): Promise<StreetResult[]> {
  // Create cache key
  const cacheKey = `${query}|${city || ""}`;

  // Check cache first
  if (streetCache.has(cacheKey)) {
    console.log(`[Street Search] Cache hit for: ${cacheKey}`);
    return streetCache.get(cacheKey)!;
  }

  try {
    console.log(`[Street Search] Searching Nominatim for: ${query}`);

    // Build search query
    let searchQuery = query;
    if (city) {
      searchQuery = `${query}, ${city}`;
    }

    const params = new URLSearchParams({
      q: searchQuery,
      format: "json",
      limit: "20",
      featuretype: "street", // Focus on streets
      addressdetails: "1",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent":
            "BestBikePath-Demo/1.0 (+https://github.com/yourusername/best-bike-path)",
        },
      },
    );

    if (!response.ok) {
      console.error(`[Street Search] Nominatim error: ${response.statusText}`);
      return [];
    }

    const results = (await response.json()) as Array<{
      osm_id: string;
      name: string;
      display_name: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
      geojson?: {
        type: string;
        coordinates: number[][] | number[][][];
      };
    }>;

    if (!results || results.length === 0) {
      console.log(`[Street Search] No results for: ${cacheKey}`);
      streetCache.set(cacheKey, []);
      return [];
    }

    // Convert to StreetResult format
    const streetResults: StreetResult[] = results
      .filter((r) => r.name && r.lat && r.lon) // Only valid results
      .map((r, idx) => ({
        id: `street-${r.osm_id || idx}`,
        name: r.name,
        city: r.address?.city || r.address?.town,
        country: r.address?.country,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        // If Nominatim provides LineString geometry, use it
        geometry:
          r.geojson?.type === "LineString"
            ? {
                type: "LineString" as const,
                coordinates: r.geojson.coordinates as Array<[number, number]>,
              }
            : undefined,
      }));

    // Cache results
    streetCache.set(cacheKey, streetResults);
    console.log(
      `[Street Search] Cached ${streetResults.length} results for: ${cacheKey}`,
    );

    return streetResults;
  } catch (error) {
    console.error("[Street Search] Error:", error);
    return [];
  }
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats() {
  return {
    size: streetCache.size,
    keys: Array.from(streetCache.keys()),
  };
}
