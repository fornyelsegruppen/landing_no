import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRoofFusionWorkbenchDraftV1,
  ROOF_FUSION_WORKBENCH_DRAFT_SCHEMA_VERSION,
} from "@/lib/roof-fusion/workbench-draft-contract-v1";
import { ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION } from "@/lib/roof-fusion/assisted-manual-roof-geometry-v1";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isAdmin: vi.fn(),
  append: vi.fn(),
  readDraft: vi.fn(),
  readLatest: vi.fn(),
  assertCase: vi.fn(),
  previewError: class extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const validDraft = buildRoofFusionWorkbenchDraftV1({
  schemaVersion: ROOF_FUSION_WORKBENCH_DRAFT_SCHEMA_VERSION,
  draftId: "draft-case-test",
  caseId: "lead:999",
  revision: 1,
  idempotencyKey: "workbench:case-test:1",
  state: "review_required",
  actor: { actorId: "7", actorType: "administrator" },
  createdAt: "2026-09-03T08:00:00.000Z",
  source: {
    sourceId: "norge-capture-test",
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
      imageWidth: 1920,
      imageHeight: 1080,
    },
  },
  geometry: {
    schemaVersion: ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
    coordinateSystem: {
      kind: "projected_crs",
      reference: "EPSG:25833",
      axisOrder: "easting_northing",
    },
    vertices: [
      { vertexId: "v1", xM: 500000, yM: 6640000 },
      { vertexId: "v2", xM: 500010, yM: 6640000 },
      { vertexId: "v3", xM: 500010, yM: 6640010 },
      { vertexId: "v4", xM: 500000, yM: 6640010 },
    ],
    sourceFootprint: {
      footprintId: "footprint-test",
      sourceId: "norge-capture-test",
      sourceContentHash: "a".repeat(64),
      points: [
        { xM: 500000, yM: 6640000 },
        { xM: 500010, yM: 6640000 },
        { xM: 500010, yM: 6640010 },
        { xM: 500000, yM: 6640010 },
      ],
    },
    roofMasses: [
      {
        massId: "mass-test",
        outlineId: "outline-test",
        approvedByActorId: "7",
        approvedAt: "2026-09-03T08:00:00.000Z",
        vertexIds: ["v1", "v2", "v3", "v4"],
      },
    ],
    skeletonEdges: [],
    openings: [],
    obstacles: [],
  },
  blockers: [],
});

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({ auth: mocks.auth })),
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: mocks.isAdmin }));
vi.mock("@/lib/roof-fusion/preview-read-adapters-v1", () => ({
  assertRoofFusionPreviewEnabledV1: vi.fn(),
  RoofFusionPreviewReadErrorV1: mocks.previewError,
  PayloadRoofFusionCaseAuthorizationV1: vi.fn(function () {
    return { assertAdminCaseAccess: mocks.assertCase };
  }),
}));
vi.mock("@/lib/roof-fusion/workbench-draft-repository-v1", () => ({
  PayloadRoofFusionWorkbenchDraftRepositoryV1: vi.fn(function () {
    return {
      appendAtomically: mocks.append,
      readDraft: mocks.readDraft,
      readLatestDraft: mocks.readLatest,
    };
  }),
  RoofFusionWorkbenchDraftRepositoryError: class extends Error {},
}));

import { GET, POST } from "./route";

describe("POST /api/admin/roof-fusion/workbench-draft", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.isAdmin.mockReset();
    mocks.append.mockReset();
    mocks.readDraft.mockReset();
    mocks.readLatest.mockReset();
    mocks.assertCase.mockReset();
    mocks.auth.mockResolvedValue({ user: { id: 7, role: "admin" } });
    mocks.isAdmin.mockReturnValue(true);
  });

  it("fails closed for an unauthenticated caller", async () => {
    mocks.auth.mockResolvedValue({ user: null });
    const response = await POST(
      new Request("http://localhost/api", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(401);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("fails closed for a non-admin caller", async () => {
    mocks.isAdmin.mockReturnValue(false);
    const response = await POST(
      new Request("http://localhost/api", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(403);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("rejects malformed draft input before any persistence", async () => {
    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ draft: {} }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("returns the safe semantic code for a skeleton endpoint outside its mass", async () => {
    const invalidDraft = structuredClone(validDraft);
    invalidDraft.geometry.vertices.push({
      vertexId: "ridge-outside",
      xM: 500_010.01,
      yM: 6_640_005,
    });
    invalidDraft.geometry.skeletonEdges.push({
      edgeId: "ridge-test",
      roofMassId: "mass-test",
      fromVertexId: "v1",
      toVertexId: "ridge-outside",
      type: "ridge",
      provenance: "manual",
    });

    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ draft: invalidDraft }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "SKELETON_ENDPOINT_OUTSIDE_MASS",
      error: "Workbench geometry failed validation",
    });
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("fails closed when the case is not authorized", async () => {
    mocks.assertCase.mockRejectedValue(
      new mocks.previewError("CASE_NOT_FOUND", "Case does not exist"),
    );
    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ draft: validDraft }),
      }),
    );
    expect(response.status).toBe(404);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("confirms an applied case-scoped CAS append with its idempotency key", async () => {
    mocks.append.mockResolvedValue("applied");

    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ draft: validDraft, expectedLatest: null }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      status: "applied",
      confirmation: {
        kind: "case_scoped_cas_idempotency.v1",
        caseId: "lead:999",
        idempotencyKey: "workbench:case-test:1",
        status: "applied",
        latest: { draftId: "draft-case-test", revision: 1 },
      },
    });
    expect(mocks.append).toHaveBeenCalledWith({
      draft: validDraft,
      expectedLatest: null,
    });
  });

  it("appends a start-new session as a new revision and keeps the previous draft addressable", async () => {
    const nextDraft = buildRoofFusionWorkbenchDraftV1({
      ...validDraft,
      draftId: "draft-case-test-new-session",
      revision: 2,
      supersedesDraftId: validDraft.draftId,
      idempotencyKey: "workbench:case-test:new-session:2",
      createdAt: "2026-09-04T09:00:00.000Z",
      geometry: { ...validDraft.geometry, skeletonEdges: [] },
    });
    const expectedLatest = {
      draftId: validDraft.draftId,
      revision: validDraft.revision,
      draftHash: validDraft.draftHash,
      state: validDraft.state,
    };
    mocks.append.mockResolvedValue("applied");

    const response = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ draft: nextDraft, expectedLatest }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.append).toHaveBeenCalledWith({
      draft: nextDraft,
      expectedLatest,
    });
    expect(nextDraft.draftId).not.toBe(validDraft.draftId);
    expect(nextDraft.supersedesDraftId).toBe(validDraft.draftId);

    mocks.readDraft.mockResolvedValue(validDraft);
    const previous = await GET(
      new Request(
        `http://localhost/api?caseId=lead%3A999&draftId=${validDraft.draftId}`,
      ),
    );
    await expect(previous.json()).resolves.toMatchObject({ draft: validDraft });
    expect(mocks.readDraft).toHaveBeenCalledWith(
      validDraft.caseId,
      validDraft.draftId,
    );
  });

  it("loads only the authorized case's latest append-only draft", async () => {
    mocks.readLatest.mockResolvedValue(validDraft);

    const response = await GET(
      new Request("http://localhost/api?caseId=lead%3A999"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ draft: validDraft });
    expect(mocks.assertCase).toHaveBeenCalledWith(
      "lead:999",
      expect.anything(),
    );
    expect(mocks.readLatest).toHaveBeenCalledWith("lead:999");
    expect(mocks.readDraft).not.toHaveBeenCalled();
  });

  it("does not reveal a draft before administrator authorization", async () => {
    mocks.auth.mockResolvedValue({ user: null });

    const response = await GET(
      new Request("http://localhost/api?caseId=lead%3A999"),
    );

    expect(response.status).toBe(401);
    expect(mocks.readLatest).not.toHaveBeenCalled();
  });
});
