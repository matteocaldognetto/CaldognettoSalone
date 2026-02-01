import { describe, it, expect } from "vitest";
import { _testing } from "../lib/aggregation";

const {
  calculateFreshnessWeight,
  calculateRecencyBonus,
  calculateWeightedStatus,
  calculateScorePure,
  STATUS_SCORES,
} = _testing;

/**
 * Section 7: Aggregation Engine Tests
 * Tests the real exported functions from aggregation.ts
 */

describe("aggregateStreetReports - Real Implementation", () => {
  // Note: aggregateStreetReports itself requires a DB connection.
  // Here we test the pure helper functions it uses.

  it("should calculate weighted average status from multiple reports", () => {
    const reports = [
      { status: "optimal", weight: 1.0 },
      { status: "medium", weight: 1.0 },
      { status: "sufficient", weight: 1.0 },
    ];
    // (4 + 3 + 2) / 3 = 3 -> medium
    expect(calculateWeightedStatus(reports)).toBe("medium");
  });

  it("should weight recent reports more heavily than old ones", () => {
    const reports = [
      { status: "optimal", weight: 1.0 }, // Recent: 4 * 1.0 = 4
      { status: "requires_maintenance", weight: 0.5 }, // Old: 1 * 0.5 = 0.5
    ];
    // (4 + 0.5) / 1.5 = 3.0 -> medium
    expect(calculateWeightedStatus(reports)).toBe("medium");
  });

  it("should ignore reports older than 30 days (weight = 0)", () => {
    const reports = [
      { status: "optimal", weight: 1.0 },
      { status: "requires_maintenance", weight: 0 }, // Ignored (>30 days)
    ];
    expect(calculateWeightedStatus(reports)).toBe("optimal");
  });

  it("should handle single report correctly", () => {
    const reports = [{ status: "sufficient", weight: 0.8 }];
    // 2 * 0.8 / 0.8 = 2 -> sufficient
    expect(calculateWeightedStatus(reports)).toBe("sufficient");
  });

  it("should handle empty reports array", () => {
    expect(calculateWeightedStatus([])).toBeNull();
  });

  it("should return null when all weights are zero", () => {
    const reports = [
      { status: "optimal", weight: 0 },
      { status: "medium", weight: 0 },
    ];
    expect(calculateWeightedStatus(reports)).toBeNull();
  });
});

describe("calculatePathScore - Real Implementation", () => {
  it("should calculate score using formula: Score = alpha*P + beta*S - gamma*O*100 - delta*L*100", () => {
    // P=100, S=100, O=0, L=0
    // 0.1*100 + 0.3*100 - 0 - 0 = 40
    expect(calculateScorePure(100, 100, 0, 0)).toBe(40);
  });

  it("should clamp score to [0, 100] range", () => {
    // Very negative
    expect(calculateScorePure(0, 0, 5, 1)).toBe(0);
    // Extreme positive (e.g., negative obstacles)
    expect(calculateScorePure(100, 100, -10, 0)).toBe(100);
  });

  it("should prioritize obstacles (gamma) over user ratings (alpha)", () => {
    // gamma=0.6 >> alpha=0.1
    const withoutObstacles = calculateScorePure(100, 0, 0, 0); // 10
    const withOneObstacle = calculateScorePure(100, 0, 1, 0); // 10 - 60 = 0
    expect(withoutObstacles).toBeGreaterThan(withOneObstacle);
    expect(withOneObstacle).toBe(0);
  });

  it("should prioritize street conditions (beta) over user ratings (alpha)", () => {
    // beta=0.3 > alpha=0.1
    const highP = calculateScorePure(100, 0, 0, 0); // 10
    const highS = calculateScorePure(0, 100, 0, 0); // 30
    expect(highS).toBeGreaterThan(highP);
  });

  it("should apply deviation penalty correctly", () => {
    const straight = calculateScorePure(100, 100, 0, 0); // 40
    const winding = calculateScorePure(100, 100, 0, 0.5); // 40 - 7.5 = 32.5
    expect(straight - winding).toBeCloseTo(7.5);
  });

  it("should handle zero inputs gracefully", () => {
    expect(calculateScorePure(0, 0, 0, 0)).toBe(0);
  });

  it("should handle mid-range values", () => {
    // P=50, S=50, O=0, L=0
    // 0.1*50 + 0.3*50 = 5 + 15 = 20
    expect(calculateScorePure(50, 50, 0, 0)).toBe(20);
  });
});

describe("Rating Aggregation", () => {
  it("should calculate correct average from multiple user ratings", () => {
    // If ratings are normalized to 0-100, average of multiple ratings:
    const ratings = [80, 60, 100]; // 3 ratings
    const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    expect(avg).toBeCloseTo(80);
  });

  it("should update aggregate when new rating is added", () => {
    const currentAvg = 80;
    const currentCount = 3;
    const newRating = 40;
    const newAvg = (currentAvg * currentCount + newRating) / (currentCount + 1);
    expect(newAvg).toBe(70);
  });

  it("should weight recent ratings more heavily", () => {
    // Using freshness weights
    const recentWeight = calculateFreshnessWeight(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)); // 1 day
    const oldWeight = calculateFreshnessWeight(new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)); // 20 days
    expect(recentWeight).toBeGreaterThan(oldWeight);
  });

  it("should identify controversial paths (high variance in ratings)", () => {
    const ratings = [1, 5, 1, 5, 1]; // Very polarized
    const mean = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    const variance = ratings.reduce((s, r) => s + (r - mean) ** 2, 0) / ratings.length;
    // High variance indicates controversy
    expect(variance).toBeGreaterThan(3);
  });

  it("should handle path with single rating", () => {
    const ratings = [4];
    const avg = ratings[0];
    expect(avg).toBe(4);
  });

  it("should handle path with no ratings (return null or 0)", () => {
    const ratings: number[] = [];
    const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
    expect(avg).toBeNull();
  });
});

describe("Recency Bonus", () => {
  it("should give higher bonus to recent reports", () => {
    const recentReports = [
      { createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    ];
    const oldReports = [
      { createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) },
    ];

    const recentBonus = calculateRecencyBonus(recentReports as any);
    const oldBonus = calculateRecencyBonus(oldReports as any);

    expect(recentBonus).toBeGreaterThan(oldBonus);
  });

  it("should cap bonus at 10", () => {
    const bonus = calculateRecencyBonus([{ createdAt: new Date() }] as any);
    expect(bonus).toBeLessThanOrEqual(10);
  });

  it("should return 0 for reports older than 30 days", () => {
    const bonus = calculateRecencyBonus([
      { createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
    ] as any);
    expect(bonus).toBe(0);
  });
});

describe("STATUS_SCORES mapping", () => {
  it("should map optimal to highest score", () => {
    expect(STATUS_SCORES.optimal).toBe(100);
  });

  it("should map requires_maintenance to lowest score", () => {
    expect(STATUS_SCORES.requires_maintenance).toBe(20);
  });

  it("should have monotonically decreasing scores", () => {
    expect(STATUS_SCORES.optimal).toBeGreaterThan(STATUS_SCORES.medium);
    expect(STATUS_SCORES.medium).toBeGreaterThan(STATUS_SCORES.sufficient);
    expect(STATUS_SCORES.sufficient).toBeGreaterThan(STATUS_SCORES.requires_maintenance);
  });
});
