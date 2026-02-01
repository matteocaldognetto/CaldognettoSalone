import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Input validation schemas used in tRPC routers
 * These tests verify that the validation logic works correctly
 */

describe("Path Report Input Schemas", () => {
  const statusSchema = z.enum([
    "optimal",
    "medium",
    "sufficient",
    "requires_maintenance",
  ]);

  const createReportSchema = z.object({
    tripRouteId: z.string().optional(),
    streetName: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    status: statusSchema,
    obstacles: z.any().optional(),
    isPublishable: z.boolean().default(true),
    collectionMode: z.enum(["manual", "automated"]).default("manual"),
    rating: z.number().min(1).max(5).optional(),
  });

  describe("status validation", () => {
    it("should accept valid status values", () => {
      expect(statusSchema.parse("optimal")).toBe("optimal");
      expect(statusSchema.parse("medium")).toBe("medium");
      expect(statusSchema.parse("sufficient")).toBe("sufficient");
      expect(statusSchema.parse("requires_maintenance")).toBe(
        "requires_maintenance",
      );
    });

    it("should reject invalid status values", () => {
      expect(() => statusSchema.parse("excellent")).toThrow();
      expect(() => statusSchema.parse("bad")).toThrow();
      expect(() => statusSchema.parse("")).toThrow();
      expect(() => statusSchema.parse(123)).toThrow();
    });
  });

  describe("createReportSchema", () => {
    it("should accept valid trip-based report", () => {
      const input = {
        tripRouteId: "route-123",
        status: "optimal",
      };
      const result = createReportSchema.parse(input);
      expect(result.tripRouteId).toBe("route-123");
      expect(result.status).toBe("optimal");
      expect(result.isPublishable).toBe(true); // default
      expect(result.collectionMode).toBe("manual"); // default
    });

    it("should accept valid street-based report", () => {
      const input = {
        streetName: "Via Roma",
        lat: 45.4642,
        lon: 9.19,
        status: "medium",
      };
      const result = createReportSchema.parse(input);
      expect(result.streetName).toBe("Via Roma");
      expect(result.lat).toBe(45.4642);
      expect(result.lon).toBe(9.19);
    });

    it("should apply default values", () => {
      const input = {
        tripRouteId: "route-123",
        status: "optimal",
      };
      const result = createReportSchema.parse(input);
      expect(result.isPublishable).toBe(true);
      expect(result.collectionMode).toBe("manual");
    });

    it("should accept collectionMode: automated", () => {
      const input = {
        tripRouteId: "route-123",
        status: "requires_maintenance",
        collectionMode: "automated",
      };
      const result = createReportSchema.parse(input);
      expect(result.collectionMode).toBe("automated");
    });

    it("should reject invalid collectionMode", () => {
      const input = {
        tripRouteId: "route-123",
        status: "optimal",
        collectionMode: "automatic", // wrong spelling
      };
      expect(() => createReportSchema.parse(input)).toThrow();
    });
  });

  describe("rating validation", () => {
    it("should accept valid ratings 1-5", () => {
      for (let rating = 1; rating <= 5; rating++) {
        const result = createReportSchema.parse({
          tripRouteId: "route-123",
          status: "optimal",
          rating,
        });
        expect(result.rating).toBe(rating);
      }
    });

    it("should reject rating below 1", () => {
      expect(() =>
        createReportSchema.parse({
          tripRouteId: "route-123",
          status: "optimal",
          rating: 0,
        }),
      ).toThrow();
    });

    it("should reject rating above 5", () => {
      expect(() =>
        createReportSchema.parse({
          tripRouteId: "route-123",
          status: "optimal",
          rating: 6,
        }),
      ).toThrow();
    });

    it("should allow undefined rating", () => {
      const result = createReportSchema.parse({
        tripRouteId: "route-123",
        status: "optimal",
      });
      expect(result.rating).toBeUndefined();
    });
  });
});

describe("List Query Schemas", () => {
  const listSchema = z.object({
    status: z
      .enum(["optimal", "medium", "sufficient", "requires_maintenance"])
      .optional(),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
  });

  it("should apply default pagination values", () => {
    const result = listSchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("should accept custom pagination", () => {
    const result = listSchema.parse({ limit: 20, offset: 40 });
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(40);
  });

  it("should reject limit above 100", () => {
    expect(() => listSchema.parse({ limit: 150 })).toThrow();
  });

  it("should reject negative offset", () => {
    expect(() => listSchema.parse({ offset: -1 })).toThrow();
  });

  it("should accept status filter", () => {
    const result = listSchema.parse({ status: "optimal" });
    expect(result.status).toBe("optimal");
  });
});

describe("Trip Input Schemas", () => {
  const geoJSONSchema = z.object({
    type: z.literal("LineString"),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
  });

  const createTripSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    geometry: geoJSONSchema.optional(),
    distanceMeters: z.number().min(0).optional(),
  });

  describe("GeoJSON validation", () => {
    it("should accept valid LineString geometry", () => {
      const geometry = {
        type: "LineString" as const,
        coordinates: [
          [9.19, 45.4642],
          [9.1795, 45.4706],
        ] as [number, number][],
      };
      const result = geoJSONSchema.parse(geometry);
      expect(result.type).toBe("LineString");
      expect(result.coordinates.length).toBe(2);
    });

    it("should reject non-LineString types", () => {
      expect(() =>
        geoJSONSchema.parse({
          type: "Point",
          coordinates: [9.19, 45.4642],
        }),
      ).toThrow();
    });

    it("should reject invalid coordinate format", () => {
      expect(() =>
        geoJSONSchema.parse({
          type: "LineString",
          coordinates: [[9.19, 45.4642, 100]], // 3D coordinates not allowed
        }),
      ).toThrow();
    });
  });

  describe("trip creation validation", () => {
    it("should accept minimal trip input", () => {
      const result = createTripSchema.parse({});
      expect(result).toBeDefined();
    });

    it("should accept full trip input", () => {
      const input = {
        name: "Morning Ride",
        startTime: "2024-06-15T08:00:00Z",
        endTime: "2024-06-15T09:30:00Z",
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [9.19, 45.4642],
            [9.1795, 45.4706],
          ] as [number, number][],
        },
        distanceMeters: 5000,
      };
      const result = createTripSchema.parse(input);
      expect(result.name).toBe("Morning Ride");
      expect(result.distanceMeters).toBe(5000);
    });

    it("should reject trip name over 100 chars", () => {
      expect(() =>
        createTripSchema.parse({
          name: "x".repeat(101),
        }),
      ).toThrow();
    });

    it("should reject negative distance", () => {
      expect(() =>
        createTripSchema.parse({
          distanceMeters: -100,
        }),
      ).toThrow();
    });

    it("should reject invalid datetime format", () => {
      expect(() =>
        createTripSchema.parse({
          startTime: "not-a-date",
        }),
      ).toThrow();
    });
  });
});

describe("Street Search Schemas", () => {
  const searchSchema = z.object({
    query: z.string().min(2).max(100),
    limit: z.number().min(1).max(20).default(10),
  });

  it("should accept valid search query", () => {
    const result = searchSchema.parse({ query: "Via Roma" });
    expect(result.query).toBe("Via Roma");
    expect(result.limit).toBe(10); // default
  });

  it("should reject too short query", () => {
    expect(() => searchSchema.parse({ query: "V" })).toThrow();
  });

  it("should reject too long query", () => {
    expect(() => searchSchema.parse({ query: "x".repeat(101) })).toThrow();
  });

  it("should accept custom limit", () => {
    const result = searchSchema.parse({ query: "Via", limit: 5 });
    expect(result.limit).toBe(5);
  });

  it("should reject limit above 20", () => {
    expect(() => searchSchema.parse({ query: "Via", limit: 50 })).toThrow();
  });
});
