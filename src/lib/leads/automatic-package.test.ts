import { describe, expect, it } from "vitest";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import { selectAutomaticBuildingCandidate } from "./automatic-package";

function candidate(overrides: Partial<BuildingFootprintCandidate> = {}): BuildingFootprintCandidate {
  return {
    id: "way/1",
    label: "house · 120 m²",
    polygon: [
      { latitude: 59, longitude: 10 },
      { latitude: 59, longitude: 10.001 },
      { latitude: 59.001, longitude: 10.001 },
    ],
    horizontalAreaSquareMeters: 120,
    distanceToAddressMeters: 0,
    containsAddress: true,
    confidence: "high",
    confidenceReasoning: "Adressepunktet ligger i bygningskonturen.",
    source: "OpenStreetMap building footprint via Overpass API",
    sourceUrl: "https://www.openstreetmap.org/way/1",
    license: "Open Database License (ODbL) 1.0",
    credits: "© OpenStreetMap contributors",
    ...overrides,
  };
}

describe("automatic building selection", () => {
  it("selects one high-confidence footprint containing the address", () => {
    expect(selectAutomaticBuildingCandidate([candidate()])).toMatchObject({
      candidate: { id: "way/1" },
      reason: null,
    });
  });

  it("blocks when more than one building contains the address", () => {
    expect(selectAutomaticBuildingCandidate([
      candidate(),
      candidate({ id: "way/2" }),
    ])).toEqual({ candidate: null, reason: "multiple_buildings_contain_address" });
  });

  it("accepts a clearly nearest medium-confidence building but blocks a close tie", () => {
    const nearest = candidate({ containsAddress: false, confidence: "medium", distanceToAddressMeters: 7 });
    const distant = candidate({ id: "way/2", containsAddress: false, confidence: "medium", distanceToAddressMeters: 24 });
    expect(selectAutomaticBuildingCandidate([nearest, distant]).candidate?.id).toBe("way/1");
    expect(selectAutomaticBuildingCandidate([
      nearest,
      candidate({ id: "way/3", containsAddress: false, confidence: "medium", distanceToAddressMeters: 11 }),
    ])).toMatchObject({ candidate: null, reason: "building_match_ambiguous" });
  });
});
