/**
 * Record a Trip with Routes
 * Enter trip info, add routes, then review with gorgeous cards
 */

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ChevronLeft, Loader2, Map, MapPin, Plus, Search, Star, Trash2, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { SequenceMap } from "../../components/map/sequence-map";
import { StreetMapPicker } from "../../components/map/street-map-picker";
import { StreetPicker } from "../../components/map/street-picker";
import { ObstacleDialog } from "../../components/obstacles/obstacle-dialog";
import {
  StreetAutocomplete,
  type StreetSuggestion,
} from "../../components/street-autocomplete";
import {
  TripReviewScreen,
  type TripData,
} from "../../components/trips/trip-review-screen";
import { generateRandomCoordinates, getRoute } from "../../lib/osrm";
import { getStreetGeometry, type StreetGeometry } from "../../lib/overpass";
import { sessionQueryOptions } from "../../lib/queries/session";
import { api } from "../../lib/trpc";

export const Route = createFileRoute("/(app)/trip-record")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionQueryOptions());
    if (!session?.user || !session?.session) {
      throw redirect({ to: "/login", search: { redirect: "/trip-record" } });
    }
  },
  component: TripRecordPage,
});

interface Route {
  name: string;
  startLat: string;
  startLon: string;
  endLat: string;
  endLon: string;
  distance: string;
  geometry: {
    type: "LineString";
    coordinates: Array<[number, number]>;
  };
  duration?: number; // OSRM duration in seconds (cached from automatic mode)
}

type PageStep = "builder" | "review";

function TripRecordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<PageStep>("builder");

  // Trip Info
  const [tripName, setTripName] = useState("");
  const [tripDescription, setTripDescription] = useState("");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [usedAutomaticMode, setUsedAutomaticMode] = useState(false);
  const [tripDurationMinutes, setTripDurationMinutes] = useState<number | "">(
    "",
  );
  const [showAutomaticModeModal, setShowAutomaticModeModal] = useState(false);
  const [routeStatuses, setRouteStatuses] = useState<
    Record<number, "optimal" | "medium" | "sufficient" | "requires_maintenance">
  >({});

  // Weather Info
  const [weatherCondition, setWeatherCondition] = useState("clear");
  const [temperature, setTemperature] = useState<number | "">("");
  const [windSpeed, setWindSpeed] = useState<number | "">("");
  const [humidity, setHumidity] = useState<number | "">("");

  // Form state for street-based route entry
  const [streetName, setStreetName] = useState("");
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [isFetchingStreetGeometry, setIsFetchingStreetGeometry] =
    useState(false);
  const [selectedStreet, setSelectedStreet] = useState<StreetSuggestion | null>(
    null,
  );
  const [streetGeometry, setStreetGeometry] = useState<StreetGeometry | null>(
    null,
  );
  const [startLat, setStartLat] = useState("");
  const [startLon, setStartLon] = useState("");
  const [endLat, setEndLat] = useState("");
  const [endLon, setEndLon] = useState("");
  const [distance, setDistance] = useState("");

  // Street selection mode: "search" (autocomplete) or "map" (click on map)
  const [selectionMode, setSelectionMode] = useState<"search" | "map">("search");

  // Obstacle marking state
  const [enableObstacles, setEnableObstacles] = useState(false);
  const [obstacles, setObstacles] = useState<
    Array<{
      id: string;
      lat: number;
      lon: number;
      type: string;
      description?: string;
      routeIndex?: number; // Track which route this obstacle belongs to
    }>
  >([]);
  const [obstacleDialogOpen, setObstacleDialogOpen] = useState(false);
  const [pendingObstacleCoords, setPendingObstacleCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [isSavingObstacle, setIsSavingObstacle] = useState(false);
  const [rating, setRating] = useState<number | null>(4);
  const [confirmedObstacleIds, setConfirmedObstacleIds] = useState<Set<string>>(new Set());

  const createTrip = useMutation(api.trips.create.mutationOptions({}));

  const addRouteMutation = useMutation(api.trips.addRoute.mutationOptions({}));

  const addObstacleMutation = useMutation(
    api.trips.addObstacle.mutationOptions({}),
  );

  const createPathReportMutation = useMutation(
    api.pathReport.create.mutationOptions({}),
  );

  const publishTripMutation = useMutation(
    api.path.publishTripAsPath.mutationOptions({
      onSuccess: () => {
        navigate({ to: "/routes" });
      },
    }),
  );

  const handleStreetSelect = async (street: StreetSuggestion) => {
    setSelectedStreet(street);
    setStreetName(street.name);

    // Fetch the actual street geometry from Overpass API
    setIsFetchingStreetGeometry(true);
    try {
      const geometry = await getStreetGeometry(street.name);
      if (geometry) {
        setStreetGeometry(geometry);
      } else {
        alert("Could not load street geometry. Please try another street.");
        setSelectedStreet(null);
      }
    } catch (error) {
      console.error("Failed to fetch street geometry:", error);
      alert("Error loading street. Please try again.");
      setSelectedStreet(null);
    } finally {
      setIsFetchingStreetGeometry(false);
    }
  };

  const handleStreetPickerComplete = async (
    startLatNum: number,
    startLonNum: number,
    endLatNum: number,
    endLonNum: number,
  ) => {
    setStartLat(startLatNum.toFixed(4));
    setStartLon(startLonNum.toFixed(4));
    setEndLat(endLatNum.toFixed(4));
    setEndLon(endLonNum.toFixed(4));

    // Fetch actual route from OSRM between these precise points
    setIsCalculatingDistance(true);
    try {
      const routeResult = await getRoute(
        startLonNum,
        startLatNum,
        endLonNum,
        endLatNum,
      );

      if (routeResult && routeResult.coordinates.length > 0) {
        setDistance((routeResult.distance / 1000).toFixed(2));
      } else {
        // Fallback: calculate straight-line distance
        const distance = Math.sqrt(
          Math.pow(endLatNum - startLatNum, 2) +
            Math.pow(endLonNum - startLonNum, 2),
        );
        setDistance((distance * 111).toFixed(2)); // ~111 km per degree
      }

      // Reset street geometry picker
      setStreetGeometry(null);
      setSelectedStreet(null);
    } catch (error) {
      console.error("Failed to route between points:", error);
      alert("Error calculating route. Please try again.");
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const addRoute = async () => {
    if (
      !streetName ||
      !startLat ||
      !startLon ||
      !endLat ||
      !endLon ||
      !distance
    ) {
      alert("Please complete the route selection");
      return;
    }

    let geometry: Route["geometry"] = {
      type: "LineString" as const,
      coordinates: [
        [parseFloat(startLon), parseFloat(startLat)],
        [parseFloat(endLon), parseFloat(endLat)],
      ],
    };

    // Get OSRM geometry for this route BEFORE creating the route object
    try {
      const routeResult = await getRoute(
        parseFloat(startLon),
        parseFloat(startLat),
        parseFloat(endLon),
        parseFloat(endLat),
      );

      if (routeResult && routeResult.coordinates.length > 1) {
        // Use the actual OSRM route geometry
        geometry.coordinates = routeResult.coordinates as Array<
          [number, number]
        >;
      }
    } catch (error) {
      console.warn("Failed to get OSRM geometry:", error);
      // Keep the fallback geometry (straight line between points)
    }

    const newRoute: Route = {
      name: streetName,
      startLat,
      startLon,
      endLat,
      endLon,
      distance,
      geometry,
    };

    // Check if this route is consecutive to the last route (if there are existing routes)
    if (routes.length > 0) {
      const lastRoute = routes[routes.length - 1];
      if (!areRoutesConsecutive(lastRoute, newRoute)) {
        const proceed = window.confirm(
          `Warning: This street may not be connected to the previous one.\n\n` +
            `Last route ends at: (${parseFloat(lastRoute.endLat).toFixed(4)}, ${parseFloat(lastRoute.endLon).toFixed(4)})\n` +
            `This route starts at: (${parseFloat(newRoute.startLat).toFixed(4)}, ${parseFloat(newRoute.startLon).toFixed(4)})\n\n` +
            `Continue anyway?`,
        );
        if (!proceed) {
          return;
        }
      }
    }

    setRoutes([...routes, newRoute]);
    setRouteStatuses({
      ...routeStatuses,
      [routes.length]: "optimal",
    });

    // Reset form
    setStreetName("");
    setSelectedStreet(null);
    setStartLat("");
    setStartLon("");
    setEndLat("");
    setEndLon("");
    setDistance("");
  };

  const removeRoute = (index: number) => {
    setRoutes(routes.filter((_, i) => i !== index));
    // Rebuild routeStatuses with corrected indices
    const newStatuses: Record<number, "optimal" | "medium" | "sufficient" | "requires_maintenance"> = {};
    let newIdx = 0;
    for (let i = 0; i < routes.length; i++) {
      if (i !== index) {
        newStatuses[newIdx] = routeStatuses[i] || "medium";
        newIdx++;
      }
    }
    setRouteStatuses(newStatuses);
  };

  /**
   * Check if two routes are consecutive (within ~100 meters)
   * This ensures streets are actually connected
   */
  const areRoutesConsecutive = (route1: Route, route2: Route): boolean => {
    const lat1 = parseFloat(route1.endLat);
    const lon1 = parseFloat(route1.endLon);
    const lat2 = parseFloat(route2.startLat);
    const lon2 = parseFloat(route2.startLon);

    // Simple distance calculation (degrees to approximate meters)
    const latDiff = Math.abs(lat1 - lat2);
    const lonDiff = Math.abs(lon1 - lon2);

    // ~1 degree = ~111 km, so 0.001 degree ≈ 111 meters
    // Allow up to 0.003 degrees (≈333 meters) tolerance for street endpoints
    const maxDistance = 0.003;

    return latDiff <= maxDistance && lonDiff <= maxDistance;
  };

  const handleObstacleMarked = (lat: number, lon: number) => {
    setPendingObstacleCoords({ lat, lon });
    setObstacleDialogOpen(true);
  };

  const handleObstacleSave = async (data: {
    type: string;
    description: string;
    lat: number;
    lon: number;
  }) => {
    setIsSavingObstacle(true);
    try {
      // Find which route this obstacle is closest to
      let closestRouteIndex = 0;
      let minDistance = Number.POSITIVE_INFINITY;

      routes.forEach((route, idx) => {
        // Calculate distance to start and end of route
        const startDist = Math.sqrt(
          Math.pow(parseFloat(route.startLat) - data.lat, 2) +
            Math.pow(parseFloat(route.startLon) - data.lon, 2),
        );
        const endDist = Math.sqrt(
          Math.pow(parseFloat(route.endLat) - data.lat, 2) +
            Math.pow(parseFloat(route.endLon) - data.lon, 2),
        );

        const routeDist = Math.min(startDist, endDist);
        if (routeDist < minDistance) {
          minDistance = routeDist;
          closestRouteIndex = idx;
        }
      });

      // Add obstacle to local state with route index
      const newObstacle = {
        id: `obstacle-${Date.now()}`,
        lat: data.lat,
        lon: data.lon,
        type: data.type,
        description: data.description,
        routeIndex: closestRouteIndex,
      };
      setObstacles([...obstacles, newObstacle]);
      setObstacleDialogOpen(false);
      setPendingObstacleCoords(null);
      console.log(
        "Obstacle added locally:",
        newObstacle,
        "closest to route",
        closestRouteIndex,
      );
    } catch (error) {
      console.error("Failed to save obstacle:", error);
      alert("Failed to save obstacle. Please try again.");
    } finally {
      setIsSavingObstacle(false);
    }
  };

  const buildTripData = (): TripData => {
    const totalDistance = routes.reduce(
      (sum, r) => sum + parseFloat(r.distance || "0"),
      0,
    );

    // Determine duration based on mode
    let durationMinutes: number;
    let avgSpeed: number;

    if (usedAutomaticMode) {
      // For automatic mode, use typical 15 km/h speed
      avgSpeed = 15; // km/h
      durationMinutes = Math.round((totalDistance / avgSpeed) * 60);
    } else {
      // For manual mode, user must provide duration
      if (tripDurationMinutes === "") {
        durationMinutes = Math.round((totalDistance / 15) * 60); // fallback
        avgSpeed = 15;
      } else {
        durationMinutes = Number(tripDurationMinutes);
        avgSpeed =
          totalDistance > 0 ? (totalDistance / durationMinutes) * 60 : 15;
      }
    }

    const now = new Date();
    const startTime = new Date(now.getTime() - durationMinutes * 60 * 1000);

    return {
      pathName: tripName || "Unnamed Trip",
      distance: totalDistance,
      duration: durationMinutes,
      avgSpeed: Math.round(avgSpeed * 100) / 100,
      startTime,
      endTime: now,
      pathStatus: (() => {
        const statusValues: Record<string, number> = {
          optimal: 4,
          medium: 3,
          sufficient: 2,
          requires_maintenance: 1,
        };
        const reverseMapping: Record<number, string> = {
          4: "optimal",
          3: "medium",
          2: "sufficient",
          1: "requires_maintenance",
        };
        const statuses = routes.map((_, idx) => routeStatuses[idx] || "medium");
        if (statuses.length === 0) return "medium";
        const avg =
          statuses.reduce((sum, s) => sum + (statusValues[s] || 3), 0) /
          statuses.length;
        return (reverseMapping[Math.round(avg)] || "medium") as "optimal" | "medium" | "sufficient" | "requires_maintenance";
      })(),
      weather: {
        condition: weatherCondition,
        temperature: temperature !== "" ? Number(temperature) : undefined,
        windSpeed: windSpeed !== "" ? Number(windSpeed) : undefined,
        humidity: humidity !== "" ? Number(humidity) : undefined,
      },
      obstacles: obstacles.map((o) => ({
        id: o.id,
        location: `(${o.lat.toFixed(4)}, ${o.lon.toFixed(4)})`,
        type: o.type,
        confirmed: false, // Manual obstacles start as unconfirmed
      })),
      rating: rating || undefined,
      collectionMode: usedAutomaticMode ? "simulated" : "manual",
    };
  };

  const simulateRoutes = async () => {
    // Generate routes using ACTUAL street geometry from Overpass API
    // Routes are chained sequentially: each route starts where the previous one ended
    setIsSimulating(true);
    setUsedAutomaticMode(true);
    const demoRoutes: Route[] = [];

    try {
      // Predefined realistic paths in Milan (connected streets)
      const realisticPaths = [
        // Path 1: Central Axis (South-West to North-East)
        [
          "Via Torino",
          "Piazza del Duomo",
          "Corso Vittorio Emanuele II",
          "Corso Venezia"
        ],
        // Path 2: Brera District (South to North)
        [
          "Via Dante",
          "Via Pontaccio",
          "Via Solferino",
          "Via della Moscova"
        ],
        // Path 3: Fashion District
        [
          "Via Manzoni",
          "Via della Spiga",
          "Via Montenapoleone",
          "Corso Venezia"
        ]
      ];

      // Select a random realistic path
      const selectedPathIndex = Math.floor(Math.random() * realisticPaths.length);
      const milanStreets = realisticPaths[selectedPathIndex];
      console.log(`[AutoMode] Selected path ${selectedPathIndex + 1}:`, milanStreets);
      console.log(`[AutoMode] Selected ${milanStreets.length} streets:`, milanStreets);

      // Milan bounds for Overpass queries
      const milanBounds = { minLat: 45.44, minLon: 9.15, maxLat: 45.49, maxLon: 9.22 };

      // Helper for Haversine distance
      const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      };

      // Calculate geometry distance in km
      const calculateGeometryDistance = (coords: Array<[number, number]>): number => {
        let total = 0;
        for (let i = 1; i < coords.length; i++) {
          total += haversineDistance(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0]);
        }
        return total / 1000;
      };

      let currentLat = 0, currentLon = 0;

      for (let streetIdx = 0; streetIdx < milanStreets.length; streetIdx++) {
        const street = milanStreets[streetIdx];
        try {
          console.log(`[AutoMode] Fetching geometry for: ${street}`);
          const streetGeo = await getStreetGeometry(street, milanBounds);

          if (!streetGeo || streetGeo.coordinates.length < 2) {
            console.warn(`[AutoMode] Skipping ${street}: no geometry found`);
            continue;
          }

          let useCoords = streetGeo.coordinates;
          let startLat: number, startLon: number, endLat: number, endLon: number;

          if (streetIdx === 0) {
            startLon = useCoords[0][0];
            startLat = useCoords[0][1];
            endLon = useCoords[useCoords.length - 1][0];
            endLat = useCoords[useCoords.length - 1][1];
          } else {
            // Connect to previous street using OSRM if there's a gap
            const distToStart = haversineDistance(currentLat, currentLon, useCoords[0][1], useCoords[0][0]);
            const distToEnd = haversineDistance(currentLat, currentLon, useCoords[useCoords.length - 1][1], useCoords[useCoords.length - 1][0]);

            // Orient the street geometry to continue from the current point
            if (distToStart > distToEnd) {
              useCoords = [...useCoords].reverse();
            }

            startLon = useCoords[0][0];
            startLat = useCoords[0][1];
            endLon = useCoords[useCoords.length - 1][0];
            endLat = useCoords[useCoords.length - 1][1];

            // If gap is more than 50 meters, add a connector route using OSRM
            const gapDist = haversineDistance(currentLat, currentLon, startLat, startLon);
            if (gapDist > 50) {
              console.log(`[AutoMode] Gap of ${gapDist.toFixed(0)}m found, adding OSRM connector`);
              const connectorRes = await getRoute(currentLon, currentLat, startLon, startLat);
              if (connectorRes && connectorRes.coordinates.length > 1) {
                demoRoutes.push({
                  name: "Connecting path",
                  startLat: currentLat.toFixed(4),
                  startLon: currentLon.toFixed(4),
                  endLat: startLat.toFixed(4),
                  endLon: startLon.toFixed(4),
                  distance: (connectorRes.distance / 1000).toFixed(2),
                  geometry: { type: "LineString" as const, coordinates: connectorRes.coordinates },
                  duration: connectorRes.duration,
                });
              }
            }
          }

          const distance = calculateGeometryDistance(useCoords);
          const durationSeconds = (distance / 15) * 3600;

          demoRoutes.push({
            name: street,
            startLat: startLat.toFixed(4),
            startLon: startLon.toFixed(4),
            endLat: endLat.toFixed(4),
            endLon: endLon.toFixed(4),
            distance: distance.toFixed(2),
            geometry: { type: "LineString" as const, coordinates: useCoords },
            duration: durationSeconds,
          });

          currentLat = endLat;
          currentLon = endLon;
          console.log(`[AutoMode] Added ${street}: ${distance.toFixed(2)}km`);
        } catch (error) {
          console.warn(`[AutoMode] Failed to get geometry for ${street}:`, error);
        }
      }

      // Fallback if no streets loaded
      if (demoRoutes.length === 0) {
        const fallback = generateRandomCoordinates();
        demoRoutes.push({
          name: "Via Demo",
          startLat: fallback.startLat.toFixed(4),
          startLon: fallback.startLon.toFixed(4),
          endLat: fallback.endLat.toFixed(4),
          endLon: fallback.endLon.toFixed(4),
          distance: "0.50",
          geometry: { type: "LineString", coordinates: [[fallback.startLon, fallback.startLat], [fallback.endLon, fallback.endLat]] },
          duration: 120,
        });
      }

      setRoutes(demoRoutes);

      // Initialize routeStatuses for all generated routes
      const initialStatuses: Record<number, "optimal" | "medium" | "sufficient" | "requires_maintenance"> = {};
      demoRoutes.forEach((_, idx) => {
        initialStatuses[idx] = "optimal";
      });
      setRouteStatuses(initialStatuses);

      // Simulate weather
      const weatherConditions = ["clear", "cloudy", "rainy", "windy", "foggy"];
      setWeatherCondition(weatherConditions[Math.floor(Math.random() * weatherConditions.length)]);
      setTemperature(Math.floor(Math.random() * 20) + 10);
      setHumidity(Math.floor(Math.random() * 40) + 50);
      setWindSpeed(Math.floor(Math.random() * 15) + 5);

      console.log("Automatic mode created routes:", demoRoutes.map((r) => r.name).join(", "));

      // Random Obstacles Generation (1 to N)
      const obstacleTypes = ["pothole", "debris", "water", "gravel", "broken_surface"];
      const numObstacles = Math.floor(Math.random() * 3) + 1; // 1 to 3 obstacles
      const simulatedObstacles = [];

      for (let i = 0; i < numObstacles; i++) {
        // Pick a random route
        const randomRouteIdx = Math.floor(Math.random() * demoRoutes.length);
        const route = demoRoutes[randomRouteIdx];

        // Pick a random coordinate from the route's geometry
        const coords = route.geometry.coordinates;
        if (coords.length > 2) {
          const coordIdx = Math.floor(Math.random() * (coords.length - 2)) + 1;
          const [lon, lat] = coords[coordIdx];

          simulatedObstacles.push({
            id: `auto-obstacle-${Date.now()}-${i}`,
            lat,
            lon,
            type: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)],
            description: "Detected during automatic tracking",
            routeIndex: randomRouteIdx,
          });
        }
      }
      setObstacles(simulatedObstacles);
      setConfirmedObstacleIds(new Set(simulatedObstacles.map((o) => o.id)));
    } catch (error) {
      console.error("[AutoMode] Unexpected error in simulateRoutes:", error);
      // Ensure we have at least a fallback route even if everything fails
      if (demoRoutes.length === 0) {
        const fallback = generateRandomCoordinates();
        demoRoutes.push({
          name: "Via Demo",
          startLat: fallback.startLat.toFixed(4),
          startLon: fallback.startLon.toFixed(4),
          endLat: fallback.endLat.toFixed(4),
          endLon: fallback.endLon.toFixed(4),
          distance: "0.50",
          geometry: { type: "LineString", coordinates: [[fallback.startLon, fallback.startLat], [fallback.endLon, fallback.endLat]] },
          duration: 120,
        });
        setRoutes(demoRoutes);
      }
    } finally {
      // Always show the modal and stop the loading state, even if there were errors
      setIsSimulating(false);
      setShowAutomaticModeModal(true);
    }
  };

  const handleSaveTrip = async () => {
    if (!tripName) {
      alert("Please enter a trip name");
      return;
    }

    if (routes.length === 0) {
      alert("Please add at least one route");
      return;
    }

    const now = new Date();
    const startTime = new Date(now.getTime() - routes.length * 15 * 60 * 1000);

    const collectionMode = usedAutomaticMode ? "simulated" : "manual";

    try {
      // Calculate trip statistics from routes and duration
      const totalDistance = routes.reduce(
        (sum, r) => sum + parseFloat(r.distance || "0"),
        0,
      );

      // Get duration either from user input (manual) or calculate (automatic)
      let durationMinutes: number;
      let avgSpeed: number;

      if (usedAutomaticMode) {
        // Automatic mode: use cached OSRM data from simulateRoutes
        // Duration was preloaded when user clicked "Automatic Mode"
        const totalDurationSeconds = routes.reduce(
          (sum, route) => sum + (route.duration ?? 0),
          0,
        );

        if (totalDurationSeconds > 0) {
          durationMinutes = Math.round(totalDurationSeconds / 60);
          avgSpeed =
            totalDistance > 0
              ? totalDistance / (totalDurationSeconds / 3600)
              : 15;
        } else {
          avgSpeed = 15;
          durationMinutes = Math.round((totalDistance / avgSpeed) * 60);
        }
      } else {
        // Manual mode: use user-provided duration
        if (tripDurationMinutes === "") {
          durationMinutes = Math.round((totalDistance / 15) * 60);
          avgSpeed = 15;
        } else {
          durationMinutes = Number(tripDurationMinutes);
          avgSpeed =
            totalDistance > 0 ? (totalDistance / durationMinutes) * 60 : 15;
        }
      }

      const durationSeconds = durationMinutes * 60;

      // Create the trip with calculated statistics
      // Note: totalDistance is already in km (from route.distance which is set as km)
      // Database expects meters, so multiply by 1000
      const tripDistanceMeters = totalDistance > 0 ? totalDistance * 1000 : 0;

      const tripResponse = await createTrip.mutateAsync({
        name: tripName,
        description: tripDescription || undefined,
        startTime,
        endTime: now,
        collectionMode,
        distance: tripDistanceMeters, // Convert km to meters for database
        avgSpeed: Math.round(avgSpeed * 100) / 100,
        duration: durationSeconds,
        weatherData: {
          condition: weatherCondition,
          temperature: temperature !== "" ? Number(temperature) : undefined,
          windSpeed: windSpeed !== "" ? Number(windSpeed) : undefined,
          humidity: humidity !== "" ? Number(humidity) : undefined,
        },
      } as any);

      console.log("Trip created:", tripResponse.id);
      console.log(
        "Trip data sent - distance:",
        tripDistanceMeters,
        "avgSpeed:",
        Math.round(avgSpeed * 100) / 100,
        "duration:",
        durationSeconds,
      );
      console.log(
        "Trip response distance from API:",
        tripResponse.distance,
        "avgSpeed:",
        tripResponse.avgSpeed,
      );

      // Then add each route and collect their IDs
      const routeIds: string[] = [];
      for (const route of routes) {
        const routeResponse = await addRouteMutation.mutateAsync({
          tripId: tripResponse.id,
          name: route.name,
          geometry: route.geometry,
          distance: parseFloat(route.distance) * 1000, // Convert to meters
          startLat: parseFloat(route.startLat),
          startLon: parseFloat(route.startLon),
          endLat: parseFloat(route.endLat),
          endLon: parseFloat(route.endLon),
        });
        routeIds.push(routeResponse.id);
      }

      // Add obstacles to their respective routes
      if (obstacles.length > 0) {
        for (const obstacle of obstacles) {
          const routeIndex = obstacle.routeIndex ?? 0;
          const tripRouteId = routeIds[routeIndex];

          if (tripRouteId) {
            try {
              await addObstacleMutation.mutateAsync({
                tripRouteId,
                type: obstacle.type,
                description: obstacle.description,
                lat: obstacle.lat,
                lon: obstacle.lon,
                detectionMode: "manual",
                status: "PENDING",
              });
              console.log(`Obstacle saved for route ${routeIndex}`);
            } catch (error) {
              console.error(
                `Failed to save obstacle for route ${routeIndex}:`,
                error,
              );
            }
          }
        }
      }

      // Create path reports for routes with selected status conditions
      for (let i = 0; i < routeIds.length; i++) {
        const status = routeStatuses[i];
        if (status) {
          const tripRouteId = routeIds[i];
          try {
            await createPathReportMutation.mutateAsync({
              tripRouteId,
              status,
              isPublishable: true,
              collectionMode: "manual",
              streetName: routes[i].name,
            });
            console.log(
              `Path report created for route ${i} with status: ${status}`,
            );
          } catch (error) {
            console.error(
              `Failed to create path report for route ${i}:`,
              error,
            );
          }
        }
      }

      // Invalidate queries and navigate
      await queryClient.invalidateQueries({
        queryKey: api.trips.list.queryKey(),
      });

      const obstacleMsg =
        obstacles.length > 0 ? ` and ${obstacles.length} obstacle(s)` : "";
      alert(
        `Trip "${tripName}" saved with ${routes.length} routes${obstacleMsg}!`,
      );
      navigate({ to: "/trips" });

      return tripResponse.id;
    } catch (error) {
      console.error("Failed to save trip:", error);
      alert("Failed to save trip. Please try again.");
      return null;
    }
  };

  const totalDistance = routes
    .reduce((sum, r) => sum + (parseFloat(r.distance) || 0), 0)
    .toFixed(2);

  // Memoize paths to prevent map re-renders when unrelated state changes
  const memoizedPaths = useMemo(
    () => [
      {
        id: "draft",
        name: tripName || undefined,
        routes: routes
          .filter(
            (route) =>
              route.startLat && route.startLon && route.endLat && route.endLon,
          )
          .map((route, idx) => ({
            id: `route-${idx}`,
            name: route.name,
            description: `${(parseFloat(route.distance) || 0).toFixed(2)} km`,
            currentStatus: routeStatuses[idx] || "medium",
            geometry: route.geometry || {
              type: "LineString" as const,
              coordinates: [
                [parseFloat(route.startLon), parseFloat(route.startLat)],
                [parseFloat(route.endLon), parseFloat(route.endLat)],
              ],
            },
            startLat: route.startLat,
            startLon: route.startLon,
            endLat: route.endLat,
            endLon: route.endLon,
          })),
      },
    ],
    [routes, tripName, usedAutomaticMode, routeStatuses], // Re-create when routes or tripName changes
  );

  // Calculate start and end coordinates for map markers
  const mapMarkers = useMemo(() => {
    if (routes.length === 0) return { start: null, end: null };

    const firstRoute = routes[0];
    const lastRoute = routes[routes.length - 1];

    let start: [number, number] | null = null;
    let end: [number, number] | null = null;

    if (firstRoute.startLat && firstRoute.startLon) {
      start = [parseFloat(firstRoute.startLat), parseFloat(firstRoute.startLon)];
    }

    if (lastRoute.endLat && lastRoute.endLon) {
      end = [parseFloat(lastRoute.endLat), parseFloat(lastRoute.endLon)];
    }

    return { start, end };
  }, [routes]);

  // Memoize existing routes for StreetMapPicker to prevent infinite re-renders
  const memoizedExistingRoutes = useMemo(
    () => routes.map((r) => ({
      name: r.name,
      geometry: r.geometry,
    })),
    [routes]
  );

  if (step === "review") {
    const tripData = buildTripData();
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 p-6 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("builder")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Review Your Trip</h1>
              <p className="text-gray-600">Check your details before saving</p>
            </div>
          </div>
        </div>

        {/* Review Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Trip Route Map Visualization */}
            {routes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Trip Route Map</CardTitle>
                  <CardDescription>
                    Visual preview of all your routes
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-96 p-0">
                  <div className="w-full h-full">
                    <SequenceMap
                      paths={memoizedPaths}
                      obstacles={obstacles}
                      startCoords={mapMarkers.start}
                      endCoords={mapMarkers.end}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Optimal Route Sequence Card - Added for both modes */}
            {routes.length > 0 && (
              <Card className="overflow-hidden border-blue-100 shadow-sm">
                <CardHeader className="bg-blue-50/50 border-b border-blue-100">
                  <div className="flex items-center gap-2">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Zap className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Optimal Path Sequence</CardTitle>
                      <CardDescription>
                        Sequential breakdown from {routes[0].name} to {routes[routes.length-1].name}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="relative pl-6 space-y-6 before:absolute before:inset-y-0 before:left-[15px] before:w-0.5 before:bg-blue-100/50">
                    {routes.map((route, idx) => (
                      <div key={idx} className="relative">
                        {/* Timeline Connector Dot */}
                        <div className={`absolute top-2 -left-[23px] w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 
                          ${idx === 0 ? 'bg-green-500 ring-4 ring-green-100' : idx === routes.length - 1 ? 'bg-red-500 ring-4 ring-red-100' : 'bg-blue-500'}`} 
                        />
                        
                        <div className="flex items-start justify-between gap-4 group">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full
                                ${idx === 0 ? 'bg-green-100 text-green-700' : idx === routes.length - 1 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {idx === 0 ? 'Start' : idx === routes.length - 1 ? 'End' : `Step ${idx + 1}`}
                              </span>
                              <span className="text-xs text-gray-400 font-medium">
                                {parseFloat(route.distance || "0").toFixed(2)} km
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {route.name}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {route.startLat}, {route.startLon} → {route.endLat}, {route.endLon}
                            </p>
                          </div>
                          
                          {(() => {
                            const status = routeStatuses[idx] || "medium";
                            const statusConfig = {
                              optimal: { bg: "bg-green-50", border: "border-green-100", labelColor: "text-green-600", valueColor: "text-green-700", label: "Optimal" },
                              medium: { bg: "bg-yellow-50", border: "border-yellow-100", labelColor: "text-yellow-600", valueColor: "text-yellow-700", label: "Medium" },
                              sufficient: { bg: "bg-orange-50", border: "border-orange-100", labelColor: "text-orange-600", valueColor: "text-orange-700", label: "Sufficient" },
                              requires_maintenance: { bg: "bg-red-50", border: "border-red-100", labelColor: "text-red-600", valueColor: "text-red-700", label: "Maintenance" },
                            }[status];
                            return (
                              <div className={`${statusConfig.bg} px-3 py-1.5 rounded-lg border ${statusConfig.border} flex flex-col items-center`}>
                                <span className={`text-[10px] font-bold ${statusConfig.labelColor} uppercase`}>Status</span>
                                <span className={`text-xs font-bold ${statusConfig.valueColor}`}>{statusConfig.label}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <TripReviewScreen
              trip={tripData}
              onRatingChange={setRating}
              onPublish={async (data) => {
                const tripId = await handleSaveTrip();
                if (tripId) {
                  // Publish trip to community as a path
                  try {
                    await publishTripMutation.mutateAsync({
                      tripId,
                      pathName: tripName || "Published Trip",
                    });
                    const streetList = routes.map((r) => r.name).join(", ");
                    alert(
                      `Trip published to community! It's now visible on the map.\n\nTo find it in /Routes, search for any two of these streets:\n${streetList}`,
                    );
                  } catch (error) {
                    console.error("Failed to publish to community:", error);
                    alert(
                      "Published to your trips, but failed to make it public on the map.",
                    );
                  }
                }
              }}
              onSave={async (data) => {
                await handleSaveTrip();
              }}
              onDelete={() => {
                setStep("builder");
                setRoutes([]);
              }}
              isSubmitting={createTrip.isPending}
            />
          </div>
        </div>
      </div>
    );
  }

  // Builder View
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-6 border-b">
        <div>
          <h1 className="text-3xl font-bold">Record a Trip</h1>
          <p className="text-gray-600">
            Add routes, set weather info, then review before saving
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Trip Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Trip Information</CardTitle>
              <CardDescription>Enter basic trip details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="trip-name">Trip Name *</Label>
                <Input
                  id="trip-name"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="e.g., Morning Commute"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="trip-description">Description (Optional)</Label>
                <Textarea
                  id="trip-description"
                  value={tripDescription}
                  onChange={(e) => setTripDescription(e.target.value)}
                  placeholder="Notes about your trip"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Weather Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Weather Conditions</CardTitle>
              <CardDescription>
                Optional - helps track riding conditions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Weather Condition</Label>
                  <Select
                    value={weatherCondition}
                    onValueChange={setWeatherCondition}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clear">Clear</SelectItem>
                      <SelectItem value="cloudy">Cloudy</SelectItem>
                      <SelectItem value="rainy">Rainy</SelectItem>
                      <SelectItem value="windy">Windy</SelectItem>
                      <SelectItem value="snowy">Snowy</SelectItem>
                      <SelectItem value="foggy">Foggy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="temperature">Temperature (°C)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) =>
                      setTemperature(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                    placeholder="e.g., 22"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="wind-speed">Wind Speed (km/h)</Label>
                  <Input
                    id="wind-speed"
                    type="number"
                    step="0.1"
                    value={windSpeed}
                    onChange={(e) =>
                      setWindSpeed(e.target.value ? Number(e.target.value) : "")
                    }
                    placeholder="e.g., 10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="humidity">Humidity (%)</Label>
                  <Input
                    id="humidity"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={humidity}
                    onChange={(e) =>
                      setHumidity(e.target.value ? Number(e.target.value) : "")
                    }
                    placeholder="e.g., 65"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trip Duration Card - Only for Manual Mode */}
          {!usedAutomaticMode && (
            <Card>
              <CardHeader>
                <CardTitle>Trip Duration</CardTitle>
                <CardDescription>
                  How long did your trip take? (Minutes)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    step="1"
                    value={tripDurationMinutes}
                    onChange={(e) =>
                      setTripDurationMinutes(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                    placeholder="e.g., 45"
                  />
                  {tripDurationMinutes !== "" && routes.length > 0 && (
                    <p className="text-xs text-gray-600 mt-2">
                      Estimated average speed:{" "}
                      <span className="font-semibold">
                        {(
                          (routes.reduce(
                            (sum, r) => sum + parseFloat(r.distance || "0"),
                            0,
                          ) /
                            Number(tripDurationMinutes)) *
                          60
                        ).toFixed(1)}{" "}
                        km/h
                      </span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Automatic Mode or Manual Routes */}
          {!usedAutomaticMode ? (
            // Manual mode - show routes form
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Add Routes to Your Trip</CardTitle>
                  <CardDescription>
                    {routes.length} routes • {totalDistance} km total
                  </CardDescription>
                </div>
                {routes.length === 0 && (
                  <Button
                    onClick={() => simulateRoutes()}
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={isSimulating}
                  >
                    {isSimulating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        GPS...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Automatic Mode
                      </>
                    )}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mode Toggle - Show only after first route is added */}
                {routes.length > 0 && (
                  <div className="flex gap-2 p-2 bg-gray-100 rounded-lg">
                    <Button
                      onClick={() => setSelectionMode("search")}
                      variant={selectionMode === "search" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Search Street
                    </Button>
                    <Button
                      onClick={() => setSelectionMode("map")}
                      variant={selectionMode === "map" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                    >
                      <Map className="h-4 w-4 mr-2" />
                      Pick from Map
                    </Button>
                  </div>
                )}

                {selectionMode === "search" ? (
                  <>
                    <p className="text-sm text-gray-600">
                      Search for a street by name - distance is calculated
                      automatically
                    </p>

                    <div className="border p-4 rounded-lg space-y-4 bg-gray-50">
                      <div className="grid gap-2">
                        <Label>Street Name *</Label>
                        <StreetAutocomplete
                          value={streetName}
                          onChange={setStreetName}
                          onSelect={handleStreetSelect}
                          placeholder="Search for a street in Milan..."
                          disabled={isCalculatingDistance}
                        />
                        {selectedStreet && (
                          <p className="text-xs text-gray-500 mt-1">
                            Selected: {selectedStreet.displayName}
                          </p>
                        )}
                      </div>

                      {isFetchingStreetGeometry && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                          <p className="text-gray-600">
                            Loading street geometry...
                          </p>
                        </div>
                      )}

                      {streetGeometry && !startLat && (
                        <StreetPicker
                          streetGeometry={streetGeometry}
                          initialStartPoint={
                            routes.length > 0
                              ? [
                                  parseFloat(routes[routes.length - 1].endLat),
                                  parseFloat(routes[routes.length - 1].endLon),
                                ]
                              : null
                          }
                          onStartSelected={(lat, lon) => {
                            // Store temporarily - just for feedback
                          }}
                          onEndSelected={(lat, lon) => {
                            // Store temporarily - just for feedback
                          }}
                          onComplete={handleStreetPickerComplete}
                        />
                      )}

                      {startLat && (
                        <>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm text-green-900 font-semibold mb-3">
                              ✅ Route Configured
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Start</p>
                                <p className="font-mono">
                                  ({parseFloat(startLat).toFixed(4)},{" "}
                                  {parseFloat(startLon).toFixed(4)})
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">End</p>
                                <p className="font-mono">
                                  ({parseFloat(endLat).toFixed(4)},{" "}
                                  {parseFloat(endLon).toFixed(4)})
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Distance</p>
                                <p className="font-mono">{distance} km</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Street</p>
                                <p className="font-mono">{streetName}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor="distance-edit">
                              Edit Distance (km) *
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="distance-edit"
                                type="number"
                                step="0.1"
                                value={distance}
                                onChange={(e) => setDistance(e.target.value)}
                                placeholder="2.5"
                                disabled={isCalculatingDistance}
                              />
                              {isCalculatingDistance && (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {startLat && (
                        <Button
                          onClick={addRoute}
                          className="w-full"
                          disabled={!distance || isCalculatingDistance}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Route
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <StreetMapPicker
                    centerLat={
                      routes.length > 0
                        ? parseFloat(routes[routes.length - 1].endLat)
                        : 45.4642
                    }
                    centerLon={
                      routes.length > 0
                        ? parseFloat(routes[routes.length - 1].endLon)
                        : 9.19
                    }
                    existingRoutes={memoizedExistingRoutes}
                    onStreetSelected={async (streetName: string) => {
                      // Switch back to search mode to show the StreetPicker
                      setSelectionMode("search");

                      // Simulate street selection from map by calling handleStreetSelect
                      // with a minimal StreetSuggestion object
                      await handleStreetSelect({
                        name: streetName,
                        displayName: streetName,
                        lat: routes.length > 0 ? parseFloat(routes[routes.length - 1].endLat) : 45.4642,
                        lon: routes.length > 0 ? parseFloat(routes[routes.length - 1].endLon) : 9.19,
                      });
                    }}
                    onCancel={() => setSelectionMode("search")}
                  />
                )}

                {/* Routes List */}
                {routes.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h3 className="font-semibold">Added Routes:</h3>
                    <div className="space-y-2">
                      {routes.map((route, idx) => (
                        <div
                          key={idx}
                          className="p-3 border rounded-lg bg-white hover:bg-gray-50 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">
                                {idx + 1}. {route.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                {route.distance} km • ({route.startLat},{" "}
                                {route.startLon}) → ({route.endLat},{" "}
                                {route.endLon})
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeRoute(idx)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Select
                            value={routeStatuses[idx] || "medium"}
                            onValueChange={(value) =>
                              setRouteStatuses({
                                ...routeStatuses,
                                [idx]: value as any,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="optimal">Optimal</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="sufficient">
                                Sufficient
                              </SelectItem>
                              <SelectItem value="requires_maintenance">
                                Requires Maintenance
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            // Automatic mode - show fancy animated card with auto-filled data
            <Card className="border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-400 rounded-full animate-pulse" />
                        <div className="relative bg-blue-600 rounded-full p-2">
                          <Zap className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <CardTitle className="text-xl">
                        Automatic Mode Active
                      </CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      GPS tracking active • Routes auto-generated
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUsedAutomaticMode(false);
                      setRoutes([]);
                    }}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Switch to Manual
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Routes Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <h3 className="font-semibold text-sm">Generated Routes</h3>
                  </div>
                  {routes.length > 0 ? (
                    <div className="grid gap-2 max-h-48 overflow-y-auto">
                      {routes.map((route, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-blue-200 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{route.name}</p>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {route.distance} km
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {parseFloat(route.startLat).toFixed(4)},{" "}
                            {parseFloat(route.startLon).toFixed(4)} →{" "}
                            {parseFloat(route.endLat).toFixed(4)},{" "}
                            {parseFloat(route.endLon).toFixed(4)}
                          </p>
                          <Select
                            value={routeStatuses[idx] || "medium"}
                            onValueChange={(value) =>
                              setRouteStatuses({
                                ...routeStatuses,
                                [idx]: value as any,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="optimal">Optimal</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="sufficient">
                                Sufficient
                              </SelectItem>
                              <SelectItem value="requires_maintenance">
                                Requires Maintenance
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                      <p className="text-sm text-gray-600">
                        Generating routes...
                      </p>
                    </div>
                  )}
                </div>

                {/* Auto-filled Summary Section */}
                {routes.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-blue-200">
                    <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                      <p className="text-xs text-gray-600 mb-1">
                        Total Distance
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        {totalDistance} km
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                      <p className="text-xs text-gray-600 mb-1">Avg Speed</p>
                      <p className="text-lg font-bold text-blue-600">
                        {(
                          (routes.reduce(
                            (sum, r) => sum + parseFloat(r.distance || "0"),
                            0,
                          ) /
                            15) *
                          15
                        ).toFixed(1)}{" "}
                        km/h
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                      <p className="text-xs text-gray-600 mb-1">
                        Est. Duration
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        {Math.round(
                          (routes.reduce(
                            (sum, r) => sum + parseFloat(r.distance || "0"),
                            0,
                          ) /
                            15) *
                            60,
                        )}{" "}
                        min
                      </p>
                    </div>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>✓ Automatic mode selected:</strong> Routes and
                    duration have been auto-filled based on GPS tracking. You
                    can still add weather info below.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Route Visualization Map with Obstacle Marking */}
          {routes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Trip Route Map</CardTitle>
                    <CardDescription>
                      Visual preview of all your routes with connections
                    </CardDescription>
                  </div>
                  <Button
                    variant={enableObstacles ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEnableObstacles(!enableObstacles)}
                  >
                    {enableObstacles ? "✓ Obstacle Mode ON" : "Mark Obstacles"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="h-96 p-0">
                <div className="w-full h-full">
                  <SequenceMap
                    paths={memoizedPaths}
                    enableObstacleMarking={enableObstacles}
                    obstacles={obstacles}
                    onObstacleMarked={handleObstacleMarked}
                    onObstacleRemoved={(id) => {
                      setObstacles(obstacles.filter((o) => o.id !== id));
                    }}
                    startCoords={mapMarkers.start}
                    endCoords={mapMarkers.end}
                  />
                </div>
              </CardContent>
              {enableObstacles && (
                <CardContent className="pt-0">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      <strong>Obstacle Mode Active:</strong> Click directly on
                      the path to mark obstacles.
                      {obstacles.length > 0 &&
                        ` ${obstacles.length} obstacle(s) marked.`}
                    </p>
                  </div>
                </CardContent>
              )}
              {obstacles.length > 0 && (
                <CardContent className={`pt-2 border-t border-gray-100 ${enableObstacles ? 'mt-2' : ''}`}>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Marked Obstacles</h4>
                  <div className="flex flex-wrap gap-2">
                    {obstacles.map((obs) => (
                      <div key={obs.id} className="bg-orange-50 border border-orange-100 rounded-full px-3 py-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-orange-700 capitalize">{obs.type.replace('_', ' ')}</span>
                        <button 
                          onClick={() => setObstacles(obstacles.filter(o => o.id !== obs.id))}
                          className="text-orange-300 hover:text-orange-600 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Path Rating Card - Mandatory for All Modes */}
          {routes.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  Rate Your Path
                  <span className="text-red-500 text-xs font-normal">* Mandatory</span>
                </CardTitle>
                <CardDescription>
                  How would you rate the quality and safety of this path?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className="transition-transform active:scale-95"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            rating && s <= rating
                              ? "text-amber-500 fill-amber-500"
                              : "text-gray-300 hover:text-amber-200"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {rating && (
                    <span className="text-lg font-bold text-amber-700">
                      {rating}/5 Stars
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Obstacle Dialog */}
          {pendingObstacleCoords && (
            <ObstacleDialog
              open={obstacleDialogOpen}
              lat={pendingObstacleCoords.lat}
              lon={pendingObstacleCoords.lon}
              onSave={handleObstacleSave}
              onCancel={() => {
                setObstacleDialogOpen(false);
                setPendingObstacleCoords(null);
              }}
              isLoading={isSavingObstacle}
            />
          )}
        </div>
      </div>

      {/* Action Buttons - Outside scroll area */}
      <div className="shrink-0 p-6 border-t space-y-3">
        {createTrip.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              Error saving trip. Please try again.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => setStep("review")}
            disabled={
              routes.length === 0 || 
              !tripName || 
              (!usedAutomaticMode && !rating)
            }
            className="flex-1"
          >
            Review Trip
          </Button>
          <Button
            onClick={() => navigate({ to: "/trips" } as any)}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Automatic Mode Modal Overlay */}
      {showAutomaticModeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white border-b">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Automatic Mode Complete
                </CardTitle>
                <CardDescription>
                  Detailed route from <span className="font-semibold text-blue-700">{routes[0]?.name}</span> to <span className="font-semibold text-blue-700">{routes[routes.length-1]?.name}</span>
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowAutomaticModeModal(false)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                  <p className="text-xs text-gray-600 mb-2">Total Distance</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {totalDistance} km
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                  <p className="text-xs text-gray-600 mb-2">Avg Speed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {parseFloat(totalDistance) > 0
                      ? (parseFloat(totalDistance) / 15).toFixed(1)
                      : "15.0"}{" "}
                    km/h
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-100">
                  <p className="text-xs text-gray-600 mb-2">Est. Duration</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {Math.round((parseFloat(totalDistance) / 15) * 60)} min
                  </p>
                </div>
              </div>

              {/* Routes List */}
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <div className="bg-green-100 p-1.5 rounded-full">
                    <Zap className="h-4 w-4 text-green-600" />
                  </div>
                  Optimal Path Sequence
                </h3>
                
                <div className="relative pl-4 space-y-4 before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-blue-100">
                  {routes.map((route, idx) => (
                    <div key={idx} className="relative group">
                      {/* Timeline Dot */}
                      <div className={`absolute top-2 -left-[18px] w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-10 
                        ${idx === 0 ? 'bg-green-500 scale-125' : idx === routes.length - 1 ? 'bg-red-500 scale-125' : 'bg-blue-500'}`} 
                      />
                      
                      <div className={`p-4 rounded-xl border transition-all duration-200 
                        ${route.name === "Connecting path" 
                          ? 'bg-gray-50/50 border-dashed border-gray-200 opacity-60' 
                          : 'bg-white border-blue-100 hover:border-blue-300 hover:shadow-md'}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <p className={`font-bold text-sm ${route.name === "Connecting path" ? 'text-gray-400 italic' : 'text-blue-900'}`}>
                              {route.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                                {idx === 0 ? 'START POINT' : idx === routes.length - 1 ? 'DESTINATION' : `STEP ${idx + 1}`}
                              </span>
                              <span className="text-gray-300">•</span>
                              <p className="text-xs text-gray-500 font-medium">
                                {parseFloat(route.distance || "0").toFixed(2)} km
                              </p>
                            </div>
                          </div>
                          
                          {route.name !== "Connecting path" && (() => {
                            const status = routeStatuses[idx] || "optimal";
                            const cfg = {
                              optimal: { bg: "bg-green-50", text: "text-green-600", border: "border-green-100", label: "Optimal" },
                              medium: { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-100", label: "Medium" },
                              sufficient: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100", label: "Sufficient" },
                              requires_maintenance: { bg: "bg-red-50", text: "text-red-600", border: "border-red-100", label: "Maintenance" },
                            }[status];
                            return (
                              <div className={`${cfg.bg} px-2 py-1 rounded text-[10px] font-bold ${cfg.text} border ${cfg.border} uppercase`}>
                                {cfg.label}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Automated Obstacles Detection */}
              {obstacles.length > 0 && (
                <div className="bg-red-50/50 border border-red-100 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-red-100 p-1.5 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    </div>
                    <h3 className="font-bold text-red-900">Issues Detected (GPS)</h3>
                  </div>
                  
                  <div className="space-y-3">
                    {obstacles.map((obstacle, idx) => (
                      <div key={obstacle.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id={`check-${obstacle.id}`}
                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                            checked={confirmedObstacleIds.has(obstacle.id)}
                            onChange={(e) => {
                              const newSet = new Set(confirmedObstacleIds);
                              if (e.target.checked) {
                                newSet.add(obstacle.id);
                              } else {
                                newSet.delete(obstacle.id);
                              }
                              setConfirmedObstacleIds(newSet);
                            }}
                          />
                          <label htmlFor={`check-${obstacle.id}`} className="cursor-pointer">
                            <p className="font-bold text-xs text-red-800 capitalize">{obstacle.type.replace('_', ' ')}</p>
                            <p className="text-[10px] text-gray-500">
                              Detected on {routes.find((_, i) => i === obstacle.routeIndex)?.name || "the path"}
                            </p>
                          </label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                          onClick={() => {
                            const newSet = new Set(confirmedObstacleIds);
                            newSet.delete(obstacle.id);
                            setConfirmedObstacleIds(newSet);
                            setObstacles(obstacles.filter(o => o.id !== obstacle.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-red-600 mt-3 italic">
                    Uncheck or delete any false detections before keeping the routes.
                  </p>
                </div>
              )}

              {/* Path Rating Selection */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-amber-100 p-1.5 rounded-lg">
                    <Star className="h-4 w-4 text-amber-600 fill-amber-600" />
                  </div>
                  <h3 className="font-bold text-amber-900">Your Experience</h3>
                </div>
                <p className="text-xs text-amber-800/70 mb-4">How was the ride quality and safety?</p>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className="transition-transform active:scale-95"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            rating && s <= rating
                              ? "text-amber-500 fill-amber-500"
                              : "text-gray-300 hover:text-amber-200"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Weather Info */}
              {weatherCondition && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-3">
                    Weather Conditions
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600 text-xs">Condition</p>
                      <p className="font-medium capitalize">
                        {weatherCondition}
                      </p>
                    </div>
                    {temperature !== "" && (
                      <div>
                        <p className="text-gray-600 text-xs">Temperature</p>
                        <p className="font-medium">{temperature}°C</p>
                      </div>
                    )}
                    {windSpeed !== "" && (
                      <div>
                        <p className="text-gray-600 text-xs">Wind Speed</p>
                        <p className="font-medium">{windSpeed} km/h</p>
                      </div>
                    )}
                    {humidity !== "" && (
                      <div>
                        <p className="text-gray-600 text-xs">Humidity</p>
                        <p className="font-medium">{humidity}%</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Info message */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900">
                  <strong>✓ Auto-filled:</strong> Routes, weather, and duration
                  have been automatically populated. You can review and edit
                  before saving.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    setObstacles(obstacles.filter(o => confirmedObstacleIds.has(o.id)));
                    setShowAutomaticModeModal(false);
                    setUsedAutomaticMode(true);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Keep These Routes
                </Button>
                <Button
                  onClick={() => {
                    setShowAutomaticModeModal(false);
                    setRoutes([]);
                    setUsedAutomaticMode(false);
                    setWeatherCondition("clear");
                    setTemperature("");
                    setWindSpeed("");
                    setHumidity("");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
