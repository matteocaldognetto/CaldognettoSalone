import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
    Clock,
    Eye,
    MapPin,
    Plus,
    Share2,
    Trash2,
    TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DeleteConfirmationDialog } from "../../components/ux/delete-confirmation-dialog";
import { sessionQueryOptions } from "../../lib/queries/session";
import { api } from "../../lib/trpc";

interface WeatherData {
  condition?: string;
  temperature?: number;
  [key: string]: unknown; // Allow additional weather properties
}

export const Route = createFileRoute("/(app)/trips")({
  // Require authentication for trips
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionQueryOptions());
    if (!session?.user || !session?.session) {
      throw redirect({ to: "/login", search: { redirect: "/trips" } });
    }
  },
  component: TripsPage,
});

interface Trip {
  id: string;
  name: string;
  startTime: Date | string;
  endTime: Date | string;
  distance: number | string;
  duration: number | string;
  avgSpeed: number | string | null;
  maxSpeed?: number | string | null;
  weatherData?: WeatherData;
  route?: {
    type: string;
    coordinates: Array<[number, number]>;
  };
}

function TripsPage() {
  const navigate = useNavigate();
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [publishedTripIds, setPublishedTripIds] = useState<Set<string>>(
    new Set(),
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tripToDeleteId, setTripToDeleteId] = useState<string | null>(null);
  const [publicDialogOpen, setPublicDialogOpen] = useState(false);
  const [tripToPublic, setTripToPublic] = useState<{id: string, name: string} | null>(null);
  const queryClient = useQueryClient();
  const { data: trips, isLoading } = useQuery(api.trips.list.queryOptions());
  const deleteTrip = useMutation(
    api.trips.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: api.trips.list.queryKey(),
        });
      },
    }),
  );

  const makePublic = useMutation(
    api.path.publishTripAsPath.mutationOptions({
      onSuccess: (_data, variables) => {
        setPublishedTripIds((prev) => new Set([...prev, variables.tripId]));
        alert("Trip is now public! It appears on the map.");
        queryClient.invalidateQueries({
          queryKey: api.path.search.queryKey({ limit: 50 }),
        });
      },
    }),
  );

  // Check if trips are published when trips list loads
  useEffect(() => {
    if (!trips || trips.length === 0) return;

    // Check each trip's published status
    trips.forEach((trip: any) => {
      queryClient
        .ensureQueryData(
          api.trips.isPublished.queryOptions({ tripId: trip.id }),
        )
        .then((result: any) => {
          if (result?.isPublished) {
            setPublishedTripIds((prev) => {
              // Only update if not already in set to avoid unnecessary re-renders
              if (prev.has(trip.id)) return prev;
              return new Set([...prev, trip.id]);
            });
          }
        })
        .catch(() => {
          // Silently ignore errors checking published status
        });
    });
  }, [trips]); // Removed queryClient dependency as it's stable

  const handleMakePublic = (tripId: string, tripName: string) => {
    setTripToPublic({ id: tripId, name: tripName });
    setPublicDialogOpen(true);
  };

  const confirmMakePublic = async () => {
    if (!tripToPublic) return;
    try {
      await makePublic.mutateAsync({ 
        tripId: tripToPublic.id, 
        pathName: tripToPublic.name 
      });
      setPublicDialogOpen(false);
      setTripToPublic(null);
    } catch (error) {
      console.error("Failed to make trip public:", error);
    }
  };

  const formatDistance = (meters: string | number) => {
    const m = typeof meters === "string" ? parseFloat(meters) : meters;
    if (m >= 1000) {
      return `${(m / 1000).toFixed(2)} km`;
    }
    return `${m.toFixed(0)} m`;
  };

  const formatDuration = (seconds: number | string) => {
    const s = typeof seconds === "string" ? parseInt(seconds) : seconds;
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatSpeed = (kmh: string | number | null | undefined) => {
    if (!kmh) return "N/A";
    const speed = typeof kmh === "string" ? parseFloat(kmh) : kmh;
    return `${speed.toFixed(1)} km/h`;
  };

  const handleDelete = (tripId: string) => {
    setTripToDeleteId(tripId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!tripToDeleteId) return;
    
    try {
      await deleteTrip.mutateAsync({ tripId: tripToDeleteId });
      setDeleteDialogOpen(false);
      setTripToDeleteId(null);
    } catch (error) {
      console.error("Failed to delete trip:", error);
      alert("Failed to delete trip. Check console for details.");
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">My Paths</h2>
          <p className="text-muted-foreground">
            View and manage your recorded bike routes
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/trip-record" } as any)}>
          <Plus className="h-4 w-4 mr-2" />
          Record Path
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading your paths...</p>
        </div>
      )}

      {!isLoading && trips && trips.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No paths yet</h3>
            <p className="text-muted-foreground mb-4">
              Start recording your bike paths to track your favorite routes
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate({ to: "/trip-record" } as any)}>
                <Plus className="h-4 w-4 mr-2" />
                Record Your First Path
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/trip-report" } as any)}
              >
                Report a Route
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && trips && trips.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip: any) => (
              <Card
                key={trip.id}
                className="hover:shadow-md transition-shadow flex flex-col"
              >
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="truncate text-lg">
                        {trip.name || "Unnamed Path"}
                      </CardTitle>
                      <CardDescription>
                        {new Date(trip.startTime).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        at{" "}
                        {new Date(trip.startTime).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center text-sm justify-between">
                      <div className="flex items-center text-muted-foreground">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span>Distance</span>
                      </div>
                      <span className="font-medium">
                        {formatDistance(trip.distance)}
                      </span>
                    </div>
                    <div className="flex items-center text-sm justify-between">
                      <div className="flex items-center text-muted-foreground">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>Duration</span>
                      </div>
                      <span className="font-medium">
                        {formatDuration(trip.duration)}
                      </span>
                    </div>
                    <div className="flex items-center text-sm justify-between">
                      <div className="flex items-center text-muted-foreground">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        <span>Avg Speed</span>
                      </div>
                      <span className="font-medium">
                        {formatSpeed(trip.avgSpeed)}
                      </span>
                    </div>
                  </div>

                  {trip.weatherData ? (
                    <div className="mt-2 pt-2 border-t">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Weather</span>
                          <span className="capitalize font-medium">
                            {(trip.weatherData as WeatherData).condition}
                          </span>
                        </div>
                        {(trip.weatherData as WeatherData).temperature && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Temperature
                            </span>
                            <span className="font-medium">
                              {(trip.weatherData as WeatherData).temperature}°C
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
                <div className="border-t px-6 py-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      navigate({
                        to: "/trip-detail",
                        search: { tripId: trip.id },
                      } as any)
                    }
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleMakePublic(trip.id, trip.name)}
                    disabled={
                      makePublic.isPending || publishedTripIds.has(trip.id)
                    }
                    title={
                      publishedTripIds.has(trip.id)
                        ? "This trip has already been published"
                        : undefined
                    }
                  >
                    <Share2 className="h-4 w-4 mr-1" />
                    {publishedTripIds.has(trip.id)
                      ? "Published"
                      : "Make Public"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(trip.id)}
                    disabled={deleteTrip.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Dialog open={publicDialogOpen} onOpenChange={setPublicDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <div className="flex items-center gap-3 text-blue-600 mb-2">
                  <div className="bg-blue-50 p-2 rounded-full">
                    <Share2 className="h-6 w-6" />
                  </div>
                  <DialogTitle className="text-xl font-bold">Publish to Community</DialogTitle>
                </div>
                <DialogDescription>
                  Are you sure you want to make "{tripToPublic?.name}" public? 
                  It will be visible to all users on the Discover map.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setPublicDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={confirmMakePublic} 
                  disabled={makePublic.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {makePublic.isPending ? "Publishing..." : "Yes, Publish Path"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Trip Detail Dialog */}
          {selectedTrip && (
            <Dialog
              open={!!selectedTrip}
              onOpenChange={(open) => !open && setSelectedTrip(null)}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedTrip.name || "Path Details"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Distance</p>
                      <p className="text-lg font-semibold">
                        {formatDistance(selectedTrip.distance)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-lg font-semibold">
                        {formatDuration(selectedTrip.duration)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">
                        Average Speed
                      </p>
                      <p className="text-lg font-semibold">
                        {formatSpeed(selectedTrip.avgSpeed)}
                      </p>
                    </div>
                    {selectedTrip.maxSpeed && (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">
                          Max Speed
                        </p>
                        <p className="text-lg font-semibold">
                          {formatSpeed(selectedTrip.maxSpeed)}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedTrip.weatherData && (
                    <div className="rounded-lg border p-4 space-y-2">
                      <p className="font-semibold">Weather Conditions</p>
                      <div className="grid grid-cols-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Condition</p>
                          <p className="capitalize font-medium">
                            {
                              (selectedTrip.weatherData as WeatherData)
                                .condition
                            }
                          </p>
                        </div>
                        {(selectedTrip.weatherData as WeatherData)
                          .temperature && (
                          <div>
                            <p className="text-muted-foreground">Temperature</p>
                            <p className="font-medium">
                              {
                                (selectedTrip.weatherData as WeatherData)
                                  .temperature
                              }
                              °C
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    <p>
                      Recorded:{" "}
                      {new Date(selectedTrip.startTime).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <DeleteConfirmationDialog
            isOpen={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
            onConfirm={confirmDelete}
            title="Delete Trip"
            description="Are you sure you want to delete this trip? This will remove all route data and any associated community reports."
            isLoading={deleteTrip.isPending}
          />
        </>
      )}
    </div>
  );
}
