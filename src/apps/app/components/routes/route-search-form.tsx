import { Button, Label } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { trpcClient } from "../../lib/trpc";
import type { StreetSuggestion } from "../street-autocomplete";
import { StreetAutocomplete } from "../street-autocomplete";

interface RouteSearchFormProps {
  onSearchResults?: (
    routes: any[],
    start?: [number, number],
    end?: [number, number],
    startStreet?: string,
    endStreet?: string,
  ) => void;
  onSearchStart?: () => void;
}

export function RouteSearchForm({
  onSearchResults,
  onSearchStart,
}: RouteSearchFormProps) {
  const [startStreet, setStartStreet] = useState<string>("");
  const [endStreet, setEndStreet] = useState<string>("");
  const [startStreetData, setStartStreetData] =
    useState<StreetSuggestion | null>(null);
  const [endStreetData, setEndStreetData] = useState<StreetSuggestion | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const searchRoutes = useMutation({
    mutationFn: async () => {
      if (!startStreetData || !endStreetData) {
        setError("Please select both start and end streets");
        return;
      }

      if (startStreetData.name === endStreetData.name) {
        setError("Start and end streets must be different");
        return;
      }

      setError(null);

      try {
        // Search routes by street names
        const result = await trpcClient.routing.findRoutes.query({
          startStreetName: startStreetData.name,
          endStreetName: endStreetData.name,
        });

        const routes = result?.routes || [];
        if (routes.length > 0) {
          // Pass routes, coordinates, and street names from the street data
          onSearchResults?.(
            routes,
            [startStreetData.lon, startStreetData.lat],
            [endStreetData.lon, endStreetData.lat],
            startStreetData.name,
            endStreetData.name,
          );
        } else {
          setError(result?.message || "No routes found between these streets");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error searching routes");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchStart?.();
    searchRoutes.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="start-street">Start Street</Label>
          <StreetAutocomplete
            value={startStreet}
            onChange={setStartStreet}
            onSelect={(suggestion) => {
              setStartStreetData(suggestion);
            }}
            placeholder="Type street name..."
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="end-street">End Street</Label>
          <StreetAutocomplete
            value={endStreet}
            onChange={setEndStreet}
            onSelect={(suggestion) => {
              setEndStreetData(suggestion);
            }}
            placeholder="Type street name..."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={
            searchRoutes.isPending || !startStreetData || !endStreetData
          }
          className="flex-1"
        >
          {searchRoutes.isPending ? "Searching..." : "Search Routes"}
        </Button>
      </div>

      <div className="text-xs text-gray-500">
        <p>Search for any street in Milan to find bike routes between them</p>
      </div>
    </form>
  );
}
