import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import { useState } from "react";

interface ObstacleDialogProps {
  open: boolean;
  lat: number;
  lon: number;
  onSave: (data: {
    type: string;
    description: string;
    lat: number;
    lon: number;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ObstacleDialog({
  open,
  lat,
  lon,
  onSave,
  onCancel,
  isLoading = false,
}: ObstacleDialogProps) {
  const [type, setType] = useState("pothole");
  const [description, setDescription] = useState("");

  const handleSave = () => {
    onSave({
      type,
      description,
      lat,
      lon,
    });
    // Reset form
    setType("pothole");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[425px] z-[9999]">
        <DialogHeader>
          <DialogTitle>Report Obstacle</DialogTitle>
          <DialogDescription>
            Add details about the obstacle at ({lat.toFixed(4)}, {lon.toFixed(4)})
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="obstacle-type">Obstacle Type *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="obstacle-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10000]">
                <SelectItem value="pothole">Pothole</SelectItem>
                <SelectItem value="debris">Debris</SelectItem>
                <SelectItem value="construction">Construction</SelectItem>
                <SelectItem value="damaged_surface">Damaged Surface</SelectItem>
                <SelectItem value="broken_pavement">Broken Pavement</SelectItem>
                <SelectItem value="tree_branch">Tree Branch</SelectItem>
                <SelectItem value="water_puddle">Water Puddle</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="obstacle-description">Description (Optional)</Label>
            <Textarea
              id="obstacle-description"
              placeholder="Describe the obstacle in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded">
            <div>
              <p className="text-gray-600 text-xs">Latitude</p>
              <p className="font-mono">{lat.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs">Longitude</p>
              <p className="font-mono">{lon.toFixed(6)}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Saving..." : "Save Obstacle"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
