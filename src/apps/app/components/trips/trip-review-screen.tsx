/**
 * Trip Review Screen Component
 * Displays complete trip information before publishing/saving
 * Used by both automatic and manual path recording
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
    Textarea,
} from "@repo/ui";
import { AlertCircle, Clock, Droplets, MapPin, Star, Trash2, Wind, Zap } from "lucide-react";
import { useState } from "react";

export interface TripData {
  pathName: string;
  distance: number; // km
  duration: number; // minutes
  avgSpeed: number; // km/h
  maxSpeed?: number; // km/h
  startTime: Date;
  endTime: Date;
  pathStatus: "optimal" | "medium" | "sufficient" | "requires_maintenance";
  rating?: number; // 1-5 star rating
  weather?: {
    condition: string;
    temperature?: number;
    windSpeed?: number;
    humidity?: number;
  };
  obstacles: Array<{
    id: string;
    location: string;
    type: string;
    confirmed: boolean;
  }>;
  geometry?: {
    type: "LineString";
    coordinates: Array<[number, number]>;
  };
  collectionMode: "manual" | "simulated";
}

export interface TripReviewScreenProps {
  trip: TripData;
  onPublish: (publishData: {
    name: string;
    isPublished: boolean;
    obstacles: Array<{ location: string; description: string }>;
  }) => void;
  onSave: (saveData: {
    name: string;
    isPublished: boolean;
    obstacles: Array<{ location: string; description: string }>;
  }) => void;
  onRatingChange?: (rating: number) => void;
  onDelete: () => void;
  isSubmitting?: boolean;
}

// Map status values to display labels and colors
const statusConfig: Record<
  string,
  { label: string; color: "green" | "yellow" | "orange" | "red" }
> = {
  optimal: { label: "Optimal", color: "green" },
  medium: { label: "Good", color: "yellow" },
  sufficient: { label: "Fair", color: "orange" },
  requires_maintenance: { label: "Needs Maintenance", color: "red" },
};

const statusColorMap: Record<"green" | "yellow" | "orange" | "red", string> = {
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  orange: "bg-orange-100 text-orange-800",
  red: "bg-red-100 text-red-800",
};

const weatherIcons: Record<string, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rainy: "🌧️",
  windy: "💨",
  snowy: "❄️",
  clear: "☀️",
  overcast: "☁️",
  rain: "🌧️",
};

export function TripReviewScreen({
  trip,
  onPublish,
  onSave,
  onDelete,
  onRatingChange,
  isSubmitting,
}: TripReviewScreenProps) {
  const [tripName, setTripName] = useState(trip.pathName);
  const [notes, setNotes] = useState("");
  const [confirmedObstacles, setConfirmedObstacles] = useState<string[]>(
    trip.obstacles.map((o) => o.id)
  );

  const statusInfo = statusConfig[trip.pathStatus];
  const statusColor = statusColorMap[statusInfo.color];

  // Calculate trip duration in HH:MM format
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Get weather icon
  const getWeatherIcon = (condition: string) => {
    return weatherIcons[condition.toLowerCase()] || "🌡️";
  };

  // Toggle obstacle confirmation
  const toggleObstacle = (obstacleId: string) => {
    setConfirmedObstacles((prev) =>
      prev.includes(obstacleId)
        ? prev.filter((id) => id !== obstacleId)
        : [...prev, obstacleId]
    );
  };

  // Build obstacle data for submission
  const getObstacleData = () => {
    return trip.obstacles
      .filter((o) => confirmedObstacles.includes(o.id))
      .map((o) => ({
        location: o.location,
        description: o.type,
      }));
  };

  const handlePublish = () => {
    onPublish({
      name: tripName,
      isPublished: true,
      obstacles: getObstacleData(),
    });
  };

  const handleSave = () => {
    onSave({
      name: tripName,
      isPublished: false,
      obstacles: getObstacleData(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Trip Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Distance Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Distance
              </div>
              <div className="text-2xl font-bold">{trip.distance.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">km</div>
            </div>
          </CardContent>
        </Card>

        {/* Duration Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Duration
              </div>
              <div className="text-2xl font-bold">{formatDuration(trip.duration)}</div>
              <div className="text-xs text-muted-foreground">time</div>
            </div>
          </CardContent>
        </Card>

        {/* Average Speed Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Zap className="h-4 w-4" />
                Avg Speed
              </div>
              <div className="text-2xl font-bold">{trip.avgSpeed.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">km/h</div>
            </div>
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Path Status</div>
              <span className={`px-2 py-1 rounded text-sm font-medium ${statusColor}`}>
                {statusInfo.label}
              </span>
              <div className="text-xs text-muted-foreground">condition</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weather Information - Only in Automated Mode */}
      {trip.weather && trip.collectionMode === "simulated" && (
        <Card className="border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="text-base">Weather Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {getWeatherIcon(trip.weather.condition)}
                </span>
                <div>
                  <div className="text-sm font-medium">Condition</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {trip.weather.condition}
                  </div>
                </div>
              </div>

              {trip.weather.temperature !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌡️</span>
                  <div>
                    <div className="text-sm font-medium">Temperature</div>
                    <div className="text-sm text-muted-foreground">
                      {trip.weather.temperature}°C
                    </div>
                  </div>
                </div>
              )}

              {trip.weather.windSpeed !== undefined && (
                <div className="flex items-center gap-2">
                  <Wind className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Wind</div>
                    <div className="text-sm text-muted-foreground">
                      {trip.weather.windSpeed} km/h
                    </div>
                  </div>
                </div>
              )}

              {trip.weather.humidity !== undefined && (
                <div className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Humidity</div>
                    <div className="text-sm text-muted-foreground">
                      {trip.weather.humidity}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rating Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trip Rating</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => onRatingChange?.(star)}
                  className="transition-transform active:scale-95"
                >
                  <Star
                    className={`h-7 w-7 ${
                      trip.rating && star <= trip.rating
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-gray-300 hover:text-yellow-200"
                    }`}
                  />
                </button>
              ))}
            </div>
            {trip.rating && (
              <span className="text-sm font-bold text-gray-600">
                {trip.rating}/5 Stars
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trip Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trip Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="trip-name">Trip Name</Label>
            <Input
              id="trip-name"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="Give this trip a name..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional observations..."
              rows={3}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Recording mode: {trip.collectionMode === "simulated" ? "Automated Mode" : "Manual"}</p>
            <p>
              Recorded: {trip.startTime.toLocaleDateString()} at{" "}
              {trip.startTime.toLocaleTimeString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Obstacles Section */}
      {trip.obstacles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Reported Issues ({trip.obstacles.length})
            </CardTitle>
            <CardDescription>
              Review and confirm issues detected along this path
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trip.obstacles.map((obstacle) => (
                <div
                  key={obstacle.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    id={`obstacle-${obstacle.id}`}
                    checked={confirmedObstacles.includes(obstacle.id)}
                    onChange={() => toggleObstacle(obstacle.id)}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`obstacle-${obstacle.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {obstacle.location}
                    </label>
                    <p className="text-xs text-muted-foreground">{obstacle.type}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Check the boxes for issues you want to report to the community
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Button
                onClick={handlePublish}
                disabled={isSubmitting || !tripName.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Publishing..." : "Publish to Community"}
              </Button>

              <Button
                onClick={handleSave}
                disabled={isSubmitting || !tripName.trim()}
                variant="outline"
              >
                {isSubmitting ? "Saving..." : "Save as Private"}
              </Button>

              <Button
                onClick={onDelete}
                disabled={isSubmitting}
                variant="destructive"
                className="flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Discard
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Publish to Community:</strong> Makes this path visible to other
                cyclists when they search for routes
              </p>
              <p>
                <strong>Save as Private:</strong> Stores the trip in "My Paths" for personal
                reference only
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
