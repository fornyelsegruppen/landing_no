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
  assertCase: vi.fn(),
  previewError: class extends Error {
    constructor(readonly code: string, message: string) {
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
      bounds: { minEastingM: 500000, minNorthingM: 6640000, maxEastingM: 500010, maxNorthingM: 6640010 },
      imageWidth: 1920,
      imageHeight: 1080,
    },
  },
  geometry: {
    schemaVersion: ASSISTED_MANUAL_ROOF_GEOMETRY_SCHEMA_VERSION,
    coordinateSystem: { kind: "projected_crs", reference: "EPSG:25833", axisOrder: "easting_northing" },
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
    roofMasses: [{ massId: "mass-test", outlineId: "outline-test", approvedByActorId: "7", approvedAt: "2026-09-03T08:00:00.000Z", vertexIds: ["v1", "v2", "v3", "v4"] }],
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
    return { appendAtomically: mocks.append };
  }),
  RoofFusionWorkbenchDraftRepositoryError: class extends Error {},
}));

import { POST } from "./route";

describe("POST /api/admin/roof-fusion/workbench-draft", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.isAdmin.mockReset();
    mocks.append.mockReset();
    mocks.assertCase.mockReset();
    mocks.auth.mockResolvedValue({ user: { id: 7, role: "admin" } });
    mocks.isAdmin.mockReturnValue(true);
  });

  it("fails closed for an unauthenticated caller", async () => {
    mocks.auth.mockResolvedValue({ user: null });
    const response = await POST(new Request("http://localhost/api", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("fails closed for a non-admin caller", async () => {
    mocks.isAdmin.mockReturnValue(false);
    const response = await POST(new Request("http://localhost/api", { method: "POST", body: "{}" }));
    expect(response.status).toBe(403);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("rejects malformed draft input before any persistence", async () => {
    const response = await POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ draft: {} }) }));
    expect(response.status).toBe(400);
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("fails closed when the case is not authorized", async () => {
    mocks.assertCase.mockRejectedValue(new mocks.previewError("CASE_NOT_FOUND", "Case does not exist"));
    const response = await POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ draft: validDraft }) }));
    expect(response.status).toBe(404);
    expect(mocks.append).not.toHaveBeenCalled();
  });
});
