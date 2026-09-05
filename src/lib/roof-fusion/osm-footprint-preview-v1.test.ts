import { describe, expect, it } from "vitest";
import type { AddressCandidate } from "@/lib/providers/contracts";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import {
  buildRoofFusionOsmFootprintPreviewV1,
  ROOF_FUSION_OSM_PREVIEW_BLOCKERS,
} from "./osm-footprint-preview-v1";

const address: AddressCandidate = {
  id: "0301-1-1-0-0-Karl-Johans-gate-1",
  label: "Karl Johans gate 1, 0154 OSLO",
  streetAddress: "Karl Johans gate 1",
  postalCode: "0154",
  city: "OSLO",
  latitude: 59.911377,
  longitude: 10.749404,
  source: "Kartverket",
};

function candidate(
  polygon: BuildingFootprintCandidate["polygon"],
): BuildingFootprintCandidate {
  return {
    id: "way/112089421",
    label: "office · 289 m²",
    polygon,
    horizontalAreaSquareMeters: 289.3,
    distanceToAddressMeters: 0,
    containsAddress: true,
    confidence: "high",
    confidenceReasoning: "Address point is inside the footprint",
    source: "OpenStreetMap building footprint via Overpass API",
    sourceUrl: "https://www.openstreetmap.org/way/112089421",
    license: "Open Database License (ODbL) 1.0",
    credits: "© OpenStreetMap contributors",
  };
}

const retrievedAt = "2026-09-02T10:00:00.000Z";

describe("Roof Fusion OSM footprint Preview bridge", () => {
  it("validates a real footprint through the canonical engine without making it price-ready", () => {
    const result = buildRoofFusionOsmFootprintPreviewV1({
      address,
      candidate: candidate([
        { latitude: 59.9113, longitude: 10.7492 },
        { latitude: 59.9113, longitude: 10.7496 },
        { latitude: 59.9115, longitude: 10.7496 },
        { latitude: 59.9115, longitude: 10.7492 },
      ]),
      retrievedAt,
    });

    expect(result.calculation.schemaVersion).toBe(
      "roof-geometry-calculation.v1",
    );
    expect(result.snapshot.state).toBe("review_required");
    expect(result.snapshot.quality.status).toBe("review_required");
    expect(result.snapshot.measurement.class).toBe("preliminary");
    expect(result.summary).toMatchObject({
      candidateId: "way/112089421",
      contractStatus: "valid",
      reviewState: "review_required",
      qualityStatus: "review_required",
      measurementClass: "preliminary",
      pricingReady: false,
      blockers: ROOF_FUSION_OSM_PREVIEW_BLOCKERS,
    });
    expect(result.summary.engineHorizontalAreaSquareMeters).toBeGreaterThan(1);
    expect(result.summary.footprintPerimeterMeters).toBeGreaterThan(1);
    expect(result.calculation.trace.surfaces[0].pitchDegrees).toBe(0);
    expect(result.summary.calculationHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.summary.snapshotHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.summary.renderHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("supports a concave footprint and stays deterministic", () => {
    const input = {
      address,
      candidate: candidate([
        { latitude: 59.9113, longitude: 10.7492 },
        { latitude: 59.9113, longitude: 10.7497 },
        { latitude: 59.9114, longitude: 10.7497 },
        { latitude: 59.9114, longitude: 10.74945 },
        { latitude: 59.9116, longitude: 10.74945 },
        { latitude: 59.9116, longitude: 10.7492 },
      ]),
      retrievedAt,
    };
    const first = buildRoofFusionOsmFootprintPreviewV1(input);
    const second = buildRoofFusionOsmFootprintPreviewV1(input);

    expect(second.calculation.calculationHash).toBe(
      first.calculation.calculationHash,
    );
    expect(second.snapshot.snapshotHash).toBe(first.snapshot.snapshotHash);
    expect(second.summary.footprintPerimeterMeters).toBeGreaterThan(1);
  });

  it("rejects a footprint with fewer than three distinct vertices", () => {
    expect(() =>
      buildRoofFusionOsmFootprintPreviewV1({
        address,
        candidate: candidate([
          { latitude: 59.9113, longitude: 10.7492 },
          { latitude: 59.9113, longitude: 10.7492 },
          { latitude: 59.9114, longitude: 10.7493 },
        ]),
        retrievedAt,
      }),
    ).toThrow(/three distinct vertices/u);
  });
});
