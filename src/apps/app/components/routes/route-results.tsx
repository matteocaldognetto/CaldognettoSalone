import { Card } from "@repo/ui";
import { useState } from "react";

interface Street {
  id: string;
  name: string;
  currentStatus: string | null;
}

interface Route {
  id: string;
  name: string;
  streets: Street[];
  distance: number;
  distanceKm: number;
  travelTimeMinutes: number;
  score: number;
  streetCount: number;
  obstacles?: Array<{
    id: string;
    lat: number;
    lon: number;
    type: string;
    description?: string;
    status?: string;
  }>;
}

interface RouteResultsProps {
  routes: Route[];
  onSelectRoute?: (route: Route) => void;
  selectedRoute?: Route | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> =
  {
    optimal: { bg: "bg-green-100", text: "text-green-800", label: "Optimal" },
    medium: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Good" },
    sufficient: { bg: "bg-orange-100", text: "text-orange-800", label: "Fair" },
    requires_maintenance: {
      bg: "bg-red-100",
      text: "text-red-800",
      label: "Needs Work",
    },
  };

const getStatusColor = (
  status: string | null,
): { bg: string; text: string; label: string } => {
  if (!status) return { bg: "bg-gray-100", text: "text-gray-800", label: "Unknown" };
  return STATUS_COLORS[status] || { bg: "bg-gray-100", text: "text-gray-800", label: "Unknown" };
};

export function RouteResults({
  routes,
  onSelectRoute,
  selectedRoute,
}: RouteResultsProps) {
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  if (routes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-gray-600">
        No routes found. Try different locations.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Found {routes.length} route{routes.length !== 1 ? "s" : ""}
        </h3>
        <span className="text-sm text-gray-600">Ranked by quality</span>
      </div>

      {routes.map((route, index) => {
        const isSelected = selectedRoute?.id === route.id;
        const isExpanded = expandedRoute === route.id;
        const colors = getStatusColor(
          route.streets[0]?.currentStatus || null
        );

        return (
          <Card
            key={route.id}
            className={`cursor-pointer transition-all ${
              isSelected ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => {
              onSelectRoute?.(route);
              setExpandedRoute(isExpanded ? null : route.id);
            }}
          >
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <h4 className="text-sm font-medium">{route.name}</h4>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    {/* Status Color Indicator with Label */}
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${
                          colors.bg
                        }`}
                      ></span>
                      <span className={`text-xs font-medium ${colors.text}`}>
                        {colors.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      • {route.streetCount} street{route.streetCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Score Badge */}
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {route.score}
                  </div>
                  <p className="text-xs text-gray-600">Quality</p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-md bg-gray-50 p-2">
                  <p className="text-xs text-gray-600">Distance</p>
                  <p className="font-semibold text-gray-900">
                    {route.distanceKm} km
                  </p>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <p className="text-xs text-gray-600">Travel Time</p>
                  <p className="font-semibold text-gray-900">
                    {route.travelTimeMinutes} min
                  </p>
                </div>
                <div className={`rounded-md p-2 ${
                  (route.obstacles?.length || 0) > 0
                    ? "bg-orange-50"
                    : "bg-gray-50"
                }`}>
                  <p className="text-xs text-gray-600">Obstacles</p>
                  <p className={`font-semibold ${
                    (route.obstacles?.length || 0) > 0
                      ? "text-orange-900"
                      : "text-gray-900"
                  }`}>
                    {route.obstacles?.length || 0}
                  </p>
                </div>
              </div>

              {/* Expandable Details */}
              {isExpanded && (
                <div className="mt-4 border-t pt-4 space-y-4">
                  <div>
                    <h5 className="mb-2 text-xs font-semibold text-gray-700">
                      Streets on this route:
                    </h5>
                    <div className="space-y-2">
                      {route.streets.map((street, idx) => {
                        const statusColor = getStatusColor(
                          street.currentStatus
                        );
                        return (
                          <div
                            key={street.id}
                            className="flex items-center justify-between rounded bg-gray-50 p-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500">
                                {idx + 1}.
                              </span>
                              <span className="text-sm text-gray-900">
                                {street.name}
                              </span>
                            </div>
                            {street.currentStatus && (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                              >
                                {statusColor.label}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Obstacles Section */}
                  {route.obstacles && route.obstacles.length > 0 && (
                    <div>
                      <h5 className="mb-2 text-xs font-semibold text-gray-700">
                        Reported obstacles ({route.obstacles.length}):
                      </h5>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {route.obstacles.map((obstacle) => (
                          <div
                            key={obstacle.id}
                            className="rounded bg-orange-50 p-2 border border-orange-100"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-orange-900 capitalize">
                                  {obstacle.type.replace(/_/g, " ")}
                                </p>
                                {obstacle.description && (
                                  <p className="text-xs text-orange-700 mt-1 line-clamp-2">
                                    {obstacle.description}
                                  </p>
                                )}
                                {obstacle.status && (
                                  <p className="text-xs text-orange-600 mt-1 capitalize">
                                    {obstacle.status}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Details Footer */}
                  <p className="mt-2 text-xs text-gray-600">
                    Click "Select Route" to view on map
                  </p>
                </div>
              )}

              {/* Selection Indicator */}
              {!isExpanded && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  {isSelected && (
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500"></span>
                  )}
                  <span
                    className="text-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedRoute(route.id);
                    }}
                  >
                    Click to see streets →
                  </span>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* Info Box */}
      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
        <p className="font-semibold">💡 Route Quality Score</p>
        <p className="mt-1">
          Calculated from street conditions, route efficiency, and recent user
          reports. Higher scores indicate better bike routes.
        </p>
      </div>
    </div>
  );
}
