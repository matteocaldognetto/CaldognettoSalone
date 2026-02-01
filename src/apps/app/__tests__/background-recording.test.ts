import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * MOCK IMPLEMENTATION of TripRecorder
 * Represents the logic that would be inside your React component or hook.
 * This class isolates the logic so it can be unit tested without the UI.
 */
class TripRecorder {
  private isRecording = false;
  private positions: Array<{ lat: number; lon: number; timestamp: number }> = [];
  private watchId: number | null = null;

  start() {
    this.isRecording = true;
    
    // Subscribe to geolocation updates
    // In a real app, this continues running even if the tab is hidden (in most modern browsers),
    // but some might throttle it.
    // Critical for R17: We do NOT check document.visibilityState here to pause.
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!this.isRecording) return;
        
        // Simulating the logic: "Keep recording regardless of visibility"
        // If we had logic like "if (document.hidden) return;", the test would fail.
        this.positions.push({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          timestamp: position.timestamp,
        });
      },
      (error) => console.error(error),
      { enableHighAccuracy: true }
    );
  }

  stop() {
    this.isRecording = false;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  }

  getPositions() {
    return this.positions;
  }
}

/**
 * UNIT TEST for R17: Background Recording
 */
describe('R17: Background Recording Logic', () => {
  let recorder: TripRecorder;

  beforeEach(() => {
    // Mock navigator.geolocation
    const mockGeolocation = {
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn(),
    };
    
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });

    recorder = new TripRecorder();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should continue processing location updates when document is hidden', () => {
    // 1. Start recording
    recorder.start();
    
    // Get the callback passed to watchPosition
    const watchPositionMock = navigator.geolocation.watchPosition as unknown as ReturnType<typeof vi.fn>;
    const successCallback = watchPositionMock.mock.calls[0][0];

    // 2. Simulate User switching apps (Visibility -> Hidden)
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    });
    
    // Dispatch visibilitychange event (optional, if the class listens to it)
    document.dispatchEvent(new Event('visibilitychange'));

    // 3. Simulate incoming GPS location while hidden
    const backgroundLocation = {
      coords: { latitude: 45.4642, longitude: 9.1900 },
      timestamp: Date.now(),
    };
    
    // Invoke the callback manually (simulating the browser sending an event)
    successCallback(backgroundLocation);

    // 4. Verification
    const recorded = recorder.getPositions();
    
    // Expected: The point should be recorded
    expect(recorded).toHaveLength(1);
    expect(recorded[0].lat).toBe(45.4642);
    
    // This proves the logic doesn't explicitly block background updates
  });
});
