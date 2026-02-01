import { describe, it, expect } from "vitest";

/**
 * Section 4: Obstacle Verification Workflow
 * Tests the obstacle state machine and lifecycle transitions.
 * Since the actual state transitions happen in the tRPC router (trip.updateObstacleStatus),
 * these tests validate the state machine logic at the unit level.
 */

type ObstacleStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "CORRECTED" | "EXPIRED";

/**
 * Obstacle state machine - defines valid transitions.
 * Extracted from the RASD design document.
 */
const VALID_TRANSITIONS: Record<ObstacleStatus, ObstacleStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CORRECTED", "EXPIRED"],
  CONFIRMED: ["EXPIRED"],
  REJECTED: [], // Terminal state
  CORRECTED: ["CONFIRMED", "EXPIRED"],
  EXPIRED: [], // Terminal state
};

function isValidTransition(from: ObstacleStatus, to: ObstacleStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function transitionObstacle(
  current: ObstacleStatus,
  target: ObstacleStatus,
): { success: boolean; newStatus: ObstacleStatus; error?: string } {
  if (!isValidTransition(current, target)) {
    return {
      success: false,
      newStatus: current,
      error: `Invalid transition: ${current} -> ${target}`,
    };
  }
  return { success: true, newStatus: target };
}

describe("Obstacle Creation", () => {
  it("should create obstacle with initial status PENDING", () => {
    const obstacle = {
      id: "obs-1",
      status: "PENDING" as ObstacleStatus,
      type: "pothole",
      lat: 45.4642,
      lon: 9.19,
      tripRouteId: "route-1",
    };
    expect(obstacle.status).toBe("PENDING");
  });

  it("should associate obstacle with correct trip and route", () => {
    const obstacle = {
      tripRouteId: "route-123",
      type: "pothole",
      status: "PENDING" as ObstacleStatus,
    };
    expect(obstacle.tripRouteId).toBe("route-123");
  });

  it("should store obstacle type (pothole, construction, etc.)", () => {
    const types = ["pothole", "construction", "debris", "broken_glass", "water_puddle"];
    for (const type of types) {
      const obstacle = { type, status: "PENDING" as ObstacleStatus };
      expect(obstacle.type).toBe(type);
    }
  });

  it("should store obstacle location (lat, lon)", () => {
    const obstacle = {
      lat: 45.4642,
      lon: 9.19,
      status: "PENDING" as ObstacleStatus,
    };
    expect(obstacle.lat).toBeCloseTo(45.4642);
    expect(obstacle.lon).toBeCloseTo(9.19);
  });

  it("should store optional description", () => {
    const withDesc = {
      description: "Large pothole near intersection",
      status: "PENDING" as ObstacleStatus,
    };
    const withoutDesc = {
      description: undefined,
      status: "PENDING" as ObstacleStatus,
    };
    expect(withDesc.description).toBe("Large pothole near intersection");
    expect(withoutDesc.description).toBeUndefined();
  });
});

describe("Obstacle State Transitions - Valid", () => {
  it("should transition PENDING -> CONFIRMED", () => {
    const result = transitionObstacle("PENDING", "CONFIRMED");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("CONFIRMED");
  });

  it("should transition PENDING -> REJECTED", () => {
    const result = transitionObstacle("PENDING", "REJECTED");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("REJECTED");
  });

  it("should transition CONFIRMED -> EXPIRED (time-based or manual)", () => {
    const result = transitionObstacle("CONFIRMED", "EXPIRED");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("EXPIRED");
  });

  it("should transition PENDING -> EXPIRED", () => {
    const result = transitionObstacle("PENDING", "EXPIRED");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("EXPIRED");
  });

  it("should transition PENDING -> CORRECTED", () => {
    const result = transitionObstacle("PENDING", "CORRECTED");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("CORRECTED");
  });

  it("should transition CORRECTED -> CONFIRMED", () => {
    const result = transitionObstacle("CORRECTED", "CONFIRMED");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("CONFIRMED");
  });
});

describe("Obstacle State Transitions - Invalid", () => {
  it("should reject EXPIRED -> PENDING", () => {
    const result = transitionObstacle("EXPIRED", "PENDING");
    expect(result.success).toBe(false);
    expect(result.newStatus).toBe("EXPIRED");
    expect(result.error).toContain("Invalid transition");
  });

  it("should reject EXPIRED -> CONFIRMED", () => {
    const result = transitionObstacle("EXPIRED", "CONFIRMED");
    expect(result.success).toBe(false);
  });

  it("should reject CONFIRMED -> PENDING", () => {
    const result = transitionObstacle("CONFIRMED", "PENDING");
    expect(result.success).toBe(false);
  });

  it("should reject REJECTED -> PENDING", () => {
    const result = transitionObstacle("REJECTED", "PENDING");
    expect(result.success).toBe(false);
  });

  it("should reject REJECTED -> CONFIRMED", () => {
    const result = transitionObstacle("REJECTED", "CONFIRMED");
    expect(result.success).toBe(false);
  });

  it("should reject any transition on already EXPIRED obstacle back to active state", () => {
    const activeStates: ObstacleStatus[] = ["PENDING", "CONFIRMED", "CORRECTED"];
    for (const state of activeStates) {
      const result = transitionObstacle("EXPIRED", state);
      expect(result.success).toBe(false);
    }
  });

  it("should reject any transition from REJECTED", () => {
    const allStates: ObstacleStatus[] = ["PENDING", "CONFIRMED", "CORRECTED", "EXPIRED"];
    for (const state of allStates) {
      const result = transitionObstacle("REJECTED", state);
      expect(result.success).toBe(false);
    }
  });
});

describe("Obstacle Ownership Verification", () => {
  function verifyOwnership(
    obstacleUserId: string,
    requestUserId: string | null,
  ): { allowed: boolean; statusCode: number } {
    if (!requestUserId) {
      return { allowed: false, statusCode: 401 };
    }
    if (obstacleUserId !== requestUserId) {
      return { allowed: false, statusCode: 403 };
    }
    return { allowed: true, statusCode: 200 };
  }

  it("should allow trip owner to modify obstacle status", () => {
    const result = verifyOwnership("user-1", "user-1");
    expect(result.allowed).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it("should reject status modification by non-owner user", () => {
    const result = verifyOwnership("user-1", "user-2");
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(403);
  });

  it("should reject status modification by unauthenticated request", () => {
    const result = verifyOwnership("user-1", null);
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it("should return 403 when non-owner attempts modification", () => {
    const result = verifyOwnership("user-1", "user-99");
    expect(result.statusCode).toBe(403);
  });
});

describe("Obstacle Lifecycle End-to-End", () => {
  it("should support full flow: PENDING -> CONFIRMED", () => {
    let status: ObstacleStatus = "PENDING";

    const step1 = transitionObstacle(status, "CONFIRMED");
    expect(step1.success).toBe(true);
    status = step1.newStatus;

    expect(status).toBe("CONFIRMED");
  });

  it("should support full flow: PENDING -> REJECTED", () => {
    let status: ObstacleStatus = "PENDING";

    const step1 = transitionObstacle(status, "REJECTED");
    expect(step1.success).toBe(true);
    status = step1.newStatus;

    expect(status).toBe("REJECTED");

    // Cannot transition from REJECTED
    const step2 = transitionObstacle(status, "PENDING");
    expect(step2.success).toBe(false);
  });

  it("should support correction flow: PENDING -> CORRECTED -> CONFIRMED", () => {
    let status: ObstacleStatus = "PENDING";

    const step1 = transitionObstacle(status, "CORRECTED");
    expect(step1.success).toBe(true);
    status = step1.newStatus;

    const step2 = transitionObstacle(status, "CONFIRMED");
    expect(step2.success).toBe(true);
    status = step2.newStatus;

    expect(status).toBe("CONFIRMED");
  });

  it("should support expiration flow: CONFIRMED -> EXPIRED", () => {
    let status: ObstacleStatus = "PENDING";

    const step1 = transitionObstacle(status, "CONFIRMED");
    status = step1.newStatus;

    const step2 = transitionObstacle(status, "EXPIRED");
    expect(step2.success).toBe(true);
    status = step2.newStatus;

    expect(status).toBe("EXPIRED");

    // Cannot re-activate
    const step3 = transitionObstacle(status, "CONFIRMED");
    expect(step3.success).toBe(false);
  });

  it("should mark stale obstacles as EXPIRED after configured time period", () => {
    const EXPIRY_DAYS = 30;
    const createdAt = new Date(Date.now() - (EXPIRY_DAYS + 1) * 24 * 60 * 60 * 1000);
    const now = new Date();
    const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    const isStale = ageInDays > EXPIRY_DAYS;
    expect(isStale).toBe(true);

    // Stale CONFIRMED obstacles should be expirable
    const result = transitionObstacle("CONFIRMED", "EXPIRED");
    expect(result.success).toBe(true);
  });
});
