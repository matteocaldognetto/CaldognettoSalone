import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWeather } from "../lib/weather";

describe("Weather Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchWeather", () => {
    it("should return weather data on successful response", async () => {
      const mockResponse = {
        main: { temp: 293.15 },
        weather: [{ description: "clear sky" }],
        wind: { speed: 3.5 },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await fetchWeather(45.4642, 9.19);

      expect(result).not.toBeNull();
      expect(result!.temperature).toBe(293.15);
      expect(result!.conditions).toBe("clear sky");
      expect(result!.windSpeed).toBe(3.5);
    });

    it("should return null on HTTP error", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      const result = await fetchWeather(45.4642, 9.19);
      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Network timeout"),
      );

      const result = await fetchWeather(45.4642, 9.19);
      expect(result).toBeNull();
    });

    it("should handle missing temperature gracefully", async () => {
      const mockResponse = {
        main: { temp: null },
        weather: [{ description: "cloudy" }],
        wind: { speed: 2.0 },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await fetchWeather(45.4642, 9.19);

      expect(result).not.toBeNull();
      expect(result!.temperature).toBeNull();
      expect(result!.conditions).toBe("cloudy");
    });

    it("should handle missing weather array gracefully", async () => {
      const mockResponse = {
        main: { temp: 290 },
        weather: null,
        wind: { speed: 5.0 },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await fetchWeather(45.4642, 9.19);

      expect(result).not.toBeNull();
      expect(result!.conditions).toBeNull();
    });

    it("should handle missing wind data gracefully", async () => {
      const mockResponse = {
        main: { temp: 288 },
        weather: [{ description: "rain" }],
        wind: null,
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await fetchWeather(45.4642, 9.19);

      expect(result).not.toBeNull();
      expect(result!.windSpeed).toBeNull();
    });

    it("should handle completely empty response body", async () => {
      const mockResponse = {};

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await fetchWeather(45.4642, 9.19);

      expect(result).not.toBeNull();
      expect(result!.temperature).toBeNull();
      expect(result!.conditions).toBeNull();
      expect(result!.windSpeed).toBeNull();
    });

    it("should construct the correct API URL with coordinates", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      await fetchWeather(45.4642, 9.19);

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("api.openweathermap.org");
      expect(url).toContain("lat=45.4642");
      expect(url).toContain("lon=9.19");
    });

    it("should handle empty weather array", async () => {
      const mockResponse = {
        main: { temp: 295 },
        weather: [],
        wind: { speed: 1.0 },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await fetchWeather(45.4642, 9.19);

      expect(result).not.toBeNull();
      expect(result!.conditions).toBeNull();
    });
  });
});
