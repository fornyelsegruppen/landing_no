import type { PayloadRequest } from "payload";
import { describe, expect, it, vi } from "vitest";
import {
  createAdminNextRoofFusionR4Adapter,
  parseAdminNextR4CaseIdentityV1,
  projectRoofSnapshotToR4,
} from "@/lib/admin-next/r4-read-adapter";
import { buildApprovedGableRoofFixtureV1 } from "@/lib/roof-fusion/gable-roof-fixture-v1";
import { buildRoofFusionPreviewUatGoldenPlanV1 } from "@/lib/roof-fusion/preview-uat-golden-v1";

const admin = {
  active: true,
  id: 7,
  role: "admin",
} as unknown as PayloadRequest["user"];

describe("Admin Next authorized Roof Fusion R4 reader", () => {
  it("maps TF lead identity and binds the authenticated admin to every read", async () => {
    const plan = await buildRoofFusionPreviewUatGoldenPlanV1(12);
    const snapshot = plan.finalSnapshot;
    const previous = plan.snapshots[1];
    const reader = {
      readLatestSnapshot: vi.fn().mockResolvedValue(snapshot),
      readSnapshot: vi.fn().mockResolvedValue(previous),
    };
    const result = await createAdminNextRoofFusionR4Adapter(reader, admin).load(
      "TF-12",
      snapshot.snapshotId,
    );

    expect(reader.readLatestSnapshot).toHaveBeenCalledWith("lead:12", admin);
    expect(reader.readSnapshot).toHaveBeenCalledWith(
      "lead:12",
      snapshot.supersedesSnapshotId,
      admin,
    );
    expect(result).toMatchObject({
      status: "ready",
      source: "canonical",
      value: {
        reference: snapshot.snapshotId,
        state: "verified",
        planeCount: snapshot.geometry.surfaces.length,
        comparedToReference: previous.snapshotId,
        overallPitchDegrees: expect.any(Number),
        perimeterMeters: expect.any(Number),
        provenance: { checksum: snapshot.snapshotHash },
        sources: snapshot.provenance.sources.map((source) => ({
          id: source.sourceId,
          kind: source.kind,
          label: source.provider,
          attribution: source.license.attribution,
          capturedAt: source.capturedAt || source.retrievedAt,
          licenseState: source.license.status,
          qualityState: source.quality.status,
        })),
        diagram: {
          vertices: snapshot.rendererPayload.vertices.map((vertex) => ({
            id: vertex.vertexId,
            xMeters: vertex.xM,
            yMeters: vertex.yM,
          })),
          surfaces: expect.any(Array),
          edges: expect.any(Array),
        },
      },
    });
    if (result.status !== "ready" || result.source !== "canonical") {
      throw new Error("Expected canonical RF snapshot binding");
    }
    expect(result.binding.measurement).toEqual({
      id: result.binding.snapshot.id,
      revision: result.binding.snapshot.revision,
    });
  });

  it("reads an exact snapshot for a pinned review context and exposes its canonical binding", async () => {
    const plan = await buildRoofFusionPreviewUatGoldenPlanV1(12);
    const snapshot = plan.finalSnapshot;
    const previous = plan.snapshots.find(
      (item) => item.snapshotId === snapshot.supersedesSnapshotId,
    );
    const reader = {
      readLatestSnapshot: vi.fn(),
      readSnapshot: vi.fn(async (_caseId: string, snapshotId: string) =>
        snapshotId === snapshot.snapshotId ? snapshot : previous || null,
      ),
    };

    const result = await createAdminNextRoofFusionR4Adapter(reader, admin).load(
      "TF-12",
      snapshot.snapshotId,
      snapshot.snapshotId,
    );

    expect(reader.readLatestSnapshot).not.toHaveBeenCalled();
    expect(reader.readSnapshot).toHaveBeenCalledWith(
      "lead:12",
      snapshot.snapshotId,
      admin,
    );
    expect(result).toMatchObject({
      status: "ready",
      source: "canonical",
      binding: {
        measurement: {
          id: snapshot.snapshotId,
          revision: snapshot.revision,
        },
        snapshot: {
          id: snapshot.snapshotId,
          revision: snapshot.revision,
          hash: snapshot.snapshotHash,
          inputHash: snapshot.inputHash,
          renderHash: snapshot.rendererPayload.renderHash,
        },
      },
    });
  });

  it("rejects ambiguous case references before any repository read", async () => {
    const reader = {
      readLatestSnapshot: vi.fn(),
      readSnapshot: vi.fn(),
    };
    await expect(
      createAdminNextRoofFusionR4Adapter(reader, admin).load(
        "12",
        "rf-uat-lead-12-r3-approved",
      ),
    ).resolves.toEqual({
      status: "not_found",
      reason: "case_identity_invalid",
    });
    expect(reader.readLatestSnapshot).not.toHaveBeenCalled();
    expect(parseAdminNextR4CaseIdentityV1("TF-12")).toEqual({
      caseReference: "TF-12",
      leadId: 12,
      roofFusionCaseId: "lead:12",
    });
  });

  it("returns a fail-closed missing result instead of substituting the fixture", async () => {
    const missingCanonical = createAdminNextRoofFusionR4Adapter(
      {
        readLatestSnapshot: vi.fn().mockResolvedValue(null),
        readSnapshot: vi.fn(),
      },
      admin,
    );
    const result = await missingCanonical.load("TF-1042", "R4-2026-1042");
    expect(result).toEqual({
      status: "not_found",
      reason: "canonical_snapshot_missing",
    });
    expect(JSON.stringify(result)).not.toContain("Demo ·");
    expect(JSON.stringify(result)).not.toContain("TF-1042");

    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(1042))
      .finalSnapshot;
    const mismatch = createAdminNextRoofFusionR4Adapter(
      {
        readLatestSnapshot: vi.fn().mockResolvedValue(snapshot),
        readSnapshot: vi.fn(),
      },
      admin,
    );
    await expect(mismatch.load("TF-1042", "R4-2026-1042")).resolves.toEqual({
      status: "not_found",
      reason: "measurement_mismatch",
    });
  });

  it("separates horizontal, surface, and net area while leaving unknown pitch undefined", () => {
    const snapshot = structuredClone(
      buildApprovedGableRoofFixtureV1().approvedSnapshot,
    );
    const unknownPitch = {
      ...snapshot.totals.verifiedGutterLength,
      unit: "deg" as const,
    };
    snapshot.geometry.surfaces = snapshot.geometry.surfaces.map((surface) => ({
      ...surface,
      pitch: unknownPitch,
    }));

    const result = projectRoofSnapshotToR4(snapshot, null);

    expect(result.horizontalAreaSquareMeters).toBe(80);
    expect(result.surfaceAreaSquareMeters).toBeCloseTo(92.37604307, 8);
    expect(result.areaSquareMeters).toBeCloseTo(90.990402424, 8);
    expect(result.overallPitchDegrees).toBeUndefined();
    expect(
      result.planes.every((surface) => surface.pitchDegrees === undefined),
    ).toBe(true);
    expect(
      result.primarySlopes.every(
        (surface) => surface.pitchDegrees === undefined,
      ),
    ).toBe(true);
  });
});
