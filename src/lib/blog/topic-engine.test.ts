import { describe, expect, it } from "vitest";
import { blogServiceAreas, approvedBlogKnowledge } from "./knowledge-base";
import {
  candidateFromSignal,
  containsPersonalData,
  getManualTopicSeeds,
  hasUnsupportedEditorialTarget,
  manualTopicSeeds,
  seasonalRelevanceForTopic,
  sourceMetricsFromSignal,
  topicOverlap,
  topicScore,
} from "./topic-engine";

describe("SEO topic engine", () => {
  it("limits local seed topics and declared coverage to Oslo surroundings", () => {
    const local = manualTopicSeeds.filter((topic) => topic.location);
    expect(local.length).toBeGreaterThan(0);
    expect(local.every((topic) => blogServiceAreas.includes(topic.location!))).toBe(true);
    expect(approvedBlogKnowledge.servedAreas).toContain("Oslo");
    expect(approvedBlogKnowledge.servedAreas).not.toContain("Ålesund");
    expect(manualTopicSeeds.some((topic) => topic.topic.includes("Ålesund"))).toBe(false);
  });
  it("contains at least ten approved fallback candidates", () => {
    expect(manualTopicSeeds).toHaveLength(10);
    expect(manualTopicSeeds.every((topic) => topic.source === "manual")).toBe(true);
  });

  it("uses the agreed weighted 0–100 scoring model", () => {
    expect(
      topicScore({
        serviceRelevance: 1,
        demand: 1,
        commercialValue: 1,
        contentGap: 1,
        seasonalRelevance: 1,
        originalEvidence: 1,
        localRelevance: 1,
      }),
    ).toBe(100);
  });

  it("detects overlap and obvious cannibalization", () => {
    expect(topicOverlap("Takvask pris per m2", "Hva koster takvask per m2?")).toBeGreaterThanOrEqual(50);
    expect(topicOverlap("Takvask pris", "Når bør taket skiftes?")).toBeLessThan(30);
  });

  it("drops personal data before a lead-derived signal becomes a topic", () => {
    expect(containsPersonalData("Ola@example.no spør om takvask")).toBe(true);
    expect(
      candidateFromSignal({
        source: "lead",
        query: "Ring 47 73 58 88 om takvask",
      }),
    ).toBeNull();
  });

  it("retains aggregated signal evidence without inferring geographic coverage", () => {
    const candidate = candidateFromSignal({
      source: "search-console",
      origin: "api",
      query: "takvask pris",
      impressions: 0,
      clicks: 0,
      periodStart: "2026-06-01",
      periodEnd: "2026-08-31",
    });
    expect(candidate?.sourceSignal).toMatchObject({ impressions: 0, clicks: 0 });
    expect(sourceMetricsFromSignal(candidate!.sourceSignal!, "2026-09-12T10:00:00.000Z")).toEqual({
      kind: "aggregated-search-signal",
      source: "search-console",
      origin: "api",
      importedAt: "2026-09-12T10:00:00.000Z",
      metrics: { impressions: 0, clicks: 0 },
      observationPeriod: { start: "2026-06-01", end: "2026-08-31" },
      provenanceCoverage: { observationPeriod: "known", geography: "unknown" },
    });
  });

  it("rejects signals unrelated to a delivered roof service", () => {
    expect(candidateFromSignal({ source: "search-console", query: "billig kjøkkenmaling" })).toBeNull();
  });

  it.each([
    ["mose på taket", "takvask"],
    ["vaske taket", "takvask"],
    ["impregnering av takstein", "impregnering"],
    ["male takstein", "takmaling"],
  ])("accepts the Norwegian roof-service variant %s", (query, serviceKey) => {
    expect(candidateFromSignal({ source: "search-console", query })?.serviceKey).toBe(serviceKey);
  });

  it.each(["impregnering sko", "impregnering av sofa", "maling av stue"]) (
    "rejects non-roof indoor or footwear query %s",
    (query) => {
      expect(candidateFromSignal({ source: "search-console", query })).toBeNull();
    },
  );

  it.each(["takvask Ålesund", "takmaling Bergen", "takbytte Trondheim", "takvask Stavanger", "takfornying Tromsø"]) (
    "fails closed for known out-of-area local target %s",
    (query) => {
      expect(hasUnsupportedEditorialTarget(query)).toBe(true);
      expect(candidateFromSignal({ source: "search-console", query })).toBeNull();
    },
  );

  it("prioritizes an Oslo editorial target without claiming measured city geography", () => {
    const candidate = candidateFromSignal(
      { source: "search-console", query: "takmaling oslo" },
      new Date("2026-09-12T12:00:00Z"),
    );
    expect(candidate).toMatchObject({
      serviceKey: "takmaling",
      factors: { localRelevance: 1 },
    });
    expect(candidate?.location).toBeUndefined();
    expect(candidate?.reason).toContain("søkesignalets geografi er ikke målt");
  });

  it("uses the injected Oslo date for seasonal relevance", () => {
    expect(seasonalRelevanceForTopic("takvask etter vinteren", new Date("2026-04-15T12:00:00Z"))).toBe(1);
    expect(seasonalRelevanceForTopic("takvask etter vinteren", new Date("2026-10-15T12:00:00Z"))).toBe(0.3);
    expect(seasonalRelevanceForTopic("takvask om vinteren", new Date("2026-10-15T12:00:00Z"))).toBe(0.25);
  });

  it("creates manual seeds with injected current-season relevance", () => {
    const spring = getManualTopicSeeds(new Date("2026-04-15T12:00:00Z"));
    const autumn = getManualTopicSeeds(new Date("2026-10-15T12:00:00Z"));
    const index = spring.findIndex((topic) => topic.primaryKeyword === "sjekk tak etter vinter");
    expect(spring[index]?.factors.seasonalRelevance).toBe(1);
    expect(autumn[index]?.factors.seasonalRelevance).toBe(0.3);
  });
});
