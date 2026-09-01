import type { PayloadRequest } from "payload";
import { describe, expect, it, vi } from "vitest";
import {
  adminNextFixtureR4Adapter,
  createAdminNextRoofFusionR4Adapter,
  loadAdminNextR4WithMissingCanonicalFallback,
  parseAdminNextR4CaseIdentityV1,
} from "@/lib/admin-next/r4-read-adapter";
import { buildRoofFusionPreviewUatGoldenPlanV1 } from "@/lib/roof-fusion/preview-uat-golden-v1";

const admin = {
  active: true,
  id: 7,
  role: "admin",
} as unknown as PayloadRequest["user"];

describe("Admin Next authorized Roof Fusion R4 reader", () => {
  it("maps TF lead identity and binds the authenticated admin to every read", async () => {
    const snapshot = (
      await buildRoofFusionPreviewUatGoldenPlanV1(12)
    ).finalSnapshot;
    const reader = {
      readLatestSnapshot: vi.fn().mockResolvedValue(snapshot),
      readSnapshot: vi.fn().mockResolvedValue(null),
    };
    const result = await createAdminNextRoofFusionR4Adapter(
      reader,
      admin,
    ).load("TF-12", snapshot.snapshotId);

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
        provenance: { checksum: snapshot.snapshotHash },
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

  it("uses the fixture only when the canonical snapshot is objectively absent", async () => {
    const missingCanonical = createAdminNextRoofFusionR4Adapter(
      {
        readLatestSnapshot: vi.fn().mockResolvedValue(null),
        readSnapshot: vi.fn(),
      },
      admin,
    );
    await expect(
      loadAdminNextR4WithMissingCanonicalFallback({
        canonical: missingCanonical,
        fixture: adminNextFixtureR4Adapter,
        caseReference: "TF-1042",
        measurementReference: "R4-2026-1042",
      }),
    ).resolves.toMatchObject({ status: "ready", source: "fixture" });

    const snapshot = (
      await buildRoofFusionPreviewUatGoldenPlanV1(1042)
    ).finalSnapshot;
    const mismatch = createAdminNextRoofFusionR4Adapter(
      {
        readLatestSnapshot: vi.fn().mockResolvedValue(snapshot),
        readSnapshot: vi.fn(),
      },
      admin,
    );
    await expect(
      loadAdminNextR4WithMissingCanonicalFallback({
        canonical: mismatch,
        fixture: adminNextFixtureR4Adapter,
        caseReference: "TF-1042",
        measurementReference: "R4-2026-1042",
      }),
    ).resolves.toEqual({
      status: "not_found",
      reason: "measurement_mismatch",
    });
  });
});
