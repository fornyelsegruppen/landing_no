import { describe, expect, it } from "vitest";
import {
  matchedBaselineSignal,
  normalizeSearchSignalQuery,
  planSearchSignalRefresh,
} from "./search-signal-refresh";

describe("search signal refresh planning", () => {
  const signal = {
    source: "search-console" as const,
    origin: "api" as const,
    query: "takvask pris oslo",
    impressions: 0,
    clicks: 0,
    periodStart: "2026-08-13",
    periodEnd: "2026-09-09",
  };
  const input = {
    importedAt: "2026-09-12T12:00:00.000Z",
    now: new Date("2026-09-12T12:00:00Z"),
  };
  const baseline = {
    status: "available" as const,
    periodStart: "2026-07-16",
    periodEnd: "2026-08-12",
    signals: [
      {
        ...signal,
        query: "  TAKVASK   PRIS  OSLO ",
        periodStart: "2026-07-16",
        periodEnd: "2026-08-12",
      },
    ],
  };

  it("keeps an empty response distinct from a zero-valued observation", () => {
    expect(planSearchSignalRefresh({ ...input, existingTopics: [] })).toEqual({
      action: "no-data",
      reason: "no-observation",
    });
    expect(
      planSearchSignalRefresh({ ...input, signal, existingTopics: [] }),
    ).toMatchObject({
      action: "create",
      sourceMetrics: { metrics: { impressions: 0, clicks: 0 } },
    });
  });

  it("matches normalized queries and keeps a matched zero baseline as observed data", () => {
    expect(normalizeSearchSignalQuery("  Takvask   pris Oslo ")).toBe(
      "takvask pris oslo",
    );
    expect(matchedBaselineSignal(signal, baseline)).toMatchObject({
      impressions: 0,
      clicks: 0,
    });
    expect(
      planSearchSignalRefresh({
        ...input,
        signal,
        baseline,
        existingTopics: [],
      }),
    ).toMatchObject({
      action: "create",
      sourceMetrics: {
        baselineObservation: {
          status: "available",
          match: "matched",
          observationPeriod: { start: "2026-07-16", end: "2026-08-12" },
          metrics: { impressions: 0, clicks: 0 },
        },
      },
    });
  });

  it("labels unavailable, empty, and unmatched baselines without making zero data up", () => {
    const plan = (
      baseline: Parameters<typeof planSearchSignalRefresh>[0]["baseline"],
    ) =>
      planSearchSignalRefresh({
        ...input,
        signal,
        baseline,
        existingTopics: [],
      });
    expect(plan(undefined)).toMatchObject({
      sourceMetrics: { baselineObservation: { status: "not-provided" } },
    });
    expect(plan({ ...baseline, status: "no-data", signals: [] })).toMatchObject(
      {
        sourceMetrics: {
          baselineObservation: {
            status: "no-data",
            observationPeriod: { start: "2026-07-16", end: "2026-08-12" },
          },
        },
      },
    );
    expect(
      plan({
        ...baseline,
        signals: [{ ...signal, query: "takmaling pris oslo" }],
      }),
    ).toMatchObject({
      sourceMetrics: {
        baselineObservation: {
          status: "available",
          match: "unmatched",
          observationPeriod: { start: "2026-07-16", end: "2026-08-12" },
        },
      },
    });
  });

  it("ignores PII and unrelated queries before a writer sees them", () => {
    expect(
      planSearchSignalRefresh({
        ...input,
        existingTopics: [],
        signal: {
          source: "search-console",
          query: "ring 47 99 88 77 66 om takvask",
        },
      }),
    ).toEqual({ action: "ignored", reason: "invalid-or-out-of-scope" });
    expect(
      planSearchSignalRefresh({
        ...input,
        existingTopics: [],
        signal: { source: "search-console", query: "billig kjøkkenmaling" },
      }),
    ).toEqual({ action: "ignored", reason: "invalid-or-out-of-scope" });
  });

  it("replaces the latest aggregate snapshot without summing repeat imports", () => {
    const plan = planSearchSignalRefresh({
      ...input,
      signal,
      baseline,
      existingTopics: [
        {
          id: 9,
          primaryKeyword: "takvask pris oslo",
          searchIntent: "commercial",
          status: "candidate",
          sourceMetrics: {
            source: "ads",
            metrics: { impressions: 120, clicks: 5 },
          },
        },
      ],
    });
    expect(plan).toMatchObject({
      action: "update",
      topicId: 9,
      sourceMetrics: {
        source: "search-console",
        origin: "api",
        metrics: { impressions: 0, clicks: 0 },
        baselineObservation: {
          status: "available",
          match: "matched",
          metrics: { impressions: 0, clicks: 0 },
        },
        provenanceSources: ["ads", "search-console"],
      },
    });
    if (plan.action !== "update")
      throw new Error("Expected refresh update plan");
    const retry = planSearchSignalRefresh({
      ...input,
      signal,
      baseline,
      existingTopics: [
        {
          id: 9,
          primaryKeyword: "takvask pris oslo",
          searchIntent: "commercial",
          status: "candidate",
          sourceMetrics: plan.sourceMetrics,
        },
      ],
    });
    expect(retry).toMatchObject({
      action: "update",
      sourceMetrics: {
        metrics: { impressions: 0, clicks: 0 },
        baselineObservation: { metrics: { impressions: 0, clicks: 0 } },
      },
    });
  });

  it.each([
    { status: "approved" },
    { status: "published" },
    { status: "candidate", relatedPost: 44 },
  ])("never updates a protected or already-used topic", (existing) => {
    expect(
      planSearchSignalRefresh({
        ...input,
        signal,
        existingTopics: [
          {
            id: 10,
            primaryKeyword: "takvask pris oslo",
            searchIntent: "commercial",
            ...existing,
          },
        ],
      }),
    ).toEqual({ action: "skip", reason: "protected-topic", topicId: 10 });
  });
});
