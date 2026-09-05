import { describe, expect, it } from "vitest";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import {
  applyRoofSnapshotCorrectionV1,
  approveRoofSnapshotV1,
} from "./roof-snapshot-v1";
import {
  assertRoofFusionOfferBridgeBindingV1,
  assertRoofFusionOfferBridgePreviewEnabledV1,
  projectApprovedRoofFusionMeasurementV1,
  RoofFusionOfferBridgeErrorV1,
  roofFusionOfferBridgeBindingHashV1,
  roofFusionOfferBridgeCommandHashV1,
  type RoofFusionOfferBridgeRequestV1,
} from "./offer-bridge-contract-v1";

function request(
  overrides: Partial<RoofFusionOfferBridgeRequestV1> = {},
): RoofFusionOfferBridgeRequestV1 {
  const { approvedSnapshot } = buildApprovedGableRoofFixtureV1();
  return {
    schemaVersion: "roof-fusion-offer-bridge-request.v1",
    caseId: approvedSnapshot.subject.caseId,
    expectedCaseRevision: 8,
    expectedAddressRevision: 3,
    snapshot: {
      snapshotId: approvedSnapshot.snapshotId,
      revision: approvedSnapshot.revision,
      snapshotHash: approvedSnapshot.snapshotHash,
      inputHash: approvedSnapshot.inputHash,
      renderHash: approvedSnapshot.rendererPayload.renderHash,
    },
    idempotencyKey: "rf-offer-case-12-r1",
    ...overrides,
  };
}

describe("Roof Fusion offer bridge v1", () => {
  it("can only be enabled by all three Preview gates", () => {
    expect(() =>
      assertRoofFusionOfferBridgePreviewEnabledV1({
        VERCEL_ENV: "preview",
        ADMIN_NEXT_MODE: "preview",
        FEATURE_ROOF_FUSION_V1: "true",
        FEATURE_ADMIN_NEXT_RF_OFFER_BRIDGE: "true",
      }),
    ).not.toThrow();
    expect(() =>
      assertRoofFusionOfferBridgePreviewEnabledV1({
        VERCEL_ENV: "production",
        ADMIN_NEXT_MODE: "preview",
        FEATURE_ROOF_FUSION_V1: "true",
        FEATURE_ADMIN_NEXT_RF_OFFER_BRIDGE: "true",
      }),
    ).toThrowError(expect.objectContaining({ code: "PREVIEW_REQUIRED" }));
    expect(() =>
      assertRoofFusionOfferBridgePreviewEnabledV1({
        VERCEL_ENV: "preview",
        ADMIN_NEXT_MODE: "preview",
        FEATURE_ROOF_FUSION_V1: "true",
      }),
    ).toThrowError(expect.objectContaining({ code: "MUTATION_DISABLED" }));
  });

  it("binds the exact case, address, input, snapshot and renderer revisions", () => {
    const { approvedSnapshot } = buildApprovedGableRoofFixtureV1();
    expect(
      assertRoofFusionOfferBridgeBindingV1({
        request: request(),
        snapshot: approvedSnapshot,
        latestSnapshot: approvedSnapshot,
        caseRevision: 8,
        addressRevision: 3,
      }).snapshot.snapshotHash,
    ).toBe(approvedSnapshot.snapshotHash);

    expect(() =>
      assertRoofFusionOfferBridgeBindingV1({
        request: request({ expectedAddressRevision: 2 }),
        snapshot: approvedSnapshot,
        latestSnapshot: approvedSnapshot,
        caseRevision: 8,
        addressRevision: 3,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "ADDRESS_REVISION_CONFLICT" }),
    );
    expect(() =>
      assertRoofFusionOfferBridgeBindingV1({
        request: request({
          snapshot: {
            ...request().snapshot,
            renderHash: "a".repeat(64),
          },
        }),
        snapshot: approvedSnapshot,
        latestSnapshot: approvedSnapshot,
        caseRevision: 8,
        addressRevision: 3,
      }),
    ).toThrowError(expect.objectContaining({ code: "RENDER_HASH_MISMATCH" }));
  });

  it("requires an explicit reason for a corrected result", () => {
    const { reviewedSnapshot } = buildApprovedGableRoofFixtureV1();
    const corrected = applyRoofSnapshotCorrectionV1(reviewedSnapshot, {
      schemaVersion: "roof-snapshot-correction-command.v1",
      correctionType: "edge_gutter_candidate",
      edgeId: "edge-north-eave",
      value: false,
      newSnapshotId: "roof-case-12-r2-corrected",
      expectedSnapshotHash: reviewedSnapshot.snapshotHash,
      idempotencyKey: "rf-offer:case-12:corrected-gutter",
      actor: { actorId: "admin-17", actorType: "administrator" },
      correctedAt: "2026-09-01T08:04:00.000Z",
      reason: "Administrator verified the roof evidence against the source",
      sourceRefs: [reviewedSnapshot.provenance.sources[0]!.sourceId],
    });
    const correctedRequest = request({
      snapshot: {
        snapshotId: corrected.snapshotId,
        revision: corrected.revision,
        snapshotHash: corrected.snapshotHash,
        inputHash: corrected.inputHash,
        renderHash: corrected.rendererPayload.renderHash,
      },
    });

    expect(() =>
      assertRoofFusionOfferBridgeBindingV1({
        request: correctedRequest,
        snapshot: corrected,
        latestSnapshot: corrected,
        caseRevision: 8,
        addressRevision: 3,
      }),
    ).toThrowError(expect.objectContaining({ code: "REVIEW_REASON_REQUIRED" }));

    expect(() =>
      assertRoofFusionOfferBridgeBindingV1({
        request: {
          ...correctedRequest,
          exceptionReason:
            "The administrator verified the correction against the original source.",
        },
        snapshot: corrected,
        latestSnapshot: corrected,
        caseRevision: 8,
        addressRevision: 3,
      }),
    ).not.toThrow();

    const approved = approveRoofSnapshotV1(corrected, {
      schemaVersion: "roof-snapshot-approval-command.v1",
      expectedSnapshotHash: corrected.snapshotHash,
      idempotencyKey: "rf-offer:case-12:approve-corrected",
      actor: { actorId: "admin-17", actorType: "administrator" },
      approvedAt: "2026-09-01T08:05:00.000Z",
      reviewReason:
        "The administrator verified the correction against the original source.",
    });
    const approvedRequest = request({
      snapshot: {
        snapshotId: approved.snapshotId,
        revision: approved.revision,
        snapshotHash: approved.snapshotHash,
        inputHash: approved.inputHash,
        renderHash: approved.rendererPayload.renderHash,
      },
    });
    expect(() =>
      assertRoofFusionOfferBridgeBindingV1({
        request: approvedRequest,
        snapshot: approved,
        latestSnapshot: approved,
        caseRevision: 8,
        addressRevision: 3,
      }),
    ).not.toThrow();
  });

  it("projects an approved snapshot into an immutable measurement binding", () => {
    const { approvedSnapshot } = buildApprovedGableRoofFixtureV1();
    const projected = projectApprovedRoofFusionMeasurementV1({
      snapshot: approvedSnapshot,
      leadId: 12,
      version: 4,
      supersedes: 31,
      normalizedAddress: "Lyngveien 28A, 1400 Ski",
      caseRevision: 8,
      addressRevision: 3,
      approvedBy: 17,
    });

    expect(projected).toMatchObject({
      reference: "RF-12-V4",
      lead: 12,
      version: 4,
      supersedes: 31,
      status: "approved",
      sourceKind: "roof_fusion",
      caseRevision: 8,
      addressRevision: 3,
      rfSnapshotId: approvedSnapshot.snapshotId,
      rfSnapshotHash: approvedSnapshot.snapshotHash,
      rfRendererHash: approvedSnapshot.rendererPayload.renderHash,
    });
    expect(projected.inputHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(projected.actualAreaMaxTenths).toBeGreaterThan(0);
  });

  it("hashes the complete reviewed command deterministically", () => {
    const value = request();
    expect(roofFusionOfferBridgeCommandHashV1(value)).toBe(
      roofFusionOfferBridgeCommandHashV1(structuredClone(value)),
    );
    expect(
      roofFusionOfferBridgeCommandHashV1({
        ...value,
        expectedCaseRevision: value.expectedCaseRevision + 1,
      }),
    ).not.toBe(roofFusionOfferBridgeCommandHashV1(value));

    expect(
      roofFusionOfferBridgeBindingHashV1({
        ...value,
        idempotencyKey: "rf-offer-case-12-retry",
        exceptionReason:
          "A different operator explanation for the same exact binding.",
      }),
    ).toBe(roofFusionOfferBridgeBindingHashV1(value));
    expect(
      roofFusionOfferBridgeBindingHashV1({
        ...value,
        expectedAddressRevision: value.expectedAddressRevision + 1,
      }),
    ).not.toBe(roofFusionOfferBridgeBindingHashV1(value));
  });

  it("exposes typed policy errors", () => {
    expect(
      new RoofFusionOfferBridgeErrorV1("PACKAGE_CONFLICT", "conflict")
        .suggestedHttpStatus,
    ).toBe(409);
  });
});
