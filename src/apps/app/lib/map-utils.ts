/**
 * Map-related utility functions
 */

const STATUS_COLORS: Record<string, string> = {
  optimal: "#22c55e", // green-500
  medium: "#eab308", // yellow-500
  sufficient: "#f97316", // orange-500
  requires_maintenance: "#ef4444", // red-500
  unknown: "#9ca3af", // gray-400
};

export function getStatusColor(status: string | null): string {
  return STATUS_COLORS[status || "unknown"] || STATUS_COLORS.unknown;
}

export function calculateBounds(
  coordinates: Array<[number, number]>,
): [[number, number], [number, number]] {
  if (coordinates.length === 0) {
    return [
      [0, 0],
      [0, 0],
    ];
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const [lon, lat] of coordinates) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }

  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}
