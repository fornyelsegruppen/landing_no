import { describe, expect, it } from "vitest";
import { buildRoofFusionWorkbenchDraftV1 } from "./workbench-draft-contract-v1";
import {
  buildWorkbenchDraftRecoveryBindingV1,
  currentWorkbenchDraftRecoveryContextV1,
  parseWorkbenchDraftRecoveryRecordV1,
  serializeWorkbenchDraftRecoveryRecordV1,
} from "./workbench-draft-recovery-v1";

function draft() {
  return buildRoofFusionWorkbenchDraftV1({
    schemaVersion: "roof-fusion-workbench-draft.v1",
    draftId: "draft-1",
    caseId: "lead:13",
    revision: 1,
    idempotencyKey: "workbench:lead-13:1",
    state: "review_required",
    actor: { actorId: "7", actorType: "administrator" },
    createdAt: "2026-09-04T08:00:00.000Z",
    source: {
      sourceId: "capture-1",
      sourceContentHash: "a".repeat(64),
      attribution: "©norgeibilder.no",
      georeference: {
        crs: "EPSG:25833",
        extentTrust: "actual-visible-extent",
        bounds: {
          minEastingM: 500000,
          minNorthingM: 6640000,
          maxEastingM: 500010,
          maxNorthingM: 6640010,
        },
        imageWidth: 1000,
        imageHeight: 1000,
      },
    },
    geometry: {
      schemaVersion: "assisted-manual-roof-geometry.v1",
      coordinateSystem: {
        kind: "projected_crs",
        reference: "EPSG:25833",
        axisOrder: "easting_northing",
      },
      vertices: [
        { vertexId: "v1", xM: 500000, yM: 6640000 },
        { vertexId: "v2", xM: 500010, yM: 6640000 },
        { vertexId: "v3", xM: 500010, yM: 6640010 },
      ],
      sourceFootprint: {
        footprintId: "footprint-1",
        sourceId: "osm:way/1",
        sourceContentHash: "b".repeat(64),
        points: [
          { xM: 500000, yM: 6640000 },
          { xM: 500010, yM: 6640000 },
          { xM: 500010, yM: 6640010 },
        ],
      },
      roofMasses: [
        {
          massId: "mass-1",
          outlineId: "outline-1",
          approvedByActorId: "7",
          approvedAt: "2026-09-04T08:00:00.000Z",
          vertexIds: ["v1", "v2", "v3"],
        },
      ],
      skeletonEdges: [],
      openings: [],
      obstacles: [],
    },
    blockers: [],
  });
}

describe("workbench draft recovery persistence", () => {
  it("round-trips an exact PII-minimal binding beside the immutable draft", () => {
    const value = draft();
    const binding = buildWorkbenchDraftRecoveryBindingV1({
      draft: value,
      addressRevision: 3,
    });
    const stored = serializeWorkbenchDraftRecoveryRecordV1({
      draft: value,
      recoveryBinding: binding,
    });

    expect(parseWorkbenchDraftRecoveryRecordV1(stored)).toEqual({
      draft: value,
      recoveryBinding: binding,
    });
    expect(binding).toMatchObject({
      case: { caseId: "lead:13", addressRevision: 3 },
      draft: { id: value.draftId, revision: 1, hash: value.draftHash },
      source: { id: "capture-1", revision: 1, hash: "a".repeat(64) },
      snapshot: { id: value.draftId, revision: 1, hash: value.geometryHash },
    });
    expect(JSON.stringify(stored)).not.toContain("addressLabel");
  });

  it("treats historical direct draft JSON as legacy and non-resumable", () => {
    expect(
      parseWorkbenchDraftRecoveryRecordV1(draft()).recoveryBinding,
    ).toBeNull();
  });

  it("makes address and visible source changes produce a different current context", () => {
    const value = draft();
    const recoveryBinding = buildWorkbenchDraftRecoveryBindingV1({
      draft: value,
      addressRevision: 3,
    });
    const record = { draft: value, recoveryBinding };

    expect(
      currentWorkbenchDraftRecoveryContextV1({
        record,
        addressRevision: 4,
        currentSource: { id: "capture-2", hash: "c".repeat(64) },
      }),
    ).toMatchObject({
      case: { addressRevision: 4 },
      source: { id: "capture-2", revision: 2, hash: "c".repeat(64) },
    });
  });

  it("rejects an envelope whose recovery pin disagrees with its draft", () => {
    const value = draft();
    const recoveryBinding = buildWorkbenchDraftRecoveryBindingV1({
      draft: value,
      addressRevision: 3,
    });
    expect(() =>
      parseWorkbenchDraftRecoveryRecordV1({
        schemaVersion: "roof-fusion-workbench-draft-recovery-record.v1",
        draft: value,
        recoveryBinding: {
          ...recoveryBinding,
          draft: { ...recoveryBinding.draft, hash: "f".repeat(64) },
        },
      }),
    ).toThrow("does not match its exact draft");
  });
});
