/**
 * Autocomplete utility functions extracted from StreetAutocomplete component
 */

export interface FilteredSuggestion {
  name: string;
  lat: number;
  lon: number;
  displayName: string;
  type: string;
}

export function filterSuggestions(features: any[]): FilteredSuggestion[] {
  return features
    .filter(
      (item) =>
        item.properties?.type === "street" ||
        item.properties?.type === "road" ||
        item.properties?.type === "residential",
    )
    .map((item) => ({
      name: item.properties?.name || item.properties?.street,
      lat: item.geometry.coordinates[1],
      lon: item.geometry.coordinates[0],
      displayName: item.properties?.name || "Unknown",
      type: item.properties?.type,
    }));
}

export function shouldFetchSuggestions(query: string): boolean {
  return query.trim().length >= 2;
}

export function handleKeyNavigation(
  key: string,
  currentIndex: number,
  suggestionsLength: number,
): number {
  if (suggestionsLength === 0) return -1;

  switch (key) {
    case "ArrowDown":
      return currentIndex < suggestionsLength - 1 ? currentIndex + 1 : 0;
    case "ArrowUp":
      return currentIndex > 0 ? currentIndex - 1 : suggestionsLength - 1;
    default:
      return currentIndex;
  }
}
