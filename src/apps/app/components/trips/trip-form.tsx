import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/trpc";

interface TripFormProps {
  onSuccess?: () => void;
}

export function TripForm({ onSuccess }: TripFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [avgSpeed, setAvgSpeed] = useState("");
  const [maxSpeed, setMaxSpeed] = useState("");
  const [weatherCondition, setWeatherCondition] = useState("");
  const [temperature, setTemperature] = useState("");

  const createTrip = useMutation(
    api.trips.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: api.trips.list.queryKey(),
        });
        if (onSuccess) onSuccess();
        // Reset form
        setName("");
        setDistance("");
        setDuration("");
        setAvgSpeed("");
        setMaxSpeed("");
        setWeatherCondition("");
        setTemperature("");
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    const now = new Date();
    const durationMinutes = parseInt(duration);
    const startTime = new Date(now.getTime() - durationMinutes * 60 * 1000);

    // Create weather data object if provided
    const weatherData = weatherCondition
      ? {
          condition: weatherCondition,
          temperature: temperature ? parseFloat(temperature) : undefined,
          timestamp: now.toISOString(),
        }
      : undefined;

    createTrip.mutate({
      name: name || "Unnamed Trip",
      startTime,
      endTime: now,
      collectionMode: "manual" as const,
      weatherData,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Trip Name (optional)</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Morning commute"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="distance">Distance (meters) *</Label>
          <Input
            id="distance"
            type="number"
            step="0.1"
            min="0"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="5000"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="duration">Duration (minutes) *</Label>
          <Input
            id="duration"
            type="number"
            min="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="avgSpeed">Average Speed (km/h)</Label>
          <Input
            id="avgSpeed"
            type="number"
            step="0.1"
            min="0"
            value={avgSpeed}
            onChange={(e) => setAvgSpeed(e.target.value)}
            placeholder="15.5"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="maxSpeed">Max Speed (km/h)</Label>
          <Input
            id="maxSpeed"
            type="number"
            step="0.1"
            min="0"
            value={maxSpeed}
            onChange={(e) => setMaxSpeed(e.target.value)}
            placeholder="25.0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="weather">Weather Condition</Label>
          <Select value={weatherCondition} onValueChange={setWeatherCondition}>
            <SelectTrigger>
              <SelectValue placeholder="Select weather" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sunny">Sunny</SelectItem>
              <SelectItem value="cloudy">Cloudy</SelectItem>
              <SelectItem value="rainy">Rainy</SelectItem>
              <SelectItem value="windy">Windy</SelectItem>
              <SelectItem value="snowy">Snowy</SelectItem>
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
            onChange={(e) => setTemperature(e.target.value)}
            placeholder="20"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={createTrip.isPending}>
          {createTrip.isPending ? "Saving..." : "Save Trip"}
        </Button>
        {onSuccess && (
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
        )}
      </div>

      {createTrip.isError && (
        <p className="text-sm text-red-600">
          Failed to save trip. Please try again.
        </p>
      )}
    </form>
  );
}
