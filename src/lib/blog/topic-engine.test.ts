import { describe, expect, it } from "vitest";
import {
  candidateFromSignal,
  containsPersonalData,
  manualTopicSeeds,
  topicOverlap,
  topicScore,
} from "./topic-engine";

describe("SEO topic engine", () => {
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
});
