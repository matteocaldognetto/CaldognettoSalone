import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Street search service tests
 * Since the module uses a module-level cache (Map), we need to re-import
 * for isolation or test cache behavior explicitly.
 */

describe("Street Search Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchStreets", () => {
    it("should return parsed street results on success", async () => {
      const mockNominatimResponse = [
        {
          osm_id: "12345",
          name: "Via Roma",
          display_name: "Via Roma, Milan, Lombardy, Italy",
          lat: "45.4642",
          lon: "9.1900",
          address: { city: "Milan", country: "Italy" },
          geojson: {
            type: "LineString",
            coordinates: [
              [9.189, 45.463],
              [9.191, 45.465],
            ],
          },
        },
        {
          osm_id: "67890",
          name: "Via Roma",
          display_name: "Via Roma, Turin, Piedmont, Italy",
          lat: "45.0703",
          lon: "7.6869",
          address: { city: "Turin", country: "Italy" },
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockNominatimResponse), { status: 200 }),
      );

      // Dynamic import to get fresh module state
      const { searchStreets } = await import("../lib/street-search");

      const results = await searchStreets("Via Roma_test1");

      expect(results.length).toBe(2);
      expect(results[0].id).toBe("street-12345");
      expect(results[0].name).toBe("Via Roma");
      expect(results[0].city).toBe("Milan");
      expect(results[0].lat).toBeCloseTo(45.4642, 4);
      expect(results[0].lon).toBeCloseTo(9.19, 4);
      expect(results[0].geometry).toBeDefined();
      expect(results[0].geometry!.type).toBe("LineString");
    });

    it("should omit geometry when Nominatim does not return LineString", async () => {
      const mockResponse = [
        {
          osm_id: "111",
          name: "Piazza Duomo",
          display_name: "Piazza Duomo, Milan",
          lat: "45.4642",
          lon: "9.1900",
          address: { city: "Milan" },
          geojson: { type: "Point", coordinates: [9.19, 45.46] },
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const { searchStreets } = await import("../lib/street-search");
      const results = await searchStreets("Piazza Duomo_test2");

      expect(results[0].geometry).toBeUndefined();
    });

    it("should return empty array on HTTP error", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Server Error", { status: 500, statusText: "Internal Server Error" }),
      );

      const { searchStreets } = await import("../lib/street-search");
      const results = await searchStreets("ErrorStreet_test3");

      expect(results).toEqual([]);
    });

    it("should return empty array on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      const { searchStreets } = await import("../lib/street-search");
      const results = await searchStreets("NetworkFail_test4");

      expect(results).toEqual([]);
    });

    it("should return empty array when no results are found", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      const { searchStreets } = await import("../lib/street-search");
      const results = await searchStreets("NoResultStreet_test5");

      expect(results).toEqual([]);
    });

    it("should filter out results without name, lat, or lon", async () => {
      const mockResponse = [
        {
          osm_id: "1",
          name: "Valid Street",
          display_name: "Valid",
          lat: "45.46",
          lon: "9.19",
        },
        {
          osm_id: "2",
          name: "", // empty name
          display_name: "No Name",
          lat: "45.46",
          lon: "9.19",
        },
        {
          osm_id: "3",
          name: "No Coords",
          display_name: "No Coords",
          lat: "",
          lon: "",
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const { searchStreets } = await import("../lib/street-search");
      const results = await searchStreets("FilterTest_test6");

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Valid Street");
    });

    it("should append city to search query when provided", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      const { searchStreets } = await import("../lib/street-search");
      await searchStreets("Via Roma_test7", "Milan");

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("Via+Roma_test7%2C+Milan");
    });

    it("should use fallback index for id when osm_id is missing", async () => {
      const mockResponse = [
        {
          name: "Unnamed Road",
          display_name: "Unnamed Road",
          lat: "45.46",
          lon: "9.19",
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const { searchStreets } = await import("../lib/street-search");
      const results = await searchStreets("UnnamedRoad_test8");

      expect(results[0].id).toBe("street-0");
    });

    it("should use town as city fallback when city is not in address", async () => {
      const mockResponse = [
        {
          osm_id: "999",
          name: "Country Road",
          display_name: "Country Road, Somewhere",
          lat: "44.50",
          lon: "8.90",
          address: { town: "SmallTown", country: "Italy" },
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const { searchStreets } = await import("../lib/street-search");
      const results = await searchStreets("CountryRoad_test9");

      expect(results[0].city).toBe("SmallTown");
    });
  });

  describe("getCacheStats", () => {
    it("should return cache size and keys", async () => {
      const { getCacheStats } = await import("../lib/street-search");
      const stats = getCacheStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("keys");
      expect(typeof stats.size).toBe("number");
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });
});
