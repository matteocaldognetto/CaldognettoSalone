import { describe, it, expect } from "vitest";
import { _testing } from "../lib/aggregation";

const { calculateRecencyBonus } = _testing;

describe("Aggregation - Recency Bonus", () => {
  describe("calculateRecencyBonus", () => {
    it("should return maximum bonus (~10) for very recent reports", () => {
      const recentReports = [
        { createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) }, // 1 day ago
        { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }, // 2 days ago
      ];

      const bonus = calculateRecencyBonus(recentReports as any);

      // Average age ~1.5 days, bonus = 10 * (1 - 1.5/30) = 10 * 0.95 = 9.5
      expect(bonus).toBeGreaterThan(9);
      expect(bonus).toBeLessThanOrEqual(10);
    });

    it("should return lower bonus for older reports", () => {
      const olderReports = [
        { createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) }, // 20 days ago
        { createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) }, // 25 days ago
      ];

      const bonus = calculateRecencyBonus(olderReports as any);

      // Average age ~22.5 days, bonus = 10 * (1 - 22.5/30) = 10 * 0.25 = 2.5
      expect(bonus).toBeGreaterThan(1);
      expect(bonus).toBeLessThan(5);
    });

    it("should return 0 for reports older than 30 days", () => {
      const veryOldReports = [
        { createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) }, // 35 days
        { createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }, // 40 days
      ];

      const bonus = calculateRecencyBonus(veryOldReports as any);

      // Average age > 30, so (1 - avgAge/30) < 0, clamped to 0
      expect(bonus).toBe(0);
    });

    it("should calculate correct bonus for mixed-age reports", () => {
      const mixedReports = [
        { createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) }, // 1 day
        { createdAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000) }, // 29 days
      ];

      const bonus = calculateRecencyBonus(mixedReports as any);

      // Average age = 15, bonus = 10 * (1 - 15/30) = 10 * 0.5 = 5
      expect(bonus).toBeCloseTo(5, 0);
    });

    it("should return near-10 for reports from today", () => {
      const todayReports = [
        { createdAt: new Date() },
        { createdAt: new Date() },
      ];

      const bonus = calculateRecencyBonus(todayReports as any);

      // Average age ~0, bonus ≈ 10
      expect(bonus).toBeCloseTo(10, 0);
    });

    it("should handle single report", () => {
      const singleReport = [
        { createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }, // 15 days
      ];

      const bonus = calculateRecencyBonus(singleReport as any);

      // bonus = 10 * (1 - 15/30) = 5
      expect(bonus).toBeCloseTo(5, 0);
    });

    it("should always return a value between 0 and 10", () => {
      // Test with various report ages
      const testCases = [0, 1, 7, 14, 21, 30, 60, 90];

      for (const daysAgo of testCases) {
        const reports = [
          { createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) },
        ];

        const bonus = calculateRecencyBonus(reports as any);
        expect(bonus).toBeGreaterThanOrEqual(0);
        expect(bonus).toBeLessThanOrEqual(10);
      }
    });
  });
});
