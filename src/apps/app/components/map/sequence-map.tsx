import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

// Fix for default marker icons in Leaflet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][];
}

interface Route {
  id: string;
  name: string;
  description?: string | null;
  geometry: GeoJSONLineString;
  currentStatus?: string | null;
  score?: number | null;
  startLat?: number | string;
  startLon?: number | string;
  endLat?: number | string;
  endLon?: number | string;
}

interface Path {
  id: string;
  name?: string;
  routes: Route[];
}

interface Obstacle {
  id: string;
  lat: number;
  lon: number;
  type: string;
  description?: string;
  status?: string;
}

interface SequenceMapProps {
  paths: Path[];
  startCoords?: [number, number] | null;
  endCoords?: [number, number] | null;
  enableObstacleMarking?: boolean;
  obstacles?: Obstacle[];
  onObstacleMarked?: (lat: number, lon: number) => void;
  onObstacleRemoved?: (id: string) => void;
}

export function SequenceMap({
  paths,
  startCoords,
  endCoords,
  enableObstacleMarking = false,
  obstacles = [],
  onObstacleMarked,
  onObstacleRemoved,
}: SequenceMapProps) {
  console.log("[SequenceMap] COMPONENT MOUNTED/RENDERED with paths:", paths);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routePolylinesRef = useRef<L.Polyline[]>([]);
  const obstacleMarkersRef = useRef<L.Marker[]>([]);
  const [markedObstacles, setMarkedObstacles] = useState<Array<{ lat: number; lon: number }>>(
    [],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map - only once, never reinitialize
    const map = L.map(mapContainerRef.current).setView([45.4642, 9.19], 13);

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Trigger size recalculation after a brief delay to ensure container is sized
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // Empty deps - initialize only once

  // Separate effect for obstacle marking click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!enableObstacleMarking) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      // Check if click is near any route polyline (within tolerance)
      const clickPoint = e.latlng;
      let nearestPoint: L.LatLng | null = null;
      let minDistance = Number.POSITIVE_INFINITY;
      const SNAP_TOLERANCE = 50; // meters

      // Check distance to all route polylines
      for (const polyline of routePolylinesRef.current) {
        const closest = polyline.closestLayerPoint(e.layerPoint);
        const closestLatLng = map.layerPointToLatLng(closest);
        const distance = clickPoint.distanceTo(closestLatLng);

        if (distance < minDistance && distance <= SNAP_TOLERANCE) {
          minDistance = distance;
          nearestPoint = closestLatLng;
        }
      }

      // Only allow obstacle marking if click is near a path
      if (!nearestPoint) {
        // Show a temporary message that obstacles must be on the path
        const tempMarker = L.marker([clickPoint.lat, clickPoint.lng], {
          icon: L.divIcon({
            className: "temp-marker",
            html: '<div style="background: red; color: white; padding: 4px 8px; border-radius: 4px; white-space: nowrap;">❌ Click on path</div>',
            iconSize: [120, 30],
            iconAnchor: [60, 15],
          }),
        }).addTo(map);

        setTimeout(() => {
          map.removeLayer(tempMarker);
        }, 2000);

        console.log(`[SequenceMap] Click ignored - not on path (distance: ${minDistance}m)`);
        return;
      }

      // Snap to nearest point on path
      const { lat, lng } = nearestPoint;
      const obstacleMarker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        }),
      });

      obstacleMarker
        .bindPopup("Obstacle marked - provide details")
        .addTo(map)
        .openPopup();

      // Add to marked obstacles
      const newObstacles = [...markedObstacles, { lat, lon: lng }];
      setMarkedObstacles(newObstacles);

      // Notify parent component
      onObstacleMarked?.(lat, lng);

      console.log(`[SequenceMap] Obstacle marked at (${lat}, ${lng}) - snapped from (${clickPoint.lat}, ${clickPoint.lng})`);
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [enableObstacleMarking, markedObstacles, onObstacleMarked]);

  useEffect(() => {
    if (!mapRef.current || !paths || paths.length === 0) return;

    const map = mapRef.current;

    // Clear existing layers (except base tile layer and obstacle markers)
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) return;
      // Don't remove obstacle markers - they'll be managed separately
      if (obstacleMarkersRef.current.includes(layer as L.Marker)) return;
      map.removeLayer(layer);
    });

    // Clear polyline refs
    routePolylinesRef.current = [];

    // Function to get color based on status
    const getStatusColor = (status: string | null | undefined): string => {
      switch (status) {
        case "optimal":
          return "#22c55e"; // green
        case "medium":
          return "#eab308"; // yellow
        case "sufficient":
          return "#f97316"; // orange
        case "requires_maintenance":
          return "#ef4444"; // red
        default:
          return "#6b7280"; // gray
      }
    };

    const bounds = L.latLngBounds([]);
    let hasValidRoutes = false;

    /**
     * Check if two routes are consecutive (within ~333 meters)
     */
    const areRoutesConsecutive = (route1: Route, route2: Route): boolean => {
      if (
        !route1.endLat ||
        !route1.endLon ||
        !route2.startLat ||
        !route2.startLon
      ) {
        return false;
      }

      const lat1 = typeof route1.endLat === "string" ? parseFloat(route1.endLat) : route1.endLat;
      const lon1 = typeof route1.endLon === "string" ? parseFloat(route1.endLon) : route1.endLon;
      const lat2 = typeof route2.startLat === "string" ? parseFloat(route2.startLat) : route2.startLat;
      const lon2 = typeof route2.startLon === "string" ? parseFloat(route2.startLon) : route2.startLon;

      const latDiff = Math.abs(lat1 - lat2);
      const lonDiff = Math.abs(lon1 - lon2);
      const maxDistance = 0.003; // ~333 meters

      return latDiff <= maxDistance && lonDiff <= maxDistance;
    };

    // Process each path
    for (const path of paths) {
      const routes = path.routes;

      // Draw all routes in this path
      for (const route of routes) {
        // Skip routes with no geometry
        if (!route.geometry || !route.geometry.coordinates || route.geometry.coordinates.length === 0) {
          console.warn(`Route "${route.name}" has no coordinates`);
          continue;
        }

        const coordinates = route.geometry.coordinates;
        console.log(`[SequenceMap] Processing route "${route.name}" with ${coordinates.length} coordinates`);

        // Handle LineString geometry
        if (route.geometry.type === "LineString" && coordinates.length > 0) {
          const validCoords = coordinates.filter((coord: any) => {
            return (
              Array.isArray(coord) &&
              coord.length >= 2 &&
              typeof coord[0] === "number" &&
              typeof coord[1] === "number" &&
              !isNaN(coord[0]) &&
              !isNaN(coord[1])
            );
          });

          console.log(`[SequenceMap] Route "${route.name}" has ${validCoords.length}/${coordinates.length} valid coordinates`);

          if (validCoords.length < 2) {
            console.warn(`Route "${route.name}" has insufficient coordinates`);
            continue;
          }

          // Convert to Leaflet LatLng format (swap from [lng, lat] to [lat, lng])
          const latlngs = validCoords.map(
            (coord: [number, number]) => [coord[1], coord[0]] as [number, number],
          );

          const polyline = L.polyline(latlngs, {
            color: getStatusColor(route.currentStatus),
            weight: 5,
            opacity: 0.7,
            interactive: !enableObstacleMarking, // Disable interaction when marking obstacles
          });

          polyline.bindPopup(`
            <div class="p-2">
              <h3 class="font-bold">${route.name}</h3>
              <p class="text-sm text-gray-600">${route.description || "No description"}</p>
              <p class="text-xs mt-1">Status: <span class="font-medium">${route.currentStatus || "Unknown"}</span></p>
              <p class="text-xs">Score: ${route.score || "N/A"}/100</p>
            </div>
          `);

          polyline.addTo(map);

          // Store polyline reference for obstacle marking
          routePolylinesRef.current.push(polyline);

          console.log(`[SequenceMap] Added polyline for "${route.name}" to map`);

          const polylineBounds = polyline.getBounds();
          bounds.extend(polylineBounds);
          hasValidRoutes = true;
        }
      }

      // Draw connectors ONLY between routes in this same path
      console.log(`[SequenceMap] Checking connectors for path "${path.name}" with ${routes.length} routes`);
      for (let i = 0; i < routes.length - 1; i++) {
        const currentRoute = routes[i];
        const nextRoute = routes[i + 1];

        const isConsecutive = areRoutesConsecutive(currentRoute, nextRoute);
        console.log(`[SequenceMap] Routes ${i}→${i + 1}: "${currentRoute.name}" → "${nextRoute.name}", consecutive=${isConsecutive}`);

        if (!isConsecutive) {
          // Routes are not connected - draw a dashed line between them
          const currentEndLat = typeof currentRoute.endLat === "string"
            ? parseFloat(currentRoute.endLat)
            : currentRoute.endLat;
          const currentEndLon = typeof currentRoute.endLon === "string"
            ? parseFloat(currentRoute.endLon)
            : currentRoute.endLon;
          const nextStartLat = typeof nextRoute.startLat === "string"
            ? parseFloat(nextRoute.startLat)
            : nextRoute.startLat;
          const nextStartLon = typeof nextRoute.startLon === "string"
            ? parseFloat(nextRoute.startLon)
            : nextRoute.startLon;

          console.log(`[SequenceMap] Coords: current(${currentEndLat},${currentEndLon}) → next(${nextStartLat},${nextStartLon})`);

          if (currentEndLat && currentEndLon && nextStartLat && nextStartLon) {
            console.log(`[SequenceMap] ✅ DRAWING RED DOTTED CONNECTOR between route ${i} and ${i+1}`);
            const gapLine = L.polyline(
              [[currentEndLat, currentEndLon], [nextStartLat, nextStartLon]],
              {
                color: "#ef4444", // red color for gaps
                weight: 2,
                opacity: 0.5,
                dashArray: "5, 5", // dashed pattern
                lineCap: "round",
              },
            );

            gapLine.bindPopup(
              `<div class="p-2 text-xs"><strong>Gap between routes</strong><br/>` +
              `Distance: ${(Math.sqrt(
                Math.pow(currentEndLat - nextStartLat, 2) +
                Math.pow(currentEndLon - nextStartLon, 2),
              ) * 111 * 1000).toFixed(0)} meters</div>`,
            );

            gapLine.addTo(map);
            bounds.extend(gapLine.getBounds());
            hasValidRoutes = true;
          }
        }
      }
    }

    // Add start and end markers for route search
    if (startCoords && endCoords) {
      const startMarker = L.marker([startCoords[0], startCoords[1]], {
        icon: L.icon({
          iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        }),
      });
      startMarker.bindPopup("Start Location").addTo(map);
      bounds.extend(startMarker.getLatLng());

      const endMarker = L.marker([endCoords[0], endCoords[1]], {
        icon: L.icon({
          iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        }),
      });
      endMarker.bindPopup("End Location").addTo(map);
      bounds.extend(endMarker.getLatLng());

      hasValidRoutes = true;
    }

    // Clear old obstacle markers
    obstacleMarkersRef.current.forEach(marker => marker.remove());
    obstacleMarkersRef.current = [];

    // Add existing obstacles as markers
    if (obstacles && obstacles.length > 0) {
      for (const obstacle of obstacles) {
        const obstacleMarker = L.marker([obstacle.lat, obstacle.lon], {
          icon: L.icon({
            iconUrl:
              "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
            shadowUrl:
              "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          }),
        });

        const popupDiv = document.createElement("div");
        popupDiv.className = "p-2 min-w-[150px]";
        
        const content = document.createElement("div");
        content.innerHTML = `
          <div class="mb-2">
            <strong class="text-orange-600">${obstacle.type.replace('_', ' ').toUpperCase()}</strong>
            ${obstacle.description ? `<p class="text-xs text-gray-600 mt-1">${obstacle.description}</p>` : ''}
            <p class="text-[10px] text-gray-400 mt-1">Status: ${obstacle.status || "Pending"}</p>
          </div>
        `;
        popupDiv.appendChild(content);

        const removeBtn = document.createElement("button");
        removeBtn.innerHTML = "🗑️ Remove Obstacle";
        removeBtn.className = "w-full mt-2 text-[10px] font-bold py-1 px-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors";
        removeBtn.onclick = () => {
          onObstacleRemoved?.(obstacle.id);
          map.removeLayer(obstacleMarker);
        };
        popupDiv.appendChild(removeBtn);

        obstacleMarker.bindPopup(popupDiv).addTo(map);

        // Store reference to prevent clearing
        obstacleMarkersRef.current.push(obstacleMarker);

        bounds.extend(obstacleMarker.getLatLng());
        hasValidRoutes = true;

        console.log(`[SequenceMap] Added obstacle marker at (${obstacle.lat}, ${obstacle.lon})`);
      }
    }

    // Fit map to show all routes and markers
    console.log(`[SequenceMap] Final: hasValidRoutes=${hasValidRoutes}, bounds.isValid()=${bounds.isValid()}`);
    if (hasValidRoutes && bounds.isValid()) {
      const southWest = bounds.getSouthWest();
      const northEast = bounds.getNorthEast();

      // Check if bounds are reasonable (roughly in Milan area)
      const isMilanArea =
        southWest.lat >= 45 && northEast.lat <= 46 &&
        southWest.lng >= 8.5 && northEast.lng <= 9.5;

      if (isMilanArea) {
        console.log(`[SequenceMap] Fitting bounds to show all routes`);
        // Use much tighter padding for zoomed in view, especially when showing single route
        const padding: [number, number] = paths.length === 1 ? [200, 200] : [50, 50];
        const maxZoom = paths.length === 1 ? 16 : 14; // Limit zoom level for single routes
        map.fitBounds(bounds, { padding, maxZoom });
      } else {
        console.warn(`[SequenceMap] Bounds outside Milan area, keeping Milan view`);
        map.setView([45.4642, 9.19], 13);
      }
    } else {
      console.warn(`[SequenceMap] No valid routes, keeping Milan view`);
      map.setView([45.4642, 9.19], 13);
    }
  }, [paths, startCoords, endCoords, obstacles, enableObstacleMarking]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="absolute inset-0 rounded-lg" />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <h4 className="text-sm font-semibold mb-2">Route Status</h4>
        <div className="space-y-1 text-xs mb-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-green-500 rounded" />
            <span>Optimal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-yellow-500 rounded" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-orange-500 rounded" />
            <span>Sufficient</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-red-500 rounded" />
            <span>Requires Maintenance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-gray-500 rounded" />
            <span>Unknown</span>
          </div>
        </div>
        {enableObstacleMarking && (
          <>
            <div className="border-t pt-2 text-xs">
              <p className="font-semibold mb-1">Obstacle Marking</p>
              <p className="text-gray-600">Click on map to mark obstacles</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
