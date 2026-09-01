import { describe, expect, it } from "vitest";
import { prepareMeasurement } from "@/lib/measurements/proposal";
import {
  LEGACY_ROOF_PLANES_ADAPTER_ID,
  LEGACY_ROOF_PLANES_INPUT_VERSION,
  legacyRoofPlanesToSourceResultV1,
} from "./legacy-roof-planes-adapter-v1";
import {
  buildRoofSourceRequestV1,
  roofSourceResultToSnapshotV1,
} from "./source-adapter-v1";

const METERS_PER_DEGREE = 111_319.49079327358;
function rectangle(
  id: string,
  xOffsetM: number,
  width: number,
  height: number,
  min: number,
  max: number,
) {
  const latitude = 60;
  const longitude =
    10 + xOffsetM / (METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180));
  const dy = height / METERS_PER_DEGREE;
  const dx = width / (METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180));
  return {
    id,
    angleMinDegrees: min,
    angleMaxDegrees: max,
    polygon: [
      { latitude, longitude },
      { latitude, longitude: longitude + dx },
      { latitude: latitude + dy, longitude: longitude + dx },
      { latitude: latitude + dy, longitude },
    ],
  };
}

describe("legacy roof planes compatibility adapter", () => {
  it("preserves the existing deterministic area totals while making missing edge semantics explicit", () => {
    const proposal = {
      buildingIdentifier: "legacy-building-12",
      confidence: "high" as const,
      confidenceReasoning:
        "Administrator selected the building and documented both slope bands.",
      roofPlanes: [
        rectangle("south", 0, 10, 4, 27, 32),
        rectangle("north", 12, 10, 4, 35, 37),
      ],
    };
    const legacy = prepareMeasurement({
      proposal,
      addressResolved: true,
      sourceAuthorized: true,
      hasApprovedPriceRule: true,
    });
    const request = buildRoofSourceRequestV1({
      schemaVersion: "roof-source-request.v1",
      requestId: "legacy-request-12",
      caseId: "case-12",
      targetSnapshotId: "roof-case-12-legacy-r1",
      expectedInputVersion: LEGACY_ROOF_PLANES_INPUT_VERSION,
      adapterId: LEGACY_ROOF_PLANES_ADAPTER_ID,
      idempotencyKey: "legacy-roof:case-12:r1",
      requestedAt: "2026-09-01T09:00:00.000Z",
      input: proposal,
    });
    const normalized = legacyRoofPlanesToSourceResultV1(request, {
      proposal,
      source: {
        sourceId: "src-legacy",
        provider: "existing-roof-measurement-flow",
        providerObjectId: "TM-12-V1",
        capturedAt: "2026-08-31T12:00:00.000Z",
        retrievedAt: "2026-09-01T09:00:10.000Z",
        license: {
          status: "authorized",
          name: "Legacy source terms",
          attribution: "Existing Takfornyelse measurement",
        },
        visibility: "derived_only",
        quality: {
          status: "limited",
          score: 0.7,
          reasons: ["Footprint and slope bands only"],
        },
      },
      normalizedBy: {
        actorId: "roof-fusion-engine",
        actorType: "system",
      },
      decidedAt: "2026-09-01T09:00:20.000Z",
    });
    const snapshot = roofSourceResultToSnapshotV1(request, normalized, {
      snapshotId: request.targetSnapshotId,
      revision: 1,
      caseId: request.caseId,
      legacyMeasurementId: 12,
      inputVersion: LEGACY_ROOF_PLANES_INPUT_VERSION,
      engineVersion: "roof-fusion-engine.v1.0.0",
      rendererVersion: "roof-renderer.v1.0.0",
      generatedAt: "2026-09-01T09:00:20.000Z",
      normalizedBy: {
        actorId: "roof-fusion-engine",
        actorType: "system",
      },
    });

    expect(normalized.status).toBe("partial");
    expect(snapshot.processing.status).toBe("partial");
    expect(snapshot.measurement.method).toBe("legacy_footprint_slope_band");
    expect(
      snapshot.geometry.surfaces.map((surface) => surface.pitch),
    ).toMatchObject([
      { mode: "range", min: 35, max: 37 },
      { mode: "range", min: 27, max: 32 },
    ]);
    expect(
      snapshot.geometry.edges.every((edge) => edge.type === "unknown"),
    ).toBe(true);
    expect(
      snapshot.geometry.edges.every((edge) => edge.length3d.mode === "unknown"),
    ).toBe(true);
    expect(snapshot.quality.status).toBe("review_required");
    expect(snapshot.state).toBe("review_required");

    expect(snapshot.totals.grossHorizontalArea.min).toBe(
      (legacy.calculation?.horizontalAreaTenths ?? 0) / 10,
    );
    expect(snapshot.totals.grossSurfaceArea.min).toBe(
      (legacy.calculation?.actualAreaMinTenths ?? 0) / 10,
    );
    expect(snapshot.totals.grossSurfaceArea.max).toBe(
      (legacy.calculation?.actualAreaMaxTenths ?? 0) / 10,
    );
    expect(snapshot.provenance.sources[0]).toMatchObject({
      sourceId: "src-legacy",
      inputSchemaVersion: LEGACY_ROOF_PLANES_INPUT_VERSION,
      adapterVersion: "legacy-roof-planes-adapter.v1",
    });
  });
});
