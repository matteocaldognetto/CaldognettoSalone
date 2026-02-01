export type OpenWeatherResponse = {
  main?: { temp?: number | null };
  weather?: ({ description?: string } | null)[] | null;
  wind?: { speed?: number | null } | null;
};

export async function fetchWeather(lat: number, lng: number) {
  // Use OpenWeatherMap free tier
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Weather fetch failed: HTTP", response.status);
      return null;
    }

    const data = (await response.json()) as OpenWeatherResponse;

    return {
      temperature: data.main?.temp ?? null,
      conditions: data.weather?.[0]?.description ?? null,
      windSpeed: data.wind?.speed ?? null,
    };
  } catch (error) {
    console.error("Weather fetch failed:", error);
    return null; // Graceful fallback
  }
}
