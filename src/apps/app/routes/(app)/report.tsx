/**
 * Report on Existing Community Paths
 *
 * Per RASD: This page is for reporting on EXISTING published community paths.
 * Users can:
 * - Search for published paths
 * - Update street/segment status
 * - Report obstacles
 * - Add/update ratings
 *
 * NOTE: Recording NEW trips is done in /trip-record, NOT here.
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AlertCircle, MapPin, Star, Trash2 } from "lucide-react";
import * as React from "react";
import { SequenceMap } from "../../components/map/sequence-map";
import { ObstacleDialog } from "../../components/obstacles/obstacle-dialog";
import { sessionQueryOptions } from "../../lib/queries/session";
import { api } from "../../lib/trpc";

export const Route = createFileRoute("/(app)/report")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionQueryOptions());
    if (!session?.user || !session?.session) {
      throw redirect({ to: "/login", search: { redirect: "/report" } });
    }
  },
  component: ReportPage,
});

type PathStatus = "optimal" | "medium" | "sufficient" | "requires_maintenance";

interface ObstacleReport {
  id: string;
  type: string;
  description: string;
  lat: number;
  lon: number;
}

function ReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedPathId, setSelectedPathId] = React.useState<string | null>(
    null,
  );

  // Path reporting state
  const [rating, setRating] = React.useState<number>(0);
  const [notes, setNotes] = React.useState<string>("");
  const [obstacles, setObstacles] = React.useState<ObstacleReport[]>([]);
  const [segmentStatuses, setSegmentStatuses] = React.useState<
    Record<string, PathStatus>
  >({});

  // Obstacle marking state
  const [enableObstacleMarking, setEnableObstacleMarking] = React.useState(false);
  const [obstacleDialogOpen, setObstacleDialogOpen] = React.useState(false);
  const [pendingObstacleCoords, setPendingObstacleCoords] = React.useState<{
    lat: number;
    lon: number;
  } | null>(null);

  // Search for published paths (only when user types at least 2 chars)
  const { data: paths } = useQuery({
    ...api.path.search.queryOptions({
      query: searchQuery,
      limit: 10,
    }),
    enabled: searchQuery.length >= 2,
  });

  // Get selected path details (only when path is selected)
  const { data: selectedPath } = useQuery({
    ...api.path.getDetails.queryOptions({
      id: selectedPathId || "",
    }),
    enabled: !!selectedPathId,
  });

  // Initialize segment statuses when path is loaded
  React.useEffect(() => {
    if (selectedPath && selectedPath.streets && selectedPath.streets.length > 0) {
      const initialStatuses: Record<string, PathStatus> = {};
      for (const street of selectedPath.streets) {
        // Use current street status or default to optimal
        initialStatuses[street.id] = (street.currentStatus as PathStatus) || "optimal";
      }
      setSegmentStatuses(initialStatuses);
    }
  }, [selectedPath]);

  // Memoize paths array to prevent map re-initialization on every render
  const memoizedPaths = React.useMemo(() => {
    if (!selectedPath) return [];

    return [
      {
        id: selectedPath.path.id,
        name: selectedPath.path.name || undefined,
        routes: selectedPath.streets && selectedPath.streets.length > 0
          ? selectedPath.streets.map((street: any) => ({
              id: street.id,
              name: street.name,
              description: street.description || "",
              geometry: street.geometry || { type: "LineString" as const, coordinates: [] },
              currentStatus: street.currentStatus,
              score: street.score,
              startLat: street.startLat,
              startLon: street.startLon,
              endLat: street.endLat,
              endLon: street.endLon,
            }))
          : [{
              id: selectedPath.path.id,
              name: selectedPath.path.name || "Path",
              description: selectedPath.path.description || "",
              geometry: (selectedPath.path.geometry || { type: "LineString" as const, coordinates: [] }) as { type: "LineString"; coordinates: [number, number][] },
              currentStatus: selectedPath.path.currentStatus,
              score: selectedPath.path.score ? parseFloat(selectedPath.path.score) : null,
            }],
      },
    ];
  }, [selectedPath]);

  // Memoize obstacles array to prevent map re-initialization
  const memoizedObstacles = React.useMemo(() => {
    const existingObstacles = (selectedPath?.obstacles || []).map((o: any) => ({
      id: o.id,
      type: o.type,
      description: o.description,
      lat: parseFloat(o.lat),
      lon: parseFloat(o.lon),
    }));

    console.log('[Report] Existing obstacles from DB:', existingObstacles);
    console.log('[Report] New obstacles from user:', obstacles);
    console.log('[Report] Combined obstacles:', [...existingObstacles, ...obstacles]);

    return [...existingObstacles, ...obstacles];
  }, [selectedPath, obstacles]);

  const submitReportMutation = useMutation({
    mutationFn: async (data: {
      pathId: string;
      rating?: number;
      notes?: string;
      obstacles: ObstacleReport[];
      segmentStatuses: Record<string, PathStatus>;
    }) => {
      // Convert segmentStatuses to streetReports format
      const streetReports = Object.entries(data.segmentStatuses).map(
        ([streetId, status]) => ({
          streetId,
          status,
        }),
      );

      // Submit to API
      const { trpcClient } = await import("../../lib/trpc");
      return await trpcClient.path.submitReport.mutate({
        pathId: data.pathId,
        streetReports,
        rating: data.rating,
        obstacles: data.obstacles.length > 0 ? data.obstacles : undefined,
      });
    },
    onSuccess: (result) => {
      // Invalidate all queries to refresh scores/statuses everywhere
      queryClient.invalidateQueries();

      let message = "Report submitted successfully! Street statuses and path scores updated.";
      if (result.obstaclesMessage) {
        message += "\n\n" + result.obstaclesMessage;
      }

      alert(message);

      // Reset form
      setSelectedPathId(null);
      setSearchQuery("");
      setRating(0);
      setNotes("");
      setObstacles([]);
      setSegmentStatuses({});
      setEnableObstacleMarking(false);
    },
  });

  const handleObstacleMarked = (lat: number, lon: number) => {
    setPendingObstacleCoords({ lat, lon });
    setObstacleDialogOpen(true);
  };

  const handleObstacleSave = (data: {
    type: string;
    description: string;
    lat: number;
    lon: number;
  }) => {
    const newObstacle: ObstacleReport = {
      id: `obstacle-${Date.now()}`,
      type: data.type,
      description: data.description,
      lat: data.lat,
      lon: data.lon,
    };
    setObstacles([...obstacles, newObstacle]);
    setObstacleDialogOpen(false);
    setPendingObstacleCoords(null);
  };

  const handleSubmit = async () => {
    if (!selectedPathId) {
      alert("Please select a path to report on");
      return;
    }

    await submitReportMutation.mutateAsync({
      pathId: selectedPathId,
      rating: rating > 0 ? rating : undefined,
      notes: notes.trim() || undefined,
      obstacles,
      segmentStatuses,
    });
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div>
        <h2 className="text-2xl font-bold">Report on Community Paths</h2>
        <p className="text-muted-foreground">
          Per RASD: Find and report on existing published community paths
        </p>
      </div>

      {/* Path Search */}
      <Card>
        <CardHeader>
          <CardTitle>Find a Path to Report On</CardTitle>
          <CardDescription>
            Search for published community paths by name or location
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 relative">
            <Label htmlFor="path-search">Search Paths</Label>
            <Input
              id="path-search"
              placeholder="Search for a published path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Autocomplete dropdown */}
            {searchQuery.length >= 2 && (
              <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto p-2">
                {paths && paths.length > 0 ? (
                  <>
                    {paths.map((path: any) => (
                      <button
                        key={path.id}
                        className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors mb-1"
                        onClick={() => {
                          setSelectedPathId(path.id);
                          setSearchQuery(""); // Clear search after selection
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {path.name}
                            </p>
                            {path.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {path.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="p-2 text-center">
                    <p className="text-sm text-muted-foreground">
                      No paths found matching "{searchQuery}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected path indicator */}
          {selectedPathId && !searchQuery && selectedPath && (
            <div className="rounded-lg border p-3 bg-green-50 border-green-200">
              <p className="text-sm font-medium text-green-900">
                Selected: {selectedPath.path.name}
              </p>
              <button
                onClick={() => {
                  setSelectedPathId(null);
                  setRating(0);
                  setNotes("");
                  setObstacles([]);
                  setSegmentStatuses({});
                  setEnableObstacleMarking(false);
                }}
                className="text-xs text-green-700 underline mt-1"
              >
                Clear selection
              </button>
            </div>
          )}

          <div className="rounded-lg border p-4 bg-blue-50 text-blue-900 text-sm">
            <p className="font-semibold mb-2">Note: Trip Recording</p>
            <p>
              To record a NEW trip, go to{" "}
              <button
                onClick={() => navigate({ to: "/trip-record" } as any)}
                className="underline font-medium"
              >
                /trip-record
              </button>
              . This page is only for reporting on existing community paths.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Report Form - Only shown when path is selected */}
      {selectedPathId && (
        <>
          {/* Path Rating */}
          <Card>
            <CardHeader>
              <CardTitle>Rate This Path</CardTitle>
              <CardDescription>
                Provide your experience with this path (1-5 stars)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Your Rating</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`${
                        star <= rating ? "text-yellow-500" : "text-gray-300"
                      }`}
                    >
                      <Star
                        className="h-8 w-8"
                        fill={star <= rating ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 text-sm">({rating}/5)</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating-notes">
                  Additional Notes (Optional)
                </Label>
                <Textarea
                  id="rating-notes"
                  placeholder="Describe your experience on this path..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Street Status Updates */}
          <Card>
            <CardHeader>
              <CardTitle>Update Street Status</CardTitle>
              <CardDescription>
                Report the current condition of streets in this path
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPath &&
              selectedPath.streets &&
              selectedPath.streets.length > 0 ? (
                <div className="space-y-2">
                  {selectedPath.streets.map((street: any) => (
                    <div
                      key={street.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card"
                    >
                      <Label className="font-medium flex-1">
                        {street.name}
                      </Label>
                      <Select
                        value={
                          segmentStatuses[street.id] ||
                          street.status ||
                          "optimal"
                        }
                        onValueChange={(value) =>
                          setSegmentStatuses({
                            ...segmentStatuses,
                            [street.id]: value as PathStatus,
                          })
                        }
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="optimal">Optimal</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="sufficient">Sufficient</SelectItem>
                          <SelectItem value="requires_maintenance">
                            Requires Maintenance
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border p-4 bg-amber-50 text-amber-900 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>
                      Select a path above to see its streets and update their
                      status.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Path Map with Obstacle Marking */}
          {selectedPath && selectedPath.path && selectedPath.path.geometry && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Path Map & Obstacles</CardTitle>
                    <CardDescription>
                      Click on the path to mark obstacles
                    </CardDescription>
                  </div>
                  <Button
                    variant={enableObstacleMarking ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEnableObstacleMarking(!enableObstacleMarking)}
                  >
                    {enableObstacleMarking ? "✓ Obstacle Mode ON" : "Mark Obstacles"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="h-96">
                <SequenceMap
                  paths={memoizedPaths}
                  enableObstacleMarking={enableObstacleMarking}
                  obstacles={memoizedObstacles}
                  onObstacleMarked={handleObstacleMarked}
                  onObstacleRemoved={(id) => {
                    setObstacles(obstacles.filter((o) => o.id !== id));
                  }}
                />
              </CardContent>
              {enableObstacleMarking && (
                <CardContent className="pt-0">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      <strong>Obstacle Mode Active:</strong> Click directly on the path to mark obstacles.
                      {obstacles.length > 0 && ` ${obstacles.length} obstacle(s) marked.`}
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Obstacle List */}
          {obstacles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Marked Obstacles ({obstacles.length})</CardTitle>
                <CardDescription>
                  Obstacles you've reported on this path
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {obstacles.map((obstacle, idx) => (
                  <div key={obstacle.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm capitalize">
                          {obstacle.type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {obstacle.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          ({obstacle.lat.toFixed(6)}, {obstacle.lon.toFixed(6)})
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setObstacles(obstacles.filter((_, i) => i !== idx));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
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
              isLoading={false}
            />
          )}

          {/* Submit Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={submitReportMutation.isPending}
              className="flex-1"
            >
              {submitReportMutation.isPending
                ? "Submitting..."
                : "Submit Report"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPathId(null);
                setSearchQuery("");
                setRating(0);
                setNotes("");
                setObstacles([]);
                setSegmentStatuses({});
                setEnableObstacleMarking(false);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
