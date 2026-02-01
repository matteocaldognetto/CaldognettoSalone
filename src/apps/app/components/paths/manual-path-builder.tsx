/**
 * Manual Path Builder Component
 * Allows users to interactively build a path by adding streets one-by-one
 * Shows visual progress and path composition
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
import { useState } from "react";
import { Plus, Trash2, MapPin, Edit2, ChevronRight } from "lucide-react";
import { TripReviewScreen, type TripData } from "../trips/trip-review-screen";
import { api } from "../../lib/trpc";

interface ManualPathBuilderProps {
  onSuccess?: () => void;
}

interface PathStreetItem {
  id: string;
  name: string;
  city?: string;
  status: "optimal" | "medium" | "sufficient" | "requires_maintenance";
  obstacles: string[];
  travelTimeMinutes: number;
  orderIndex: number;
  geometry?: {
    type: "LineString";
    coordinates: Array<[number, number]>;
  };
}

type BuilderStep = "start" | "mode" | "address" | "building" | "review";
type InputMode = "streets" | "addresses";

export function ManualPathBuilder({ onSuccess }: ManualPathBuilderProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<BuilderStep>("start");
  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [pathName, setPathName] = useState("");
  const [pathDescription, setPathDescription] = useState("");
  const [streets, setStreets] = useState<PathStreetItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingStreet, setEditingStreet] = useState<PathStreetItem | null>(null);
  const [obstacleInput, setObstacleInput] = useState("");
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [foundRoutes, setFoundRoutes] = useState<any[]>([]);
  const [searchingRoutes, setSearchingRoutes] = useState(false);

  // Search for streets
  const { data: searchResults = [] } = useQuery({
    queryKey: ["street", "search", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const response = await fetch(
        `/api/trpc/street.search?input=${JSON.stringify({ query: searchQuery, limit: 10 })}`
      );
      if (!response.ok) throw new Error("Failed to search streets");
      return response.json();
    },
    enabled: searchQuery.length > 1,
  } as any);

  // Create path mutation
  const createPath = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      streetIds: string[];
      geometry?: any;
    }) => {
      const response = await fetch("/api/trpc/path.createManualPath", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ input: data }),
      });
      if (!response.ok) throw new Error("Failed to create path");
      const result = await response.json();
      return result[0]?.result?.data || result;
    },
  });

  // Create street reports mutation
  const createStreetReports = useMutation({
    mutationFn: async (data: {
      streetId: string;
      status: string;
      collectionMode: string;
      obstacles: any[];
      isPublishable: boolean;
    }) => {
      const response = await fetch("/api/trpc/street.createReport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ input: data }),
      });
      if (!response.ok) throw new Error("Failed to create report");
      const result = await response.json();
      return result[0]?.result?.data || result;
    },
  });

  const resetForm = () => {
    setStep("start");
    setInputMode(null);
    setPathName("");
    setPathDescription("");
    setStreets([]);
    setSearchQuery("");
    setEditingIndex(null);
    setEditingStreet(null);
    setObstacleInput("");
    setStartAddress("");
    setEndAddress("");
    setFoundRoutes([]);
  };

  const searchRoutesByAddress = async () => {
    if (!startAddress || !endAddress) {
      alert("Please enter both start and end addresses");
      return;
    }

    setSearchingRoutes(true);
    try {
      const queryParams = new URLSearchParams({
        input: JSON.stringify({ startAddress, endAddress }),
      });

      const res = await fetch(
        `/api/trpc/routing.findRoutesByAddress?${queryParams}`,
        {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error("Failed to search routes");
      const result = await res.json();

      if (result[0]?.result?.data) {
        const data = result[0].result.data;
        if (data.routes && data.routes.length > 0) {
          setFoundRoutes(data.routes);
        } else {
          alert("No routes found between these addresses");
        }
      }
    } catch (error) {
      console.error("Error searching routes:", error);
      alert("Failed to search routes");
    } finally {
      setSearchingRoutes(false);
    }
  };

  // Combine multiple LineString geometries into one
  const combineGeometries = (
    streets: PathStreetItem[]
  ): {
    type: "LineString";
    coordinates: Array<[number, number]>;
  } | null => {
    const coordinates: Array<[number, number]> = [];

    for (const street of streets) {
      if (street.geometry?.type === "LineString") {
        const streetCoords = street.geometry.coordinates;
        if (coordinates.length === 0) {
          // Add all coordinates from first street
          coordinates.push(...streetCoords);
        } else {
          // For subsequent streets, skip the first coordinate (it should be the last of previous)
          // to avoid duplicates
          coordinates.push(...streetCoords.slice(1));
        }
      }
    }

    if (coordinates.length === 0) {
      // Fallback if no geometries available
      return null;
    }

    return {
      type: "LineString" as const,
      coordinates: coordinates,
    };
  };

  const selectRouteAsStreets = (route: any) => {
    if (!route.streets || route.streets.length === 0) {
      // If no streets, create a single street from the route geometry
      const newStreet: PathStreetItem = {
        id: route.id,
        name: route.name,
        city: "Route",
        status: "medium",
        obstacles: [],
        travelTimeMinutes: route.travelTimeMinutes || 30,
        orderIndex: 0,
        geometry: route.geometry, // Use route's geometry
      };
      setStreets([newStreet]);
    } else {
      // Populate streets from the route
      const routeStreets: PathStreetItem[] = route.streets.map(
        (street: any, idx: number) => ({
          id: street.id || `street-${idx}`,
          name: street.name || `Street ${idx + 1}`,
          city: street.city,
          status: "medium" as const,
          obstacles: [],
          travelTimeMinutes: street.travelTimeMinutes || 5,
          orderIndex: idx,
          geometry: street.geometry, // Include street geometry if available
        })
      );
      setStreets(routeStreets);
    }

    // Move to building step
    setFoundRoutes([]);
    setStep("building");
  };

  const handleAddStreet = (street: any) => {
    if (streets.some((s) => s.id === street.id)) {
      alert("Street already added to this path");
      return;
    }

    const newStreet: PathStreetItem = {
      id: street.id,
      name: street.name,
      city: street.city,
      status: "medium",
      obstacles: [],
      travelTimeMinutes: 10,
      orderIndex: streets.length,
      geometry: street.geometry, // Include geometry from Nominatim search result
    };

    setStreets([...streets, newStreet]);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleEditStreet = (index: number) => {
    setEditingIndex(index);
    setEditingStreet({ ...streets[index] });
    setObstacleInput("");
  };

  const handleSaveStreetEdit = () => {
    if (editingStreet !== null && editingIndex !== null) {
      const updated = [...streets];
      updated[editingIndex] = editingStreet;
      setStreets(updated);
      setEditingIndex(null);
      setEditingStreet(null);
    }
  };

  const handleRemoveStreet = (index: number) => {
    const updated = streets.filter((_, i) => i !== index);
    // Update order indices
    updated.forEach((street, i) => {
      street.orderIndex = i;
    });
    setStreets(updated);
    if (updated.length === 0) {
      setStep("start");
    }
  };

  const handleAddObstacle = () => {
    if (editingStreet && obstacleInput.trim()) {
      setEditingStreet({
        ...editingStreet,
        obstacles: [...editingStreet.obstacles, obstacleInput.trim()],
      });
      setObstacleInput("");
    }
  };

  const handleRemoveObstacle = (idx: number) => {
    if (editingStreet) {
      setEditingStreet({
        ...editingStreet,
        obstacles: editingStreet.obstacles.filter((_, i) => i !== idx),
      });
    }
  };

  // Calculate path statistics
  const pathStats = {
    totalDistance: streets.reduce((sum, s) => sum + (s.travelTimeMinutes / 60) * 15, 0), // Estimate km from time
    totalTime: streets.reduce((sum, s) => sum + s.travelTimeMinutes, 0),
    avgStatus: streets.length > 0
      ? streets.reduce((sum, s) => {
          const statusMap: Record<string, number> = { optimal: 4, medium: 3, sufficient: 2, requires_maintenance: 1 };
          return sum + statusMap[s.status];
        }, 0) / streets.length
      : 0,
  };

  const avgStatusLabel =
    pathStats.avgStatus >= 3.5
      ? "optimal"
      : pathStats.avgStatus >= 2.5
        ? "medium"
        : pathStats.avgStatus >= 1.5
          ? "sufficient"
          : "requires_maintenance";

  // Compute combined geometry from streets
  const pathGeometry: {
    type: "LineString";
    coordinates: Array<[number, number]>;
  } = combineGeometries(streets) || {
    type: "LineString" as const,
    coordinates: streets.map((_, i) => [9.19 + i * 0.01, 45.4642]), // Fallback dummy if no geometries
  };

  // For review screen
  const tripDataForReview: TripData = {
    pathName: pathName || "Unnamed Path",
    distance: parseFloat(pathStats.totalDistance.toFixed(2)),
    duration: pathStats.totalTime,
    avgSpeed: pathStats.totalDistance > 0 ? parseFloat(((pathStats.totalDistance / pathStats.totalTime) * 60).toFixed(1)) : 0,
    startTime: new Date(),
    endTime: new Date(Date.now() + pathStats.totalTime * 60 * 1000),
    pathStatus: avgStatusLabel as any,
    obstacles: streets.flatMap((street, idx) =>
      street.obstacles.map((obs, i) => ({
        id: `${idx}-${i}`,
        location: `On ${street.name}`,
        type: obs,
        confirmed: false,
      }))
    ),
    geometry: pathGeometry,
    collectionMode: "manual",
  };

  if (step === "review") {
    const handlePublishOrSave = async (
      publishData: {
        name: string;
        isPublished: boolean;
        obstacles: Array<{ location: string; description: string }>;
      },
      isPublished: boolean
    ) => {
      try {
        // Create the path with combined geometry
        const path = await createPath.mutateAsync({
          name: publishData.name,
          description: pathDescription,
          streetIds: streets.map((s) => s.id),
          geometry: pathGeometry, // Include combined geometry from streets
        });

        // Create street-level reports for each street with its status and obstacles
        for (const street of streets) {
          // Find obstacles for this street
          const streetObstacles = publishData.obstacles.filter(
            (obs) => obs.location.includes(street.name)
          );

          // Create report for this street
          await createStreetReports.mutateAsync({
            streetId: street.id,
            status: street.status,
            collectionMode: "manual",
            obstacles: streetObstacles.map((obs) => ({
              type: obs.description,
              location: obs.location,
            })),
            isPublishable: isPublished,
          });
        }

        queryClient.invalidateQueries({ queryKey: ["path"] });
        queryClient.invalidateQueries({ queryKey: ["street"] });

        if (onSuccess) onSuccess();
        resetForm();
      } catch (error) {
        console.error("Failed to publish path:", error);
        alert("Failed to publish path. Please try again.");
      }
    };

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Review Your Manual Path</CardTitle>
            <CardDescription>
              Built from {streets.length} street{streets.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TripReviewScreen
              trip={tripDataForReview}
              onPublish={(publishData) =>
                handlePublishOrSave(publishData, true)
              }
              onSave={(saveData) => handlePublishOrSave(saveData, false)}
              onDelete={() => setStep("building")}
              isSubmitting={createPath.isPending || createStreetReports.isPending}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Build Your Path</h3>
        <p className="text-sm text-muted-foreground">
          Add streets one-by-one to create your custom cycling path
        </p>
      </div>

      {/* Path Info (if building) */}
      {step === "building" && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Estimated Distance</p>
                <p className="text-lg font-semibold">{pathStats.totalDistance.toFixed(1)} km</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Time</p>
                <p className="text-lg font-semibold">{pathStats.totalTime} min</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average Status</p>
                <p className="text-lg font-semibold capitalize">{avgStatusLabel}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Path Info */}
      {step === "start" && (
        <Card>
          <CardHeader>
            <CardTitle>Start Your Path</CardTitle>
            <CardDescription>Give your path a name and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="path-name">Path Name *</Label>
              <Input
                id="path-name"
                value={pathName}
                onChange={(e) => setPathName(e.target.value)}
                placeholder="e.g., Downtown to Central Park Loop"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="path-desc">Description (optional)</Label>
              <Textarea
                id="path-desc"
                value={pathDescription}
                onChange={(e) => setPathDescription(e.target.value)}
                placeholder="Describe this path, difficulty level, scenic highlights..."
                rows={3}
              />
            </div>

            <Button
              onClick={() => setStep("mode")}
              disabled={!pathName.trim()}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Next
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1b: Choose Input Mode */}
      {step === "mode" && (
        <Card>
          <CardHeader>
            <CardTitle>How do you want to build this path?</CardTitle>
            <CardDescription>
              Choose between searching for streets or entering addresses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              onClick={() => {
                setInputMode("streets");
                setStep("building");
              }}
              className="w-full justify-start h-auto py-3"
            >
              <div className="text-left">
                <div className="font-medium">Search & Build Streets</div>
                <div className="text-xs text-muted-foreground">
                  Manually add streets one-by-one
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setInputMode("addresses");
                setStep("address");
              }}
              className="w-full justify-start h-auto py-3"
            >
              <div className="text-left">
                <div className="font-medium">Enter Addresses</div>
                <div className="text-xs text-muted-foreground">
                  Find route between start and end address
                </div>
              </div>
            </Button>

            <Button
              variant="ghost"
              onClick={() => setStep("start")}
              className="w-full"
            >
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1c: Address Input */}
      {step === "address" && (
        <Card>
          <CardHeader>
            <CardTitle>Find Route by Address</CardTitle>
            <CardDescription>
              Enter start and end addresses to find available routes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="start-address">Start Address *</Label>
              <Input
                id="start-address"
                value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
                placeholder="e.g., Central Park, Milan"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="end-address">End Address *</Label>
              <Input
                id="end-address"
                value={endAddress}
                onChange={(e) => setEndAddress(e.target.value)}
                placeholder="e.g., Navigli District, Milan"
              />
            </div>

            {foundRoutes.length > 0 && (
              <div className="space-y-2">
                <Label>Found Routes ({foundRoutes.length})</Label>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {foundRoutes.map((route: any) => (
                    <Button
                      key={route.id}
                      variant="outline"
                      onClick={() => selectRouteAsStreets(route)}
                      className="w-full justify-between h-auto py-3"
                    >
                      <div className="text-left">
                        <div className="font-medium">{route.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {route.distance.toFixed(1)} km • {route.travelTimeMinutes} min •{" "}
                          {route.streetCount || 1} streets
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={searchRoutesByAddress}
                disabled={!startAddress || !endAddress || searchingRoutes}
                className="flex-1"
              >
                {searchingRoutes ? "Searching..." : "Search Routes"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep("mode")}
                className="flex-1"
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Building (Search and Add) */}
      {step === "building" && (
        <>
          {/* Path Name Display */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <div>
                  <CardTitle className="text-lg">{pathName}</CardTitle>
                  {pathDescription && (
                    <CardDescription>{pathDescription}</CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Street Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Streets to Your Path</CardTitle>
              <CardDescription>
                {streets.length === 0
                  ? "Search for the first street..."
                  : `${streets.length} street${streets.length !== 1 ? "s" : ""} added. Search to add more.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Label htmlFor="street-search" className="text-xs mb-1 block">
                  Search Streets
                </Label>
                <Input
                  id="street-search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(e.target.value.length > 1);
                  }}
                  onFocus={() => searchQuery.length > 1 && setShowDropdown(true)}
                  placeholder="Type street name (min 2 characters)..."
                />

                {showDropdown && (searchResults as any[]).length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-white shadow-lg z-50 max-h-48 overflow-auto">
                    {(searchResults as any[]).map((street: any) => (
                      <button
                        key={street.id}
                        type="button"
                        onClick={() => handleAddStreet(street)}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-sm">{street.name}</div>
                        {street.city && (
                          <div className="text-xs text-gray-500">{street.city}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {searchQuery.length > 0 && (searchResults as any[]).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No streets found. Try a different search term.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Streets List */}
          {streets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Path Composition ({streets.length})
                </CardTitle>
                <CardDescription>Click Edit to set status and add obstacles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {streets.map((street, index) => (
                  <div
                    key={`${street.id}-${index}`}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50"
                  >
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{street.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="capitalize bg-white px-2 py-0.5 rounded">
                          {street.status}
                        </span>
                        <span className="bg-white px-2 py-0.5 rounded">
                          {street.travelTimeMinutes}m
                        </span>
                        {street.obstacles.length > 0 && (
                          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                            {street.obstacles.length} issue{street.obstacles.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {index < streets.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditStreet(index)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveStreet(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Street Editor Modal */}
          {editingStreet !== null && editingIndex !== null && (
            <Card className="border-blue-300 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-base">
                  Edit: {editingStreet.name}
                </CardTitle>
                <CardDescription>
                  Street #{editingIndex + 1} - Set condition and report issues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="grid gap-2">
                  <Label>Condition</Label>
                  <Select
                    value={editingStreet.status}
                    onValueChange={(value) =>
                      setEditingStreet({
                        ...editingStreet,
                        status: value as any,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="optimal">Optimal</SelectItem>
                      <SelectItem value="medium">Good</SelectItem>
                      <SelectItem value="sufficient">Fair</SelectItem>
                      <SelectItem value="requires_maintenance">Needs Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Travel Time */}
                <div className="grid gap-2">
                  <Label>Travel Time (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editingStreet.travelTimeMinutes}
                    onChange={(e) =>
                      setEditingStreet({
                        ...editingStreet,
                        travelTimeMinutes: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                {/* Obstacles */}
                <div className="grid gap-2">
                  <Label>Reported Issues</Label>
                  <div className="space-y-2 max-h-24 overflow-y-auto">
                    {editingStreet.obstacles.map((obstacle, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 bg-white rounded border text-sm"
                      >
                        <span className="flex-1">{obstacle}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveObstacle(i)}
                          className="text-red-600 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="E.g., pothole, gravel, water"
                      value={obstacleInput}
                      onChange={(e) => setObstacleInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleAddObstacle()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddObstacle}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveStreetEdit} size="sm" className="flex-1">
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingIndex(null);
                      setEditingStreet(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setStep("review")}
              disabled={streets.length === 0}
              className="flex-1"
            >
              Review Path
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
            >
              Start Over
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
