import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeAddress, reverseGeocode } from "../lib/geocoding";

describe("Geocoding Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("geocodeAddress", () => {
    it("should return parsed geocoding result on success", async () => {
      const mockResponse = [
        {
          lat: "45.4642",
          lon: "9.1900",
          display_name: "Milan, Lombardy, Italy",
          address: { road: "Via Roma", city: "Milan", country: "Italy" },
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await geocodeAddress("Milan, Italy");

      expect(result).not.toBeNull();
      expect(result!.lat).toBeCloseTo(45.4642, 4);
      expect(result!.lon).toBeCloseTo(9.19, 4);
      expect(result!.displayName).toBe("Milan, Lombardy, Italy");
      expect(result!.address).toEqual({
        road: "Via Roma",
        city: "Milan",
        country: "Italy",
      });
    });

    it("should return null when no results are found", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      const result = await geocodeAddress("NonexistentPlace12345");
      expect(result).toBeNull();
    });

    it("should return null on HTTP error", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Too Many Requests", { status: 429, statusText: "Too Many Requests" }),
      );

      const result = await geocodeAddress("Milan");
      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await geocodeAddress("Milan");
      expect(result).toBeNull();
    });

    it("should send correct query parameters", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      await geocodeAddress("Via Roma, Milan");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("nominatim.openstreetmap.org/search");
      expect(url).toContain("q=Via+Roma%2C+Milan");
      expect(url).toContain("format=json");
      expect(url).toContain("limit=1");
    });

    it("should include User-Agent header", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      await geocodeAddress("Milan");

      const options = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(options.headers).toBeDefined();
      expect((options.headers as Record<string, string>)["User-Agent"]).toContain(
        "BestBikePath",
      );
    });

    it("should parse lat/lon from string to number", async () => {
      const mockResponse = [
        {
          lat: "45.4642035",
          lon: "9.1899900",
          display_name: "Milan",
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await geocodeAddress("Milan");
      expect(typeof result!.lat).toBe("number");
      expect(typeof result!.lon).toBe("number");
    });

    it("should return first result when multiple are returned", async () => {
      const mockResponse = [
        { lat: "45.4642", lon: "9.1900", display_name: "Milan, Italy" },
        { lat: "42.3601", lon: "-71.0589", display_name: "Milan, USA" },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await geocodeAddress("Milan");
      expect(result!.displayName).toBe("Milan, Italy");
    });
  });

  describe("reverseGeocode", () => {
    it("should return address for valid coordinates", async () => {
      const mockResponse = {
        lat: "45.4642",
        lon: "9.1900",
        display_name: "Piazza del Duomo, Milan, Lombardy, Italy",
        address: { road: "Piazza del Duomo", city: "Milan", country: "Italy" },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await reverseGeocode(45.4642, 9.19);

      expect(result).not.toBeNull();
      expect(result!.displayName).toBe("Piazza del Duomo, Milan, Lombardy, Italy");
      expect(result!.lat).toBeCloseTo(45.4642, 4);
      expect(result!.lon).toBeCloseTo(9.19, 4);
    });

    it("should return null on HTTP error", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 }),
      );

      const result = await reverseGeocode(0, 0);
      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("DNS resolution failed"),
      );

      const result = await reverseGeocode(45.4642, 9.19);
      expect(result).toBeNull();
    });

    it("should send lat/lon as query parameters", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ lat: "45", lon: "9", display_name: "Test" }), {
          status: 200,
        }),
      );

      await reverseGeocode(45.4642, 9.19);

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("nominatim.openstreetmap.org/reverse");
      expect(url).toContain("lat=45.4642");
      expect(url).toContain("lon=9.19");
      expect(url).toContain("format=json");
    });

    it("should include User-Agent header", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ lat: "45", lon: "9", display_name: "Test" }), {
          status: 200,
        }),
      );

      await reverseGeocode(45.4642, 9.19);

      const options = fetchSpy.mock.calls[0][1] as RequestInit;
      expect((options.headers as Record<string, string>)["User-Agent"]).toContain(
        "BestBikePath",
      );
    });
  });
});
