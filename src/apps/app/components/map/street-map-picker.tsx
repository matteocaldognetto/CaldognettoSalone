import { Button } from "@repo/ui";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getNearbyStreets, type NearbyStreet } from "../../lib/overpass";

interface StreetMapPickerProps {
  centerLat: number;
  centerLon: number;
  existingRoutes?: Array<{
    name: string;
    geometry: { coordinates: Array<[number, number]> };
  }>;
  onStreetSelected: (streetName: string) => void;
  onCancel: () => void;
}

export function StreetMapPicker({
  centerLat,
  centerLon,
  existingRoutes = [],
  onStreetSelected,
  onCancel,
}: StreetMapPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const clickMarkerRef = useRef<L.Marker | null>(null);

  const [nearbyStreets, setNearbyStreets] = useState<NearbyStreet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clickedPoint, setClickedPoint] = useState<{ lat: number; lon: number } | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([centerLat, centerLon], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw existing routes on map
  useEffect(() => {
    if (!mapRef.current || existingRoutes.length === 0) return;

    const map = mapRef.current;

    // Clear existing route layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Polyline && !(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    // Draw all existing routes
    for (const route of existingRoutes) {
      if (route.geometry && route.geometry.coordinates.length > 0) {
        const latlngs = route.geometry.coordinates.map((coord) => [coord[1], coord[0]] as [number, number]);

        const polyline = L.polyline(latlngs, {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.7,
        });

        polyline.bindPopup(route.name).addTo(map);
      }
    }

    // Add marker for the last point (where user should continue from)
    const lastRoute = existingRoutes[existingRoutes.length - 1];
    if (lastRoute?.geometry?.coordinates) {
      const lastCoord = lastRoute.geometry.coordinates[lastRoute.geometry.coordinates.length - 1];
      const marker = L.marker([lastCoord[1], lastCoord[0]], {
        icon: L.icon({
          iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
        }),
      });
      marker.bindPopup("Continue from here").addTo(map);
    }
  }, [existingRoutes]);

  // Handle map clicks to find nearby streets
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setClickedPoint({ lat, lon: lng });
      setIsLoading(true);

      // Add temporary marker
      if (clickMarkerRef.current) {
        mapRef.current?.removeLayer(clickMarkerRef.current);
      }

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "custom-marker",
          html: '<div style="background: orange; color: white; padding: 8px; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">📍</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      });
      marker.addTo(mapRef.current!);
      clickMarkerRef.current = marker;

      // Fetch nearby streets
      try {
        const streets = await getNearbyStreets(lat, lng, 50);
        setNearbyStreets(streets);

        if (streets.length === 0) {
          alert("No streets found nearby. Try clicking on a road.");
        }
      } catch (error) {
        console.error("Failed to fetch nearby streets:", error);
        alert("Failed to find streets. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    mapRef.current.on("click", handleMapClick);

    return () => {
      if (mapRef.current) {
        mapRef.current.off("click", handleMapClick);
      }
    };
  }, []);

  const handleStreetSelect = (streetName: string) => {
    onStreetSelected(streetName);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Select Next Street from Map
        </h3>
        <p className="text-sm text-blue-800">
          Click anywhere on the map to see nearby streets. The map shows your current route in blue.
        </p>
      </div>

      {/* Map */}
      <div ref={mapContainerRef} className="w-full h-96 rounded-lg border" />

      {/* Nearby Streets List */}
      {clickedPoint && (
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">
              {isLoading ? "Searching..." : `Streets near clicked point`}
            </h4>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          </div>

          {!isLoading && nearbyStreets.length > 0 && (
            <div className="space-y-2">
              {nearbyStreets.slice(0, 8).map((street, idx) => (
                <button
                  key={idx}
                  onClick={() => handleStreetSelect(street.name)}
                  className="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-blue-700">
                        {street.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {street.distance}m away {street.type ? `• ${street.type}` : ""}
                      </p>
                    </div>
                    <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && nearbyStreets.length === 0 && clickedPoint && (
            <p className="text-sm text-gray-500 text-center py-4">
              No streets found at this location. Try clicking on a road.
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          <X className="h-4 w-4 mr-2" />
          Cancel / Use Search Instead
        </Button>
      </div>
    </div>
  );
}
