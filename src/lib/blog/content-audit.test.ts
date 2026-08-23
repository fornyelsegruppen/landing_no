import { describe, expect, it } from "vitest";
import { recommendContentAudit } from "./content-audit";

const now = new Date("2026-08-23T10:00:00Z");

describe("deterministic content audit", () => {
  it("keeps content that creates leads and never auto-publishes an action", () => {
    expect(recommendContentAudit({ publishedAt: "2026-01-01T00:00:00Z", impressions: 10, clicks: 1, ctrPercent: 10, averagePosition: 5, leads: 2, convertedLeads: 1, now })).toEqual(expect.objectContaining({ recommendation: "keep", requiresHumanDecision: true }));
  });
  it("recommends merging old invisible content and updating visible low-CTR content", () => {
    expect(recommendContentAudit({ publishedAt: "2025-01-01T00:00:00Z", impressions: 10, clicks: 0, ctrPercent: 0, averagePosition: 80, leads: 0, convertedLeads: 0, now }).recommendation).toBe("merge");
    expect(recommendContentAudit({ publishedAt: "2026-06-01T00:00:00Z", impressions: 500, clicks: 2, ctrPercent: 0.4, averagePosition: 11, leads: 0, convertedLeads: 0, now }).recommendation).toBe("update");
  });
  it("prioritizes an indexing problem", () => {
    expect(recommendContentAudit({ impressions: 0, clicks: 0, ctrPercent: 0, averagePosition: 0, leads: 0, convertedLeads: 0, indexVerdict: "FAIL", now }).recommendation).toBe("update");
  });
});
