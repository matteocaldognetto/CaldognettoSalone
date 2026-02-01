import { describe, it, expect } from "vitest";
import { _testing } from "../lib/aggregation";

const { calculateFreshnessWeight, calculateWeightedStatus, calculateScorePure, STATUS_SCORES } = _testing;

describe("Aggregation Algorithm", () => {
  describe("calculateFreshnessWeight", () => {
    // Tests use relative dates from now to avoid mocking system time

    it("should return 1.0 for reports less than 7 days old", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(calculateFreshnessWeight(threeDaysAgo)).toBe(1.0);
    });

    it("should return 1.0 for reports exactly at boundary (0 days)", () => {
      const today = new Date();
      expect(calculateFreshnessWeight(today)).toBe(1.0);
    });

    it("should return 0.8 for reports 7-14 days old", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      expect(calculateFreshnessWeight(tenDaysAgo)).toBe(0.8);
    });

    it("should return 0.5 for reports 14-30 days old", () => {
      const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
      expect(calculateFreshnessWeight(twentyOneDaysAgo)).toBe(0.5);
    });

    it("should return 0 for reports older than 30 days", () => {
      const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      expect(calculateFreshnessWeight(fortyFiveDaysAgo)).toBe(0);
    });

    it("should return 0 for very old reports", () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      expect(calculateFreshnessWeight(oneYearAgo)).toBe(0);
    });
  });

  describe("STATUS_SCORES", () => {
    it("should have correct score for optimal status", () => {
      expect(STATUS_SCORES.optimal).toBe(100);
    });

    it("should have correct score for medium status", () => {
      expect(STATUS_SCORES.medium).toBe(70);
    });

    it("should have correct score for sufficient status", () => {
      expect(STATUS_SCORES.sufficient).toBe(50);
    });

    it("should have correct score for requires_maintenance status", () => {
      expect(STATUS_SCORES.requires_maintenance).toBe(20);
    });

    it("should have scores in descending order", () => {
      expect(STATUS_SCORES.optimal).toBeGreaterThan(STATUS_SCORES.medium);
      expect(STATUS_SCORES.medium).toBeGreaterThan(STATUS_SCORES.sufficient);
      expect(STATUS_SCORES.sufficient).toBeGreaterThan(
        STATUS_SCORES.requires_maintenance,
      );
    });

    it("should have all scores between 0 and 100", () => {
      Object.values(STATUS_SCORES).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Weighted Average Calculation Logic", () => {
    // Tests use the real calculateWeightedStatus from aggregation.ts

    it("should calculate optimal when all reports are optimal", () => {
      const reports = [
        { status: "optimal", weight: 1.0 },
        { status: "optimal", weight: 1.0 },
        { status: "optimal", weight: 0.8 },
      ];
      expect(calculateWeightedStatus(reports)).toBe("optimal");
    });

    it("should calculate medium when reports are mixed optimal/sufficient", () => {
      const reports = [
        { status: "optimal", weight: 1.0 }, // 4 * 1.0 = 4
        { status: "sufficient", weight: 1.0 }, // 2 * 1.0 = 2
      ];
      // Average: (4 + 2) / 2 = 3 -> medium
      expect(calculateWeightedStatus(reports)).toBe("medium");
    });

    it("should weight recent reports more heavily", () => {
      const reports = [
        { status: "optimal", weight: 1.0 }, // Recent: 4 * 1.0 = 4
        { status: "requires_maintenance", weight: 0.5 }, // Old: 1 * 0.5 = 0.5
      ];
      // Weighted avg: (4 + 0.5) / 1.5 = 3.0 -> medium
      expect(calculateWeightedStatus(reports)).toBe("medium");
    });

    it("should ignore reports with zero weight", () => {
      const reports = [
        { status: "optimal", weight: 1.0 },
        { status: "requires_maintenance", weight: 0 }, // Ignored
      ];
      expect(calculateWeightedStatus(reports)).toBe("optimal");
    });

    it("should round to nearest status value", () => {
      const reports = [
        { status: "optimal", weight: 1.0 }, // 4
        { status: "medium", weight: 1.0 }, // 3
        { status: "medium", weight: 1.0 }, // 3
      ];
      // Average: (4 + 3 + 3) / 3 = 3.33 -> rounds to 3 -> medium
      expect(calculateWeightedStatus(reports)).toBe("medium");
    });
  });

  describe("Path Score Formula", () => {
    // Tests use the real calculateScorePure from aggregation.ts
    // Formula: Score = α·P + β·S − γ·O·100 − δ·L·100
    // α = 0.1, β = 0.3, γ = 0.6, δ = 0.15
    const alpha = 0.1;
    const delta = 0.15;

    it("should calculate max score with max ratings, no obstacles, straight path", () => {
      const score = calculateScorePure(100, 100, 0, 0);
      // 0.1*100 + 0.3*100 - 0 - 0 = 40
      expect(score).toBe(40);
    });

    it("should calculate middle score with average values", () => {
      const score = calculateScorePure(50, 50, 0, 0);
      // 0.1*50 + 0.3*50 = 5 + 15 = 20
      expect(score).toBe(20);
    });

    it("should heavily reduce score based on obstacles", () => {
      const score = calculateScorePure(100, 100, 1, 0);
      // 10 + 30 - 60 = -20 -> clamped to 0
      expect(score).toBe(0);
    });

    it("should clamp score to minimum 0", () => {
      const score = calculateScorePure(0, 0, 1, 0);
      expect(score).toBe(0);
    });

    it("should clamp score to maximum 100", () => {
      const score = calculateScorePure(100, 100, -10, 0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should prioritize obstacles over user ratings (P)", () => {
      const highP = calculateScorePure(100, 0, 0, 0); // 10
      const oneObstacle = calculateScorePure(100, 0, 1, 0); // 10 - 60 -> 0
      expect(highP).toBeGreaterThan(oneObstacle);
      expect(oneObstacle).toBe(0);
    });

    it("should prioritize street conditions (S) over user ratings (P)", () => {
      const highP = calculateScorePure(100, 0, 0, 0); // 10
      const highS = calculateScorePure(0, 100, 0, 0); // 30
      expect(highS).toBeGreaterThan(highP);
    });

    // --- Deviation (L) tests ---

    it("should reduce score for winding paths (high L)", () => {
      const straight = calculateScorePure(100, 100, 0, 0); // 40
      const winding = calculateScorePure(100, 100, 0, 0.5); // 40 - 0.15*0.5*100 = 40 - 7.5 = 32.5
      expect(straight).toBe(40);
      expect(winding).toBe(32.5);
      expect(winding).toBeLessThan(straight);
    });

    it("should apply max deviation penalty of 15 points when L=1", () => {
      const noDeviation = calculateScorePure(100, 100, 0, 0);
      const maxDeviation = calculateScorePure(100, 100, 0, 1);
      // 40 - 15 = 25
      expect(noDeviation - maxDeviation).toBeCloseTo(15);
      expect(maxDeviation).toBe(25);
    });

    it("should clamp to 0 with high deviation and low ratings", () => {
      const score = calculateScorePure(0, 0, 0, 1);
      // 0 + 0 - 0 - 15 = -15 -> clamped to 0
      expect(score).toBe(0);
    });

    it("should not affect score when L=0", () => {
      const withoutL = calculateScorePure(50, 50, 0);
      const withZeroL = calculateScorePure(50, 50, 0, 0);
      expect(withoutL).toBe(withZeroL);
    });

    it("should have deviation penalty less impactful than obstacles", () => {
      // δ*1*100 = 15 vs γ*1*100 = 60
      const deviationOnly = calculateScorePure(100, 100, 0, 1); // 40 - 15 = 25
      const obstacleOnly = calculateScorePure(100, 100, 1, 0); // 40 - 60 = 0
      expect(deviationOnly).toBeGreaterThan(obstacleOnly);
    });

    it("should have deviation penalty more impactful than user ratings", () => {
      // δ (0.15) > α (0.1)
      const ratingContribution = alpha * 100; // 10
      const maxDeviationPenalty = delta * 1 * 100; // 15
      expect(maxDeviationPenalty).toBeGreaterThan(ratingContribution);
    });
  });
});
