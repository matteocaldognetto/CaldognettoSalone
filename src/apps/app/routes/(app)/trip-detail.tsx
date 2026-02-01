/**
 * Trip Detail Page
 * View a trip and all its routes
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  Clock,
  MapPin,
} from "lucide-react";
import * as React from "react";
import { SequenceMap } from "../../components/map/sequence-map";
import { sessionQueryOptions } from "../../lib/queries/session";
import { api } from "../../lib/trpc";

export const Route = createFileRoute("/(app)/trip-detail")({
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.fetchQuery(sessionQueryOptions());
    if (!session?.user || !session?.session) {
      throw redirect({ to: "/login", search: { redirect: "/trip-detail" } });
    }
  },
  component: TripDetailPage,
});

function TripDetailPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { tripId?: string };
  const tripId = search.tripId;

  if (!tripId) {
    return (
      <div className="p-6">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-900">No Trip Selected</p>
              <p className="text-sm text-yellow-800 mt-1">
                Please select a trip from the list to view its details.
              </p>
            </div>
          </CardContent>
        </Card>
        <Button
          onClick={() => navigate({ to: "/trips" } as any)}
          variant="outline"
          className="mt-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Trips
        </Button>
      </div>
    );
  }

  const { data, isLoading, error } = useQuery(
    api.trips.detail.queryOptions({ tripId }),
  );

  // Get obstacles for this trip
  const { data: obstacles } = useQuery(
    api.trips.getObstacles.queryOptions({ tripId }),
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Loading trip details...</p>
      </div>
    );
  }

  if (error || !data) {
    console.error("Trip detail error:", { error, data, tripId });
    return (
      <div className="p-6">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Trip not found</p>
              <p className="text-sm text-red-800 mt-1">
                The trip you're looking for doesn't exist or you don't have
                access to it.
              </p>
              {error && (
                <p className="text-xs text-red-700 mt-2 font-mono">
                  Error: {String(error)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Button
          onClick={() => navigate({ to: "/trips" } as any)}
          variant="outline"
          className="mt-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Trips
        </Button>
      </div>
    );
  }

  const trip = data.trip;
  const routes = data.routes || [];

  const totalDistance =
    routes.reduce(
      (sum: number, route: any) => sum + (parseFloat(route.distance) || 0),
      0,
    ) || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-6 border-b">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/trips" } as any)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {trip.name || "Unnamed Trip"}
            </h1>
            <p className="text-gray-600 mt-1">
              {new Date(trip.startTime).toLocaleDateString()} • {routes.length}{" "}
              routes
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Trip Map Visualization */}
          {routes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trip Route Map</CardTitle>
                <CardDescription>
                  Visual representation of your trip routes
                </CardDescription>
              </CardHeader>
              <CardContent className="h-96">
                <SequenceMap
                  paths={[
                    {
                      id: tripId || "unknown",
                      name: trip.name || undefined,
                      routes: routes
                        .filter(
                          (route) =>
                            route.startLat &&
                            route.startLon &&
                            route.endLat &&
                            route.endLon,
                        )
                        .map((route) => ({
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
                              [
                                parseFloat(route.endLon),
                                parseFloat(route.endLat),
                              ],
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
                  ]}
                  obstacles={
                    obstacles?.map((o) => ({
                      id: o.id,
                      lat: parseFloat(o.lat),
                      lon: parseFloat(o.lon),
                      type: o.type,
                      description: o.description || undefined,
                      status: o.status,
                    })) || []
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* Trip Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Trip Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-gray-600 mb-1">Distance</p>
                <p className="text-2xl font-bold">
                  {(totalDistance / 1000).toFixed(2)}
                </p>
                <p className="text-xs text-gray-600">km</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs text-gray-600 mb-1">Routes</p>
                <p className="text-2xl font-bold">{routes.length}</p>
                <p className="text-xs text-gray-600">segments</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs text-gray-600 mb-1">Collection Mode</p>
                <p className="text-xl font-bold capitalize">
                  {trip.collectionMode}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Routes List */}
          {routes && routes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Routes in This Trip</CardTitle>
                <CardDescription>
                  {routes.length} routes make up this trip
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {routes.map((route: any, idx: number) => (
                  <div
                    key={route.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">
                        {idx + 1}. {route.name}
                      </h3>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        Route {idx + 1}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <MapPin className="h-4 w-4 text-gray-600" />
                        <span>
                          Start: ({parseFloat(route.startLat).toFixed(4)},{" "}
                          {parseFloat(route.startLon).toFixed(4)})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 ml-6">
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">
                          End: ({parseFloat(route.endLat).toFixed(4)},{" "}
                          {parseFloat(route.endLon).toFixed(4)})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-700 pt-2 border-t">
                        <Clock className="h-4 w-4 text-gray-600" />
                        <span className="font-medium">
                          {(parseFloat(route.distance) / 1000).toFixed(2)} km
                        </span>
                      </div>
                    </div>

                    {/* Route Geometry Info */}
                    {route.geometry && (
                      <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        <p className="font-mono break-all">
                          Geometry: {route.geometry.type} with{" "}
                          {route.geometry.coordinates?.length || 0} points
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="pt-6">
                <p className="text-sm text-yellow-800">
                  No routes found in this trip. Routes might not be loaded yet.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Obstacles Section */}
          {obstacles && obstacles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Obstacles Reported</CardTitle>
                <CardDescription>
                  {obstacles.length} obstacle(s) encountered on this trip
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {obstacles.map((obstacle: any, idx: number) => (
                  <div
                    key={obstacle.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg capitalize">
                        {idx + 1}. {obstacle.type.replace(/_/g, " ")}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          obstacle.status === "CONFIRMED"
                            ? "bg-green-100 text-green-800"
                            : obstacle.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : obstacle.status === "REJECTED"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {obstacle.status}
                      </span>
                    </div>

                    {obstacle.description && (
                      <p className="text-sm text-gray-700 mb-2">
                        {obstacle.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <MapPin className="h-3 w-3" />
                      <span className="font-mono">
                        ({parseFloat(obstacle.lat).toFixed(4)},{" "}
                        {parseFloat(obstacle.lon).toFixed(4)})
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Rating and Publication Section */}
          <TripRatingAndPublish tripId={tripId} trip={trip} />
        </div>
      </div>

      {/* Action Buttons - Outside scroll area */}
      <div className="shrink-0 p-6 border-t">
        <Button
          onClick={() => navigate({ to: "/trips" } as any)}
          variant="outline"
          className="w-full"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Trips List
        </Button>
      </div>
    </div>
  );
}

/**
 * Trip Rating and Publication Component
 * Per RASD: User must rate (1-5) and can add notes before publishing
 */
function TripRatingAndPublish({ tripId, trip }: { tripId: string; trip: any }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rating, setRating] = React.useState<number>(0);
  const [notes, setNotes] = React.useState<string>("");
  const [pathName, setPathName] = React.useState<string>(trip.name || "");
  const [pathDescription, setPathDescription] = React.useState<string>("");

  // Check if trip is already published
  const { data: publishStatus } = useQuery(
    api.trips.isPublished.queryOptions({ tripId }),
  );

  // Get existing rating
  const { data: existingRating } = useQuery(
    api.trips.getRating.queryOptions({ tripId }),
  );

  // Get obstacles
  const { data: obstacles } = useQuery(
    api.trips.getObstacles.queryOptions({ tripId }),
  );

  // Initialize form with existing data
  React.useEffect(() => {
    if (existingRating) {
      setRating(existingRating.rating);
      setNotes(existingRating.notes || "");
    }
  }, [existingRating]);

  const addRatingMutation = useMutation(
    api.trips.addRating.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["trips", "getRating"] });
      },
    }),
  );

  const publishMutation = useMutation(
    api.trips.publish.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["trips", "isPublished"] });
        queryClient.invalidateQueries({ queryKey: ["trips", "list"] });
        alert("Trip published successfully as a community path!");
        navigate({ to: "/routes" } as any);
      },
      onError: (error: any) => {
        alert(error.message || "Failed to publish trip");
      },
    }),
  );

  const handleSaveRating = async () => {
    if (rating < 1 || rating > 5) {
      alert("Please provide a rating between 1 and 5");
      return;
    }

    await addRatingMutation.mutateAsync({
      tripId,
      rating,
      notes,
    });
    alert("Rating saved!");
  };

  const handlePublish = async () => {
    if (rating < 1 || rating > 5) {
      alert("Please rate your trip (1-5 stars) before publishing");
      return;
    }

    if (!pathName.trim()) {
      alert("Please provide a name for this path");
      return;
    }

    // Save rating first if not saved
    if (
      !existingRating ||
      existingRating.rating !== rating ||
      existingRating.notes !== notes
    ) {
      await addRatingMutation.mutateAsync({
        tripId,
        rating,
        notes,
      });
    }

    // Publish
    await publishMutation.mutateAsync({
      tripId,
      pathName,
      pathDescription,
    });
  };

  if (publishStatus?.isPublished) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-900">Published Path</CardTitle>
          <CardDescription className="text-green-800">
            This trip has been published to the community
          </CardDescription>
        </CardHeader>
        {/*<CardContent>
          <Button
            onClick={() =>
              navigate({
                to: "/routes",
                search: { pathId: publishStatus.pathId },
              } as any)
            }
            className="w-full"
          >
            View Published Path
          </Button>
        </CardContent>*/}
      </Card>
    );
  }

  const pendingObstacles =
    obstacles?.filter((o: any) => o.status === "PENDING") || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate & Publish Trip</CardTitle>
        <CardDescription>
          Rate your trip (1-5) and publish to share with the community
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending Obstacles Warning */}
        {pendingObstacles.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900">
                  Pending Obstacles
                </p>
                <p className="text-sm text-yellow-800 mt-1">
                  You have {pendingObstacles.length} obstacle(s) that need
                  confirmation before publishing
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rating */}
        <div className="space-y-2">
          <Label htmlFor="rating">Trip Rating (1-5) *</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-3xl ${rating >= star ? "text-yellow-500" : "text-gray-300"}`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {rating === 0 && "Click to rate this trip"}
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent"}
          </p>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Add descriptive notes about route specifics..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Button
          onClick={handleSaveRating}
          variant="outline"
          className="w-full"
          disabled={addRatingMutation.isPending || rating < 1}
        >
          {addRatingMutation.isPending ? "Saving..." : "Save Rating"}
        </Button>

        <div className="border-t pt-4 space-y-3">
          <h3 className="font-semibold">Publish as Community Path</h3>
          <div className="space-y-2">
            <Label htmlFor="pathName">Path Name *</Label>
            <Input
              id="pathName"
              placeholder="e.g., Milan City Center Loop"
              value={pathName}
              onChange={(e) => setPathName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pathDescription">Description (Optional)</Label>
            <Textarea
              id="pathDescription"
              placeholder="Describe this path for the community..."
              value={pathDescription}
              onChange={(e) => setPathDescription(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            onClick={handlePublish}
            className="w-full"
            disabled={
              publishMutation.isPending || rating < 1 || !pathName.trim()
            }
          >
            {publishMutation.isPending
              ? "Publishing..."
              : "Publish to Community"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
