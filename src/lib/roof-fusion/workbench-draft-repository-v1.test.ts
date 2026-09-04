import { describe, expect, it } from "vitest";
import {
  ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
  type AssistedManualRoofGeometryV1,
} from "./assisted-manual-roof-geometry-v1";
import {
  buildRoofFusionWorkbenchDraftV1,
  ROOF_FUSION_WORKBENCH_DRAFT_SCHEMA_VERSION,
} from "./workbench-draft-contract-v1";
import {
  InMemoryRoofFusionWorkbenchDraftRepositoryV1,
  RoofFusionWorkbenchDraftRepositoryError,
} from "./workbench-draft-repository-v1";
import { buildWorkbenchDraftRecoveryBindingV1 } from "./workbench-draft-recovery-v1";

const hash = "a".repeat(64);
const actor = { actorId: "7", actorType: "administrator" as const };

function geometry(): AssistedManualRoofGeometryV1 {
  return {
    schemaVersion: ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
    coordinateSystem: {
      kind: "projected_crs",
      reference: "EPSG:25833",
      axisOrder: "easting_northing",
    },
    vertices: [
      { vertexId: "v1", xM: 500000, yM: 6640000 },
      { vertexId: "v2", xM: 500010, yM: 6640000 },
      { vertexId: "v3", xM: 500010, yM: 6640008 },
      { vertexId: "v4", xM: 500000, yM: 6640008 },
      { vertexId: "ridge1", xM: 500005, yM: 6640001 },
      { vertexId: "ridge2", xM: 500005, yM: 6640007 },
    ],
    sourceFootprint: {
      footprintId: "footprint-1",
      sourceId: "norge-capture-1",
      sourceContentHash: hash,
      points: [
        { xM: 500000, yM: 6640000 },
        { xM: 500010, yM: 6640000 },
        { xM: 500010, yM: 6640008 },
        { xM: 500000, yM: 6640008 },
      ],
    },
    roofMasses: [
      {
        massId: "mass-1",
        outlineId: "outline-1",
        approvedByActorId: "7",
        approvedAt: "2026-09-03T08:00:00.000Z",
        vertexIds: ["v1", "v2", "v3", "v4"],
      },
    ],
    skeletonEdges: [
      {
        edgeId: "ridge-1",
        roofMassId: "mass-1",
        fromVertexId: "ridge1",
        toVertexId: "ridge2",
        type: "ridge",
        provenance: "manual",
      },
    ],
    openings: [],
    obstacles: [],
  };
}

function draft(revision = 1, overrides: Record<string, unknown> = {}) {
  return buildRoofFusionWorkbenchDraftV1({
    schemaVersion: ROOF_FUSION_WORKBENCH_DRAFT_SCHEMA_VERSION,
    draftId: `draft-${revision}`,
    caseId: "lead:13",
    revision,
    ...(revision > 1 ? { supersedesDraftId: `draft-${revision - 1}` } : {}),
    idempotencyKey: `workbench:lead-13:${revision}`,
    state: "review_required",
    actor,
    createdAt: `2026-09-03T08:0${revision}:00.000Z`,
    source: {
      sourceId: "norge-capture-1",
      sourceContentHash: hash,
      attribution: "©norgeibilder.no",
      georeference: {
        crs: "EPSG:25833",
        extentTrust: "actual-visible-extent",
        bounds: {
          minEastingM: 499990,
          minNorthingM: 6639990,
          maxEastingM: 500020,
          maxNorthingM: 6640020,
        },
        imageWidth: 1920,
        imageHeight: 1080,
      },
    },
    geometry: geometry(),
    blockers: [],
    ...overrides,
  });
}

describe("Roof Fusion workbench draft repository v1", () => {
  it("stores a recovery binding beside a new draft while legacy appends remain null", async () => {
    const repository = new InMemoryRoofFusionWorkbenchDraftRepositoryV1();
    const first = draft();
    const recoveryBinding = buildWorkbenchDraftRecoveryBindingV1({
      draft: first,
      addressRevision: 2,
    });
    await repository.appendAtomically({
      expectedLatest: null,
      draft: first,
      recoveryBinding,
    });
    expect(await repository.readLatestDraftRecoveryRecord("lead:13")).toEqual({
      draft: first,
      recoveryBinding,
    });

    const legacyRepository = new InMemoryRoofFusionWorkbenchDraftRepositoryV1();
    await legacyRepository.appendAtomically({
      expectedLatest: null,
      draft: first,
    });
    expect(
      (await legacyRepository.readLatestDraftRecoveryRecord("lead:13"))
        ?.recoveryBinding,
    ).toBeNull();
  });

  it("appends consecutive revisions and replays the same idempotent command", async () => {
    const repository = new InMemoryRoofFusionWorkbenchDraftRepositoryV1();
    const first = draft();
    expect(
      await repository.appendAtomically({ expectedLatest: null, draft: first }),
    ).toBe("applied");
    expect(
      await repository.appendAtomically({ expectedLatest: null, draft: first }),
    ).toBe("replayed");
    const second = draft(2);
    expect(
      await repository.appendAtomically({
        expectedLatest: {
          draftId: first.draftId,
          revision: first.revision,
          draftHash: first.draftHash,
          state: first.state,
        },
        draft: second,
      }),
    ).toBe("applied");
    expect((await repository.readLatestDraft("lead:13"))?.revision).toBe(2);
  });

  it("rejects a stale revision expected latest", async () => {
    const repository = new InMemoryRoofFusionWorkbenchDraftRepositoryV1();
    const first = draft();
    await repository.appendAtomically({ expectedLatest: null, draft: first });
    await expect(
      repository.appendAtomically({
        expectedLatest: {
          draftId: first.draftId,
          revision: 99,
          draftHash: first.draftHash,
          state: first.state,
        },
        draft: draft(2),
      }),
    ).rejects.toMatchObject({ code: "EXPECTED_REVISION_MISMATCH" });
  });

  it("rejects a stale hash expected latest", async () => {
    const repository = new InMemoryRoofFusionWorkbenchDraftRepositoryV1();
    const first = draft();
    await repository.appendAtomically({ expectedLatest: null, draft: first });
    await expect(
      repository.appendAtomically({
        expectedLatest: {
          draftId: first.draftId,
          revision: first.revision,
          draftHash: "b".repeat(64),
          state: first.state,
        },
        draft: draft(2),
      }),
    ).rejects.toMatchObject({ code: "STALE_DRAFT_HASH" });
  });

  it("rejects a broken append-only revision lineage", async () => {
    const repository = new InMemoryRoofFusionWorkbenchDraftRepositoryV1();
    const first = draft();
    await repository.appendAtomically({ expectedLatest: null, draft: first });
    await expect(
      repository.appendAtomically({
        expectedLatest: {
          draftId: first.draftId,
          revision: first.revision,
          draftHash: first.draftHash,
          state: first.state,
        },
        draft: draft(2, { supersedesDraftId: "different-draft" }),
      }),
    ).rejects.toMatchObject({ code: "REPOSITORY_INTEGRITY" });
  });

  it("rejects idempotency reuse and invalid georef while allowing independent source hashes", async () => {
    const repository = new InMemoryRoofFusionWorkbenchDraftRepositoryV1();
    const first = draft();
    await repository.appendAtomically({ expectedLatest: null, draft: first });
    const different = draft(2, { idempotencyKey: first.idempotencyKey });
    await expect(
      repository.appendAtomically({ expectedLatest: null, draft: different }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const distinctSources = draft(1, {
      source: { ...first.source, sourceContentHash: "b".repeat(64) },
    });
    expect(distinctSources.source.sourceContentHash).not.toBe(
      distinctSources.geometry.sourceFootprint.sourceContentHash,
    );
    expect(() =>
      draft(1, {
        source: {
          ...first.source,
          georeference: {
            ...first.source.georeference,
            extentTrust: "planned-url-bounds",
          },
        },
      }),
    ).toThrow();
  });

  it("fails closed for invalid topology before repository append", () => {
    expect(() =>
      draft(1, {
        geometry: {
          ...geometry(),
          roofMasses: [
            { ...geometry().roofMasses[0], vertexIds: ["v1", "v1", "v2"] },
          ],
        },
      }),
    ).toThrow();
    expect(RoofFusionWorkbenchDraftRepositoryError).toBeDefined();
  });
});
