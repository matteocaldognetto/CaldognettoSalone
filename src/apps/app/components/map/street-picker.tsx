import { Button } from "@repo/ui";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, RotateCcw, Route } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { snapToStreet, type StreetGeometry } from "../../lib/overpass";

interface StreetPickerProps {
  streetGeometry: StreetGeometry;
  initialStartPoint?: [number, number] | null; // [lat, lon]
  onStartSelected: (lat: number, lon: number) => void;
  onEndSelected: (lat: number, lon: number) => void;
  onComplete: (startLat: number, startLon: number, endLat: number, endLon: number) => void;
}

export function StreetPicker({
  streetGeometry,
  initialStartPoint,
  onStartSelected,
  onEndSelected,
  onComplete,
}: StreetPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const streetPolylineRef = useRef<L.Polyline | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);

  const [startPoint, setStartPoint] = useState<[number, number] | null>(
    initialStartPoint ? [initialStartPoint[1], initialStartPoint[0]] : null,
  );
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [pickerMode, setPickerMode] = useState<"start" | "end">(
    initialStartPoint ? "end" : "start",
  );

  // Get the first and last coordinates of the street geometry
  const getEntireStreetPoints = (): { start: [number, number]; end: [number, number] } | null => {
    if (!streetGeometry || streetGeometry.coordinates.length < 2) return null;
    
    const coords = streetGeometry.coordinates;
    const start: [number, number] = [coords[0][0], coords[0][1]]; // [lon, lat]
    const end: [number, number] = [coords[coords.length - 1][0], coords[coords.length - 1][1]];
    
    return { start, end };
  };

  // NOTE: No auto-selection - user must click on the map to select start and end points

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([45.4642, 9.19], 13);

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

  // Sync initialStartPoint if it changes
  useEffect(() => {
    if (initialStartPoint) {
      const snapped = snapToStreet(
        [initialStartPoint[1], initialStartPoint[0]],
        streetGeometry.coordinates,
      );
      setStartPoint(snapped);
      setPickerMode("end");
      onStartSelected(snapped[1], snapped[0]);
    }
  }, [initialStartPoint, streetGeometry]);

  // Draw street on map and fit bounds
  useEffect(() => {
    if (!mapRef.current || !streetGeometry) return;

    const map = mapRef.current;

    // Remove old polyline
    if (streetPolylineRef.current) {
      map.removeLayer(streetPolylineRef.current);
    }

    // Convert [lon, lat] to [lat, lon] for Leaflet
    const latlngs: L.LatLngExpression[] = streetGeometry.coordinates.map((coord) => [coord[1], coord[0]]);

    // Draw street
    const polyline = L.polyline(latlngs, {
      color: "#3b82f6", // blue
      weight: 4,
      opacity: 0.8,
    });

    polyline.addTo(map);
    streetPolylineRef.current = polyline;

    // Fit map to street bounds
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [streetGeometry]);

  // Add/update route polyline between start and end (only the selected segment)
  useEffect(() => {
    if (!mapRef.current || !startPoint || !endPoint) {
      if (routePolylineRef.current && mapRef.current) {
        mapRef.current.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }
      return;
    }

    const map = mapRef.current;

    // Remove old route
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
    }

    // Find indices of start and end points in street coordinates
    const coords = streetGeometry.coordinates;
    let startIdx = 0;
    let endIdx = coords.length - 1;
    let minStartDist = Infinity;
    let minEndDist = Infinity;

    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];
      const startDist = Math.pow(startPoint[0] - coord[0], 2) + Math.pow(startPoint[1] - coord[1], 2);
      const endDist = Math.pow(endPoint[0] - coord[0], 2) + Math.pow(endPoint[1] - coord[1], 2);

      if (startDist < minStartDist) {
        minStartDist = startDist;
        startIdx = i;
      }
      if (endDist < minEndDist) {
        minEndDist = endDist;
        endIdx = i;
      }
    }

    // Extract only the segment between start and end
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const segmentCoords = coords.slice(minIdx, maxIdx + 1);

    // Convert to Leaflet format [lat, lon]
    const routeCoords: L.LatLngExpression[] = segmentCoords.map((coord) => [coord[1], coord[0]]);

    const route = L.polyline(routeCoords, {
      color: "#10b981", // green
      weight: 6,
      opacity: 0.9,
    });

    route.addTo(map);
    routePolylineRef.current = route;
  }, [startPoint, endPoint, streetGeometry]);

  // Update start marker
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Remove old marker
    if (startMarkerRef.current) {
      map.removeLayer(startMarkerRef.current);
    }

    if (startPoint) {
      const marker = L.marker([startPoint[1], startPoint[0]], {
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

      marker.bindPopup("START").addTo(map);
      startMarkerRef.current = marker;
    }
  }, [startPoint]);

  // Update end marker
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Remove old marker
    if (endMarkerRef.current) {
      map.removeLayer(endMarkerRef.current);
    }

    if (endPoint) {
      const marker = L.marker([endPoint[1], endPoint[0]], {
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

      marker.bindPopup("END").addTo(map);
      endMarkerRef.current = marker;
    }
  }, [endPoint]);

  // Handle map clicks to place start/end points (for manual override)
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    const clickedPoint: [number, number] = [e.latlng.lng, e.latlng.lat];

    // Snap to nearest point on street
    const snappedPoint = snapToStreet(clickedPoint, streetGeometry.coordinates);

    if (pickerMode === "start") {
      setStartPoint(snappedPoint);
      onStartSelected(snappedPoint[1], snappedPoint[0]);
      setPickerMode("end");
    } else {
      setEndPoint(snappedPoint);
      onEndSelected(snappedPoint[1], snappedPoint[0]);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.on("click", handleMapClick);

    return () => {
      if (mapRef.current) {
        mapRef.current.off("click", handleMapClick);
      }
    };
  }, [pickerMode, streetGeometry]);

  const handleReset = () => {
    if (initialStartPoint) {
      const snapped = snapToStreet(
        [initialStartPoint[1], initialStartPoint[0]],
        streetGeometry.coordinates,
      );
      setStartPoint(snapped);
      setEndPoint(null);
      setPickerMode("end");
    } else {
      setStartPoint(null);
      setEndPoint(null);
      setPickerMode("start");
    }

    if (startMarkerRef.current && mapRef.current && !initialStartPoint) {
      mapRef.current.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(endMarkerRef.current);
      endMarkerRef.current = null;
    }
    if (routePolylineRef.current && mapRef.current) {
      mapRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
  };

  const handleUseEntireStreet = () => {
    const points = getEntireStreetPoints();
    if (points) {
      setStartPoint(points.start);
      setEndPoint(points.end);
      onStartSelected(points.start[1], points.start[0]);
      onEndSelected(points.end[1], points.end[0]);
    }
  };

  const handleComplete = () => {
    if (startPoint && endPoint) {
      onComplete(startPoint[1], startPoint[0], endPoint[1], endPoint[0]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div ref={mapContainerRef} className="w-full h-96 rounded-lg border" />

      {startPoint && endPoint ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-900 font-semibold mb-2">✅ Entire street selected!</p>
          <div className="text-xs text-green-800 space-y-1">
            <p>Start: ({startPoint[1].toFixed(4)}, {startPoint[0].toFixed(4)})</p>
            <p>End: ({endPoint[1].toFixed(4)}, {endPoint[0].toFixed(4)})</p>
          </div>
          <p className="text-xs text-green-700 mt-2">
            Click on the map if you want to adjust the start or end points manually.
          </p>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-900">
            {pickerMode === "start" ? (
              <>
                <p className="font-semibold mb-1">📍 Click on map to set START point</p>
                <p>Click anywhere on the blue street line to mark where you started</p>
              </>
            ) : startPoint ? (
              <>
                <p className="font-semibold mb-1">
                  {initialStartPoint ? "🔗 Continuing from previous street" : "🎯 Click on map to set END point"}
                </p>
                <p>
                  Click where the segment ends. {initialStartPoint ? "Starting point locked to connection." : `You've already marked the start at (${startPoint[1].toFixed(4)}, ${startPoint[0].toFixed(4)})`}
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleUseEntireStreet}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Route className="h-4 w-4" />
          Use Entire Street
        </Button>

        <Button
          onClick={handleReset}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>

        <Button
          onClick={handleComplete}
          disabled={!startPoint || !endPoint}
          size="sm"
          className="flex items-center gap-2"
        >
          <MapPin className="h-4 w-4" />
          Confirm Route
        </Button>
      </div>
    </div>
  );
}

