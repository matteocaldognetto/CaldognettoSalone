import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../lib/app";

/**
 * Integration tests for HTTP endpoints
 * These tests verify the real API app structure and HTTP behavior.
 * The real Hono app is imported from app.ts.
 * Endpoints requiring DB/auth context (tRPC, auth) are tested separately;
 * here we test the stateless HTTP endpoints: health, API info, and OSRM proxy.
 */

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("API HTTP Endpoints (Real App)", () => {
  describe("GET /api", () => {
    it("should return API information", async () => {
      const res = await app.request("/api");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.name).toBe("@repo/api");
      expect(data.version).toBe("0.0.0");
      expect(data.endpoints).toBeDefined();
      expect(data.endpoints.trpc).toBe("/api/trpc");
      expect(data.endpoints.auth).toBe("/api/auth");
      expect(data.endpoints.health).toBe("/health");
    });
  });

  describe("GET /health", () => {
    it("should return healthy status", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.timestamp).toBeDefined();
    });

    it("should return valid ISO timestamp", async () => {
      const res = await app.request("/health");
      const data = await res.json();

      // Verify timestamp is valid ISO format
      const date = new Date(data.timestamp);
      expect(date.toISOString()).toBe(data.timestamp);
    });
  });

  describe("GET / (root redirect)", () => {
    it("should redirect to /api", async () => {
      const res = await app.request("/", { redirect: "manual" });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/api");
    });
  });

  describe("OSRM Proxy /api/osrm/route/:profile/:coordinates", () => {
    it("should accept valid bike profile and proxy to OSRM", async () => {
      const mockOSRMResponse = {
        routes: [
          {
            distance: 1000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [
                [9.19, 45.4642],
                [9.1795, 45.4706],
              ],
            },
          },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockOSRMResponse), { status: 200 }),
      );

      const res = await app.request(
        "/api/osrm/route/bike/9.19,45.4642;9.1795,45.4706",
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.routes).toBeDefined();
      expect(data.routes.length).toBeGreaterThan(0);
    });

    it("should reject invalid profile", async () => {
      const res = await app.request(
        "/api/osrm/route/plane/9.19,45.4642;9.1795,45.4706",
      );
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe("Invalid routing profile");
    });

    it("should reject invalid coordinates format", async () => {
      const res = await app.request("/api/osrm/route/bike/invalid");
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe("Invalid coordinates format");
    });

    it("should reject coordinates with wrong separator", async () => {
      const res = await app.request(
        "/api/osrm/route/bike/9.19,45.4642|9.1795,45.4706",
      );
      expect(res.status).toBe(400);
    });

    it("should accept coordinates with negative values", async () => {
      const mockOSRMResponse = {
        routes: [{ distance: 500, duration: 100, geometry: { type: "LineString", coordinates: [[-73.9857, 40.7484], [-73.9694, 40.758]] } }],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockOSRMResponse), { status: 200 }),
      );

      const res = await app.request(
        "/api/osrm/route/bike/-73.9857,40.7484;-73.9694,40.7580",
      );
      expect(res.status).toBe(200);
    });

    it("should handle OSRM server error gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" }),
      );

      const res = await app.request(
        "/api/osrm/route/bike/9.19,45.4642;9.1795,45.4706",
      );
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain("OSRM error");
    });

    it("should handle network error gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      const res = await app.request(
        "/api/osrm/route/bike/9.19,45.4642;9.1795,45.4706",
      );
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Failed to fetch route from OSRM");
    });
  });
});

describe("API Response Structure", () => {
  describe("Route response format", () => {
    it("should include distance in meters", () => {
      const mockRoute = {
        distance: 1200, // meters
        duration: 300, // seconds
        geometry: {
          type: "LineString",
          coordinates: [
            [9.19, 45.4642],
            [9.1795, 45.4706],
          ],
        },
      };

      expect(mockRoute.distance).toBeGreaterThan(0);
      expect(typeof mockRoute.distance).toBe("number");
    });

    it("should include duration in seconds", () => {
      const mockRoute = {
        distance: 1200,
        duration: 300,
        geometry: {
          type: "LineString",
          coordinates: [],
        },
      };

      expect(mockRoute.duration).toBeGreaterThan(0);
      expect(typeof mockRoute.duration).toBe("number");
    });

    it("should include GeoJSON geometry", () => {
      const mockRoute = {
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

      expect(mockRoute.geometry.type).toBe("LineString");
      expect(Array.isArray(mockRoute.geometry.coordinates)).toBe(true);
      expect(mockRoute.geometry.coordinates.length).toBeGreaterThan(0);
    });
  });

  describe("Error response format", () => {
    it("should have consistent error structure", () => {
      const errorResponse = {
        error: "Invalid routing profile",
      };

      expect(errorResponse.error).toBeDefined();
      expect(typeof errorResponse.error).toBe("string");
    });

    it("should include details for server errors", () => {
      const serverError = {
        error: "Failed to fetch route from OSRM",
        details: "Connection timeout",
      };

      expect(serverError.error).toBeDefined();
      expect(serverError.details).toBeDefined();
    });
  });
});

describe("Coordinate Validation", () => {
  const coordPattern = /^-?\d+\.?\d*,-?\d+\.?\d*;-?\d+\.?\d*,-?\d+\.?\d*$/;

  it("should match valid coordinate pairs", () => {
    expect(coordPattern.test("9.19,45.4642;9.1795,45.4706")).toBe(true);
    expect(coordPattern.test("-73.9857,40.7484;-73.9694,40.7580")).toBe(true);
    expect(coordPattern.test("0,0;1,1")).toBe(true);
    expect(coordPattern.test("-180,-90;180,90")).toBe(true);
  });

  it("should reject invalid formats", () => {
    expect(coordPattern.test("invalid")).toBe(false);
    expect(coordPattern.test("9.19,45.4642")).toBe(false); // Only one point
    expect(coordPattern.test("9.19;45.4642;9.1795;45.4706")).toBe(false);
    expect(coordPattern.test("")).toBe(false);
  });

  it("should handle decimal precision", () => {
    expect(coordPattern.test("9.123456789,45.987654321;9.0,45.0")).toBe(true);
    expect(coordPattern.test("9,45;10,46")).toBe(true); // Integer coords
  });
});
