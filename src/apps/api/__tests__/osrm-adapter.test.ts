import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getOSRMRoute,
  osrmToGeoJSON,
  validateCoordinates,
  type OSRMRoute,
} from "../lib/routing";

/**
 * Section 8: OSRM Adapter Tests
 * Tests OSRM route fetching with mocked fetch
 */

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("OSRM Route Fetching", () => {
  it("should parse valid OSRM response into route result", async () => {
    const mockResponse = {
      routes: [
        {
          distance: 1200,
          duration: 300,
          geometry: {
            type: "LineString",
            coordinates: [
              [9.19, 45.4642],
              [9.185, 45.468],
              [9.1795, 45.4706],
            ],
          },
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);

    expect(result).not.toBeNull();
    expect(result!.distance).toBe(1200);
    expect(result!.duration).toBe(300);
    expect(result!.geometry.coordinates).toHaveLength(3);
    expect(result!.geometry.type).toBe("LineString");
  });

  it("should handle OSRM error response (no routes found)", async () => {
    const mockResponse = {
      code: "NoRoute",
      routes: [],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);
    expect(result).toBeNull();
  });

  it("should handle OSRM server error (500)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" }),
    );

    const result = await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);
    expect(result).toBeNull();
  });

  it("should handle network timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("The operation was aborted due to timeout"),
    );

    const result = await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);
    expect(result).toBeNull();
  });

  it("should handle empty geometry in response", async () => {
    const mockResponse = {
      routes: [
        {
          distance: 0,
          duration: 0,
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);
    expect(result).not.toBeNull();
    expect(result!.geometry.coordinates).toHaveLength(0);
  });

  it("should construct correct OSRM API URL with coordinates and profile", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ routes: [] }), { status: 200 }),
    );

    await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("router.project-osrm.org/route/v1/bike/");
    expect(url).toContain("9.19,45.4642;9.1795,45.4706");
    expect(url).toContain("geometries=geojson");
    expect(url).toContain("overview=full");
  });

  it("should support bike routing profile", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ routes: [] }), { status: 200 }),
    );

    await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/bike/");
  });

  it("should handle malformed JSON response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("not json", { status: 200 }),
    );

    const result = await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);
    expect(result).toBeNull();
  });

  it("should handle empty response body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 200 }),
    );

    const result = await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);
    expect(result).toBeNull();
  });

  it("should handle response without routes property", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "Ok" }), { status: 200 }),
    );

    const result = await getOSRMRoute(9.19, 45.4642, 9.1795, 45.4706);
    expect(result).toBeNull();
  });
});

describe("osrmToGeoJSON conversion", () => {
  it("should convert OSRM route to GeoJSON LineString", () => {
    const route: OSRMRoute = {
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

    const geojson = osrmToGeoJSON(route);
    expect(geojson.type).toBe("LineString");
    expect(geojson.coordinates).toEqual(route.geometry.coordinates);
  });

  it("should preserve all coordinates from OSRM response", () => {
    const route: OSRMRoute = {
      distance: 5000,
      duration: 1200,
      geometry: {
        type: "LineString",
        coordinates: [
          [9.19, 45.4642],
          [9.185, 45.465],
          [9.18, 45.468],
          [9.175, 45.47],
          [9.1795, 45.4706],
        ],
      },
    };

    const geojson = osrmToGeoJSON(route);
    expect(geojson.coordinates).toHaveLength(5);
  });
});

describe("Coordinate Validation for OSRM", () => {
  it("should accept valid Milan coordinates", () => {
    expect(validateCoordinates(45.4642, 9.19)).toBe(true);
  });

  it("should accept coordinates at boundary values", () => {
    expect(validateCoordinates(90, 180)).toBe(true);
    expect(validateCoordinates(-90, -180)).toBe(true);
  });

  it("should reject out-of-range coordinates", () => {
    expect(validateCoordinates(91, 0)).toBe(false);
    expect(validateCoordinates(0, 181)).toBe(false);
  });

  it("should reject NaN values", () => {
    expect(validateCoordinates(NaN, 0)).toBe(false);
    expect(validateCoordinates(0, NaN)).toBe(false);
  });
});
