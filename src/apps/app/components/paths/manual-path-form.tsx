import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/trpc";
import { Edit2, Plus } from "lucide-react";

interface ManualPathFormProps {
  onSuccess?: () => void;
}

interface StreetOption {
  id: string;
  name: string;
  city?: string;
  status?: string;
  obstacles?: string[];
  travelTimeMinutes?: number;
}

interface StreetWithDetails extends StreetOption {
  status: "optimal" | "medium" | "sufficient" | "requires_maintenance";
  obstacles: string[];
  travelTimeMinutes: number;
}

export function ManualPathForm({ onSuccess }: ManualPathFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStreets, setSelectedStreets] = useState<StreetWithDetails[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingStreet, setEditingStreet] = useState<StreetWithDetails | null>(null);

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
    enabled: searchQuery.length > 0,
  } as any);

  const createPath = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      streetIds: string[];
    }) => {
      const response = await fetch("/api/trpc/path.createManualPath", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ input: data }),
      });
      if (!response.ok) throw new Error("Failed to create path");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["path"],
      });
      if (onSuccess) onSuccess();
      // Reset form
      setName("");
      setDescription("");
      setSearchQuery("");
      setSelectedStreets([]);
      setShowDropdown(false);
    },
  } as any);

  const handleSelectStreet = (street: any) => {
    // Avoid duplicates
    if (!selectedStreets.some((s) => s.id === street.id)) {
      const streetWithDetails: StreetWithDetails = {
        id: street.id,
        name: street.name,
        city: street.city,
        status: "medium",
        obstacles: [],
        travelTimeMinutes: 10,
      };
      setSelectedStreets([...selectedStreets, streetWithDetails]);
    }
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleEditStreet = (index: number) => {
    setEditingIndex(index);
    setEditingStreet({ ...selectedStreets[index] });
  };

  const handleSaveStreetEdits = () => {
    if (editingStreet !== null && editingIndex !== null) {
      const updated = [...selectedStreets];
      updated[editingIndex] = editingStreet;
      setSelectedStreets(updated);
      setEditingIndex(null);
      setEditingStreet(null);
    }
  };

  const handleAddObstacle = (text: string) => {
    if (editingStreet && text.trim()) {
      setEditingStreet({
        ...editingStreet,
        obstacles: [...editingStreet.obstacles, text.trim()],
      });
    }
  };

  const handleRemoveStreet = (index: number) => {
    setSelectedStreets(selectedStreets.filter((_, i) => i !== index));
  };

  const handleMoveStreet = (fromIndex: number, toIndex: number) => {
    const newStreets = [...selectedStreets];
    const [moved] = newStreets.splice(fromIndex, 1);
    newStreets.splice(toIndex, 0, moved);
    setSelectedStreets(newStreets);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      handleMoveStreet(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a path name");
      return;
    }

    if (selectedStreets.length === 0) {
      alert("Please select at least one street");
      return;
    }

    createPath.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        streetIds: selectedStreets.map((s) => s.id),
      } as any
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Path Name */}
      <div className="grid gap-2">
        <Label htmlFor="path-name">Path Name *</Label>
        <Input
          id="path-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Downtown to Park"
          required
        />
      </div>

      {/* Description */}
      <div className="grid gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this path..."
        />
      </div>

      {/* Street Search and Selection */}
      <div className="grid gap-2">
        <Label htmlFor="street-search">Add Streets *</Label>
        <div className="relative">
          <Input
            id="street-search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(e.target.value.length > 0);
            }}
            onFocus={() => searchQuery.length > 0 && setShowDropdown(true)}
            placeholder="Search streets by name..."
          />

          {/* Dropdown with search results */}
          {showDropdown && (searchResults as any[]).length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-white shadow-lg z-50 max-h-48 overflow-auto">
              {(searchResults as any[]).map((street: any) => (
                <button
                  key={street.id}
                  type="button"
                  onClick={() =>
                    handleSelectStreet({
                      id: street.id,
                      name: street.name,
                      city: street.city,
                    })
                  }
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0"
                >
                  <div className="font-medium">{street.name}</div>
                  {street.city && (
                    <div className="text-sm text-gray-500">{street.city}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Streets List */}
      {selectedStreets.length > 0 && (
        <div className="grid gap-2">
          <Label>Selected Streets (drag to reorder, click to edit)</Label>
          <div className="space-y-2 border rounded-md p-3 bg-gray-50">
            {selectedStreets.map((street, index) => (
              <div
                key={`${street.id}-${index}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-2 p-3 bg-white border rounded-md hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-400 text-lg cursor-move">⋮⋮</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{index + 1}.</span>
                    <span className="font-medium truncate">{street.name}</span>
                    {street.city && (
                      <span className="text-gray-500 text-sm">({street.city})</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-x-3">
                    <span>Status: {street.status}</span>
                    <span>Time: {street.travelTimeMinutes}m</span>
                    {street.obstacles.length > 0 && (
                      <span className="text-orange-600">Issues: {street.obstacles.length}</span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditStreet(index)}
                  className="flex items-center gap-1"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
                <button
                  type="button"
                  onClick={() => handleRemoveStreet(index)}
                  className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors text-lg"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600">
            {selectedStreets.length} street{selectedStreets.length !== 1 ? "s" : ""} selected
          </p>
        </div>
      )}

      {/* Street Editor Modal */}
      {editingStreet !== null && editingIndex !== null && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base">Edit: {editingStreet.name}</CardTitle>
            <CardDescription>Set status and report any issues on this street</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Selector */}
            <div className="grid gap-2">
              <Label htmlFor="street-status">Street Condition</Label>
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
              <Label htmlFor="travel-time">Travel Time (minutes)</Label>
              <Input
                id="travel-time"
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
              <div className="space-y-2">
                {editingStreet.obstacles.map((obstacle, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 bg-white rounded border text-sm"
                  >
                    <span className="flex-1">{obstacle}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingStreet({
                          ...editingStreet,
                          obstacles: editingStreet.obstacles.filter((_, idx) => idx !== i),
                        })
                      }
                      className="text-red-600 hover:text-red-700 text-lg"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add issue (e.g., pothole, gravel, water)"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddObstacle((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                    if (input) {
                      handleAddObstacle(input.value);
                      input.value = "";
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveStreetEdits} size="sm">
                Save Changes
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
        <Button type="submit" disabled={createPath.isPending}>
          {createPath.isPending ? "Creating..." : "Create Path"}
        </Button>
        {onSuccess && (
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
        )}
      </div>

      {/* Error Message */}
      {createPath.isError && (
        <p className="text-sm text-red-600">
          Failed to create path. Please try again.
        </p>
      )}

      {/* Success Message */}
      {createPath.isSuccess && (
        <p className="text-sm text-green-600">
          Path created successfully!
        </p>
      )}
    </form>
  );
}
