import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SequenceMap } from "../map/sequence-map";
import { RouteResults } from "./route-results";
import { RouteSearchForm } from "./route-search-form";
import { api } from "../../lib/trpc";

interface Route {
  id: string;
  name: string;
  streets: Array<{
    id: string;
    name: string;
    currentStatus: string | null;
  }>;
  distance: number;
  distanceKm: number;
  travelTimeMinutes: number;
  score: number;
  streetCount: number;
  tripId?: string;
  geometry?: {
    type: "LineString";
    coordinates: [number, number][];
  };
  obstacles?: Array<{
    id: string;
    lat: number;
    lon: number;
    type: string;
    description?: string;
    status?: string;
  }>;
}

// Helper to determine route's current status based on worst street status
function getRouteStatus(route: Route): string | null {
  if (!route.streets || route.streets.length === 0) return null;

  const statusPriority: Record<string, number> = {
    requires_maintenance: 4,
    sufficient: 3,
    medium: 2,
    optimal: 1,
  };

  let worstStatus: string | null = null;
  let worstPriority = 0;

  for (const street of route.streets) {
    if (!street.currentStatus) continue;
    const priority = statusPriority[street.currentStatus] || 0;
    if (priority > worstPriority) {
      worstStatus = street.currentStatus;
      worstPriority = priority;
    }
  }

  return worstStatus;
}

export function RouteFinder() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/(app)/routes" }) as any;

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [endCoords, setEndCoords] = useState<[number, number] | null>(null);
  const [selectedRouteTripId, setSelectedRouteTripId] = useState<string | null>(null);

  // Fetch trip routes for selected route if it's from a trip
  const { data: tripRoutesData } = useQuery(
    selectedRouteTripId
      ? api.trips.detail.queryOptions({ tripId: selectedRouteTripId })
      : {
          queryKey: ["disabled-trip-routes"],
          queryFn: async () => ({ trip: null, routes: [] }),
          enabled: false,
        } as any,
  );
  const tripRoutes = (tripRoutesData as any)?.routes || [];

  // When URL search params change, trigger search
  useEffect(() => {
    const startStreet = search?.startStreet;
    const endStreet = search?.endStreet;

    if (startStreet && endStreet) {
      // Trigger search when URL changes
      performSearch(startStreet, endStreet);
    } else {
      // Clear results if no search params
      setRoutes([]);
      setSelectedRoute(null);
      setStartCoords(null);
      setEndCoords(null);
    }
  }, [search?.startStreet, search?.endStreet]);

  const performSearch = async (startStreet: string, endStreet: string) => {
    setIsSearching(true);
    setRoutes([]);
    setSelectedRoute(null);

    try {
      // Import trpcClient at function level to avoid circular deps
      const { trpcClient } = await import("../../lib/trpc");

      const result = await trpcClient.routing.findRoutes.query({
        startStreetName: startStreet,
        endStreetName: endStreet,
      });

      const foundRoutes = result?.routes || [];
      setRoutes(foundRoutes);
      if (foundRoutes.length > 0) {
        setSelectedRoute(foundRoutes[0]);
      }
      setIsSearching(false);
    } catch (error) {
      console.error("Search failed:", error);
      setIsSearching(false);
    }
  };

  const handleSearchResults = (
    foundRoutes: Route[],
    start?: [number, number],
    end?: [number, number],
    startStreet?: string,
    endStreet?: string,
  ) => {
    // Update coordinates from street data
    if (start) setStartCoords(start);
    if (end) setEndCoords(end);

    // Update URL which will trigger the useEffect above
    if (startStreet && endStreet) {
      navigate({
        search: {
          startStreet,
          endStreet,
        } as any,
      });
    }
  };

  const handleSearchStart = () => {
    // Search is triggered automatically by URL change
  };

  const handleSelectRoute = (route: Route) => {
    setSelectedRoute(route);

    // If this route is from a trip, fetch the trip routes for display
    if (route.tripId) {
      setSelectedRouteTripId(route.tripId);
    } else {
      setSelectedRouteTripId(null);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] bg-white flex flex-col">
      {/* Main Layout: Map on left, Search/Results on right */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Map Section (70%) */}
        <div className="flex-1 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <SequenceMap
            paths={
              selectedRoute && tripRoutes.length > 0
                ? [
                    {
                      id: selectedRoute.id,
                      name: selectedRoute.name,
                      routes: tripRoutes
                        .filter(
                          (route: any) =>
                            route.startLat &&
                            route.startLon &&
                            route.endLat &&
                            route.endLon,
                        )
                        .map((route: any) => ({
                          id: route.id,
                          name: route.name,
                          description: `${route.distance ? (parseFloat(route.distance) / 1000).toFixed(2) : 0} km`,
                          geometry: route.geometry || {
                            type: "LineString" as const,
                            coordinates: [
                              [
                                parseFloat(route.startLon),
                                parseFloat(route.startLat),
                              ],
                              [parseFloat(route.endLon), parseFloat(route.endLat)],
                            ],
                          },
                          currentStatus: route.currentStatus,
                          score: route.score,
                          startLat: route.startLat,
                          startLon: route.startLon,
                          endLat: route.endLat,
                          endLon: route.endLon,
                        })),
                    },
                  ]
                : (selectedRoute ? [selectedRoute] : routes).map((route) => ({
                    id: route.id,
                    name: route.name,
                    routes: [
                      {
                        id: route.id,
                        name: route.name,
                        description: `${route.distanceKm} km • ${route.travelTimeMinutes} min`,
                        geometry: route.geometry || {
                          type: "LineString" as const,
                          coordinates: [],
                        },
                        currentStatus: getRouteStatus(route),
                        score: route.score,
                      },
                    ],
                  }))
            }
            obstacles={selectedRoute?.obstacles || []}
            startCoords={startCoords}
            endCoords={endCoords}
          />
        </div>

        {/* Search and Results Section (30%) */}
        <div className="w-[380px] flex flex-col gap-4 overflow-hidden flex-shrink-0">
          {/* Search Form */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Find a Route
            </h2>
            <RouteSearchForm
              onSearchStart={handleSearchStart}
              onSearchResults={handleSearchResults}
            />
          </div>

          {/* Results Section */}
          {routes.length > 0 || isSearching ? (
            <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              {isSearching ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mb-3 inline-block">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Searching for routes...
                    </p>
                  </div>
                </div>
              ) : routes.length > 0 ? (
                <div className="flex flex-col gap-3 h-full">
                  <h3 className="sticky top-0 bg-white text-sm font-semibold text-gray-900 z-10">
                    Results
                  </h3>
                  <div className="flex-1 overflow-y-auto">
                    <div className="pr-2 pl-2">
                      <RouteResults
                        routes={routes}
                        selectedRoute={selectedRoute}
                        onSelectRoute={handleSelectRoute}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Enter locations to find bike routes
                </p>
              </div>
            </div>
          )}

          {/* Info Box */}
          {routes.length === 0 && !isSearching && (
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
              <p className="font-semibold mb-1">🚴 How it works:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Enter a start location</li>
                <li>Enter a destination</li>
                <li>View ranked bike routes</li>
                <li>Click a route to see details</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
