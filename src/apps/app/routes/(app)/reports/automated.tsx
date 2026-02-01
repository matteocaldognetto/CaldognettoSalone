import { Button } from "@repo/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/(app)/reports/automated")({
  component: AutomatedReport,
});

interface Coordinate {
  lat: number;
  lng: number;
  timestamp: number;
}

interface Issue {
  type: string;
  location: Coordinate;
  confidence: number;
}

function AutomatedReport() {
  const [isRecording, setIsRecording] = useState(false);
  const [gpsTrack, setGpsTrack] = useState<Coordinate[]>([]);
  const [detectedIssues, setDetectedIssues] = useState<Issue[]>([]);

  // Simulated sensor data collection
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      // Collect GPS
      navigator.geolocation.getCurrentPosition((pos) => {
        setGpsTrack((prev) => [
          ...prev,
          {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: Date.now(),
          },
        ]);
      });

      // Simulate accelerometer (web limitation workaround)
      const mockAccel = simulateAccelerometer();
      if (detectPothole(mockAccel)) {
        setDetectedIssues((prev) => [
          ...prev,
          {
            type: "pothole",
            location: gpsTrack[gpsTrack.length - 1],
            confidence: 0.8,
          },
        ]);
      }
    }, 1000); // 1Hz sampling

    return () => clearInterval(interval);
  }, [isRecording]);

  return (
    <div>
      <h2>Automated Path Recording</h2>

      {!isRecording ? (
        <Button onClick={() => setIsRecording(true)}>Start Recording</Button>
      ) : (
        <>
          <Button onClick={() => setIsRecording(false)}>Stop Recording</Button>

          <div>
            <p>GPS Points: {gpsTrack.length}</p>
            <p>Issues Detected: {detectedIssues.length}</p>
          </div>

          {/* MapView component would go here */}
          <div className="border rounded p-4 my-4">
            <p className="text-sm text-muted-foreground">
              Map view would display {gpsTrack.length} GPS points and{" "}
              {detectedIssues.length} detected issues
            </p>
          </div>
        </>
      )}

      {detectedIssues.length > 0 && (
        <div className="mt-4">
          {/* ConfirmationFlow component would go here */}
          <p className="text-sm text-muted-foreground">
            Confirmation flow for {detectedIssues.length} detected issues
          </p>
          <Button
            onClick={() => {
              // Submit to createReport API
              console.log("Confirmed issues:", detectedIssues);
            }}
          >
            Confirm and Submit
          </Button>
        </div>
      )}
    </div>
  );
}

// Simulation helpers (web platform limitation)
function simulateAccelerometer() {
  // Mock sensor data - in real mobile app would use device sensors
  return {
    x: Math.random() * 0.5 - 0.25,
    y: Math.random() * 0.5 - 0.25,
    z: 9.8 + Math.random() * 2 - 1,
  };
}

function detectPothole(accel: { x: number; y: number; z: number }) {
  // Simple threshold-based detection
  const magnitude = Math.sqrt(
    accel.x ** 2 + accel.y ** 2 + (accel.z - 9.8) ** 2,
  );
  return magnitude > 2.0; // Threshold
}
