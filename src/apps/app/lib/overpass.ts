/**
 * Overpass API utilities for fetching OpenStreetMap street geometry
 * Gets the actual coordinates of streets/ways from OSM
 */

export interface StreetGeometry {
  name: string;
  coordinates: Array<[number, number]>; // [lon, lat] pairs
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

/**
 * Escape special characters in string for Overpass QL
 * Overpass QL uses backslash escaping for quotes and backslashes in strings
 */
function escapeOverpassString(str: string): string {
  return str
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/"/g, '\\"'); // Escape double quotes
}

/**
 * Parse Overpass XML response and extract way geometry
 * Handles both formats: out geom (coordinates in way) and out (node references)
 */
function parseOverpassXml(xmlText: string): { nodes: Map<string, [number, number]>; ways: any[] } | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    if (xmlDoc.documentElement.nodeName === "parsererror") {
      return null;
    }

    // Extract all nodes (for "out" format without geom)
    const nodes = new Map<string, [number, number]>();
    xmlDoc.querySelectorAll("node").forEach((node) => {
      const id = node.getAttribute("id");
      const lat = parseFloat(node.getAttribute("lat") || "0");
      const lon = parseFloat(node.getAttribute("lon") || "0");
      if (id && lat && lon) {
        nodes.set(id, [lon, lat]);
      }
    });

    // Extract all ways with their node references or geometry
    const ways: any[] = [];
    const wayElements = xmlDoc.querySelectorAll("way");
    for (let i = 0; i < wayElements.length; i++) {
      const way = wayElements[i];
      const id = way.getAttribute("id");
      const name = way.querySelector("tag[k='name']")?.getAttribute("v");

      // Check if this way has inline geometry (from "out geom")
      const ndElements = way.querySelectorAll("nd");
      let geometry: Array<[number, number]> | null = null;
      const nodeRefs: string[] = [];

      for (let j = 0; j < ndElements.length; j++) {
        const nd = ndElements[j];
        // Check if nd has lat/lon (geometry format)
        const lat = nd.getAttribute("lat");
        const lon = nd.getAttribute("lon");

        if (lat && lon) {
          // This is geometry format (out geom)
          if (!geometry) geometry = [];
          geometry.push([parseFloat(lon), parseFloat(lat)]);
        } else {
          // This is node reference format (out)
          const ref = nd.getAttribute("ref");
          if (ref) nodeRefs.push(ref);
        }
      }

      // Only add if we have coordinates
      if ((geometry && geometry.length > 1) || nodeRefs.length > 1) {
        ways.push({ id, name, nodeRefs, geometry });
      }
    }

    return { nodes, ways };
  } catch (error) {
    console.error("[Overpass] XML parsing error:", error);
    return null;
  }
}

/**
 * Fetch street geometry from Overpass API
 * Returns the actual LineString coordinates of a street
 */
export async function getStreetGeometry(
  streetName: string,
  bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number },
): Promise<StreetGeometry | null> {
  try {
    // Default bbox for Milan if not provided
    const searchBbox = bbox || {
      minLat: 45.3568,
      minLon: 9.0976,
      maxLat: 45.5155,
      maxLon: 9.2767,
    };

    // Escape the street name for safe use in Overpass QL
    const escapedName = escapeOverpassString(streetName);

    // Try multiple query strategies for better coverage
    // Overpass API returns XML (not JSON)
    const queries = [
      // Simplest: exact name match with geom (best for connected ways)
      `[bbox:${searchBbox.minLat},${searchBbox.minLon},${searchBbox.maxLat},${searchBbox.maxLon}];(way["name"="${escapedName}"];);out geom;`,

      // Exact name match without geom but higher limit
      `[bbox:${searchBbox.minLat},${searchBbox.minLon},${searchBbox.maxLat},${searchBbox.maxLon}];(way["name"="${escapedName}"];);out geom qt;`,

      // With highway filter and geom
      `[bbox:${searchBbox.minLat},${searchBbox.minLon},${searchBbox.maxLat},${searchBbox.maxLon}];(way["name"="${escapedName}"]["highway"];);out geom;`,

      // Partial match using substring with geom
      `[bbox:${searchBbox.minLat},${searchBbox.minLon},${searchBbox.maxLat},${searchBbox.maxLon}];(way["name"~"${escapedName}"];);out geom;`,

      // Very broad: any highway with matching name pattern
      `[bbox:${searchBbox.minLat},${searchBbox.minLon},${searchBbox.maxLat},${searchBbox.maxLon}];(way["highway"]["name"~"${escapedName}"];);out geom;`,
    ];

    let lastError: any = null;
    let failedQueries = 0;

    // Try queries in sequence
    let xmlData: { nodes: Map<string, [number, number]>; ways: any[] } | null = null;

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      try {
        console.log(`[Overpass] Attempt ${i + 1}/${queries.length} for street: "${streetName}"`);
        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        if (!response.ok) {
          failedQueries++;
          const errorText = await response.text();
          console.warn(`[Overpass] HTTP ${response.status} on attempt ${i + 1}:`, errorText.substring(0, 200));
          lastError = `HTTP ${response.status}`;
          continue;
        }

        const xmlText = await response.text();
        xmlData = parseOverpassXml(xmlText);

        // Check if we got useful data
        if (xmlData && xmlData.ways && xmlData.ways.length > 0) {
          console.log(`[Overpass] Success on attempt ${i + 1}: found ${xmlData.ways.length} ways`);
          break; // Found something, use this response
        }
      } catch (error) {
        failedQueries++;
        console.warn(`[Overpass] Exception on attempt ${i + 1}:`, error);
        lastError = error;
        continue;
      }
    }

    if (!xmlData || !xmlData.ways || xmlData.ways.length === 0) {
      console.warn(
        `[Overpass] No geometry found for: "${streetName}" after ${failedQueries} failed queries. Last error:`,
        lastError,
      );
      return null;
    }

    // Collect all ways and intelligently combine connected segments
    const allWays: Array<{ coordinates: Array<[number, number]> }> = [];

    console.log(`[Overpass] Processing ${xmlData.ways.length} way(s) for street: "${streetName}"`);

    // Extract coordinates from all ways
    for (const way of xmlData.ways) {
      if (!way) continue;

      let wayCoordinates: Array<[number, number]> = [];

      // Check if way has inline geometry (from "out geom")
      if (way.geometry && way.geometry.length > 1) {
        wayCoordinates = way.geometry;
      }
      // Otherwise try to resolve node references (from "out" without geom)
      else if (way.nodeRefs && way.nodeRefs.length > 1) {
        wayCoordinates = way.nodeRefs
          .map((nodeId: string) => xmlData.nodes.get(nodeId))
          .filter((coord: any): coord is [number, number] => coord !== undefined);
      }

      if (wayCoordinates.length > 1) {
        allWays.push({ coordinates: wayCoordinates });
      }
    }

    if (allWays.length === 0) {
      console.warn(`No ways with coordinates found for "${streetName}"`);
      return null;
    }

    // Sort by length (longest first)
    allWays.sort((a, b) => b.coordinates.length - a.coordinates.length);

    // Cluster Merging Algorithm
    // 1. Treating each segment as a cluster
    // 2. Iteratively merge clusters that are close enough at their endpoints
    // 3. Return the largest resulting cluster

    // Initialize clusters
    let clusters: Array<[number, number][]> = allWays.map(w => w.coordinates);
    console.log(`[Overpass] Initialized ${clusters.length} clusters`);

    // Use a larger tolerance to handle OSM data gaps (100m in degrees)
    // At Milan's latitude (~45°N), 1 degree latitude ≈ 111km, 1 degree longitude ≈ 78km
    // So 0.001 degrees ≈ 111m (lat) or 78m (lon)
    const tolerance = 0.0008; // ~60-90 meters depending on direction
    const tolSq = tolerance * tolerance;
    let merged = true;
    let iterations = 0;

    while (merged && clusters.length > 1) {
      merged = false;
      iterations++;
      
      // Try to merge any two clusters
      // We iterate backwards to safely remove items
      outerLoop:
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const c1 = clusters[i];
          const c2 = clusters[j];

          const c1Start = c1[0];
          const c1End = c1[c1.length - 1];
          const c2Start = c2[0];
          const c2End = c2[c2.length - 1];

          // Check all 4 connection possibilities
          const dEndStart = Math.pow(c1End[0] - c2Start[0], 2) + Math.pow(c1End[1] - c2Start[1], 2);
          const dEndEnd = Math.pow(c1End[0] - c2End[0], 2) + Math.pow(c1End[1] - c2End[1], 2);
          const dStartStart = Math.pow(c1Start[0] - c2Start[0], 2) + Math.pow(c1Start[1] - c2Start[1], 2);
          const dStartEnd = Math.pow(c1Start[0] - c2End[0], 2) + Math.pow(c1Start[1] - c2End[1], 2);

          if (dEndStart < tolSq) {
            // c1 end -> c2 start: Append c2 to c1
            clusters[i] = [...c1, ...c2.slice(1)];
            clusters.splice(j, 1); // Remove c2
            merged = true;
            break outerLoop; // Restart loop after modification
          } else if (dEndEnd < tolSq) {
            // c1 end -> c2 end: Append reverse c2 to c1
            clusters[i] = [...c1, ...[...c2].reverse().slice(1)];
            clusters.splice(j, 1);
            merged = true;
            break outerLoop;
          } else if (dStartEnd < tolSq) {
            // c2 end -> c1 start: Prepend c2 to c1
            clusters[i] = [...c2.slice(0, -1), ...c1];
            clusters.splice(j, 1);
            merged = true;
            break outerLoop;
          } else if (dStartStart < tolSq) {
            // c2 start -> c1 start: Prepend reverse c2 to c1
            clusters[i] = [...[...c2].reverse().slice(0, -1), ...c1];
            clusters.splice(j, 1);
            merged = true;
            break outerLoop;
          }
        }
      }
    }

    console.log(`[Overpass] Merging complete after ${iterations} iterations. Remaining clusters: ${clusters.length}`);
    
    // Pick the longest cluster (by number of points)
    clusters.sort((a, b) => b.length - a.length);
    const coordinates = clusters[0];

    if (coordinates.length < 2) {
      console.warn(`Not enough coordinates for "${streetName}": ${coordinates.length}`);
      return null;
    }

    console.log(`[Overpass] Final street geometry: ${coordinates.length} coordinate points`);

    // Calculate bounds
    const lats = coordinates.map((c: [number, number]) => c[1]);
    const lons = coordinates.map((c: [number, number]) => c[0]);

    return {
      name: streetName,
      coordinates,
      bounds: {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLon: Math.min(...lons),
        maxLon: Math.max(...lons),
      },
    };
  } catch (error) {
    console.error("Failed to fetch street geometry from Overpass:", error);
    return null;
  }
}

/**
 * Find the nearest point on a street geometry to a given coordinate
 * Used to snap user clicks to the actual street
 */
export function snapToStreet(
  point: [number, number],
  streetCoordinates: Array<[number, number]>,
): [number, number] {
  let minDistance = Infinity;
  let snappedPoint = point;

  // Find the closest point on the street
  for (const coord of streetCoordinates) {
    const distance = Math.pow(point[0] - coord[0], 2) + Math.pow(point[1] - coord[1], 2);
    if (distance < minDistance) {
      minDistance = distance;
      snappedPoint = coord;
    }
  }

  return snappedPoint;
}

/**
 * Calculate distance along street geometry between two points
 * Returns distance in meters
 */
export function getStreetDistance(
  start: [number, number],
  end: [number, number],
  streetCoordinates: Array<[number, number]>,
): number {
  // Find indices of start and end points in street coordinates
  let startIdx = -1;
  let endIdx = -1;
  let minStartDist = Infinity;
  let minEndDist = Infinity;

  for (let i = 0; i < streetCoordinates.length; i++) {
    const coord = streetCoordinates[i];
    const startDist = Math.pow(start[0] - coord[0], 2) + Math.pow(start[1] - coord[1], 2);
    const endDist = Math.pow(end[0] - coord[0], 2) + Math.pow(end[1] - coord[1], 2);

    if (startDist < minStartDist) {
      minStartDist = startDist;
      startIdx = i;
    }
    if (endDist < minEndDist) {
      minEndDist = endDist;
      endIdx = i;
    }
  }

  if (startIdx === -1 || endIdx === -1) {
    return 0;
  }

  // Calculate distance between points
  let distance = 0;
  const minIdx = Math.min(startIdx, endIdx);
  const maxIdx = Math.max(startIdx, endIdx);

  for (let i = minIdx; i < maxIdx; i++) {
    const lat1 = streetCoordinates[i][1];
    const lon1 = streetCoordinates[i][0];
    const lat2 = streetCoordinates[i + 1][1];
    const lon2 = streetCoordinates[i + 1][0];

    // Haversine formula for distance
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
    distance += R * c * 1000; // Convert to meters
  }

  return distance;
}

export interface NearbyStreet {
  name: string;
  distance: number; // meters from clicked point
  type?: string; // highway type (residential, primary, etc.)
}

/**
 * Find streets near a clicked point on the map
 * Returns a list of nearby streets with their names and distances
 */
export async function getNearbyStreets(
  lat: number,
  lon: number,
  radiusMeters: number = 50,
): Promise<NearbyStreet[]> {
  try {
    // Convert radius from meters to degrees (approximate)
    // At latitude 45°, 1 degree ≈ 78 km for longitude, 111 km for latitude
    const latDegrees = radiusMeters / 111000;
    const lonDegrees = radiusMeters / 78000;

    const minLat = lat - latDegrees;
    const maxLat = lat + latDegrees;
    const minLon = lon - lonDegrees;
    const maxLon = lon + lonDegrees;

    // Query for highways (roads) around the clicked point
    const query = `
      [bbox:${minLat},${minLon},${maxLat},${maxLon}];
      (
        way["highway"]["name"](around:${radiusMeters},${lat},${lon});
      );
      out geom;
    `;

    console.log(`[Overpass] Searching for streets within ${radiusMeters}m of (${lat}, ${lon})`);

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      console.error(`[Overpass] HTTP ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const xmlData = parseOverpassXml(xmlText);

    if (!xmlData || !xmlData.ways || xmlData.ways.length === 0) {
      console.log(`[Overpass] No streets found near (${lat}, ${lon})`);
      return [];
    }

    // Extract street names and calculate distances
    const streets: NearbyStreet[] = [];
    const seenNames = new Set<string>();

    for (const way of xmlData.ways) {
      const name = way.name;
      if (!name || seenNames.has(name)) continue;

      // Get highway type if available
      const highwayType = xmlData?.ways?.find((w: any) => w.id === way.id)?.type;

      // Calculate distance from clicked point to nearest point on this street
      let minDist = Infinity;

      const coords = way.geometry || [];
      for (const coord of coords) {
        const dx = (coord[0] - lon) * 78000; // Convert to meters (approximate)
        const dy = (coord[1] - lat) * 111000;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
        }
      }

      streets.push({
        name,
        distance: Math.round(minDist),
        type: highwayType,
      });

      seenNames.add(name);
    }

    // Sort by distance
    streets.sort((a, b) => a.distance - b.distance);

    console.log(`[Overpass] Found ${streets.length} unique streets:`, streets.map(s => s.name).join(", "));

    return streets;
  } catch (error) {
    console.error("[Overpass] Failed to fetch nearby streets:", error);
    return [];
  }
}
