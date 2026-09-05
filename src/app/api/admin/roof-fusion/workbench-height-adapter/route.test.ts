import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isAdmin: vi.fn(),
  assertCase: vi.fn(),
  readDraft: vi.fn(),
  invoke: vi.fn(),
  previewError: class extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  adapterError: class extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  sourceIntegrityError: class extends Error {},
}));

const storedDraft = {
  draftId: "draft-1",
  caseId: "lead:13",
  draftHash: "a".repeat(64),
  actor: { actorId: "7" },
};

const confidence = {
  level: "medium",
  score: 0.72,
  basis: "derived",
  rationale: "Test fixture confidence",
};

function measurement(unit: "m" | "m2" | "deg", value: number) {
  return {
    mode: "exact",
    unit,
    min: value,
    max: value,
    sourceRefs: ["source-1"],
    confidence,
  };
}

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
    return { readDraft: mocks.readDraft };
  }),
}));
vi.mock("@/lib/roof-fusion/workbench-height-adapter-v1", () => ({
  invokeWorkbenchHeightAdapterV1: mocks.invoke,
  RoofFusionWorkbenchHeightAdapterErrorV1: mocks.adapterError,
}));
vi.mock("@/lib/roof-fusion/source-adapter-v1", () => ({
  RoofSourceIntegrityError: mocks.sourceIntegrityError,
}));

import { POST } from "./route";

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify({
      caseId: "lead:13",
      draftId: "draft-1",
      draftHash: "a".repeat(64),
      targetSnapshotId: "snapshot-1",
      idempotencyKey: "height-adapter:13:1",
      heightSurface: {},
      orthophoto: {},
      ...overrides,
    }),
  });
}

describe("POST /api/admin/roof-fusion/workbench-height-adapter", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.isAdmin.mockReset();
    mocks.assertCase.mockReset();
    mocks.readDraft.mockReset();
    mocks.invoke.mockReset();
    mocks.auth.mockResolvedValue({ user: { id: 7, role: "admin" } });
    mocks.isAdmin.mockReturnValue(true);
  });

  it("invokes the height adapter only for the stored, authorized draft revision", async () => {
    mocks.readDraft.mockResolvedValue(storedDraft);
    mocks.invoke.mockReturnValue({
      summary: { status: "review_required", pricingReady: false, blockers: [] },
      snapshot: {
        snapshotId: "snapshot-1",
        snapshotHash: "b".repeat(64),
        revision: 2,
        state: "review_required",
        measurement: {
          method: "manual_workbench",
          class: "preliminary",
          confidence,
        },
        totals: {
          grossHorizontalArea: measurement("m2", 100),
          grossSurfaceArea: measurement("m2", 112),
          netSurfaceArea: measurement("m2", 109),
          footprintPerimeter: measurement("m", 42),
        },
        geometry: {
          vertices: [
            {
              vertexId: "vertex-1",
              xM: 0,
              yM: 0,
              zM: 10,
              uncertaintyM: 0.25,
              sourceRefs: ["source-1"],
            },
            {
              vertexId: "vertex-2",
              xM: 10,
              yM: 0,
              zM: 10,
              uncertaintyM: 0.25,
              sourceRefs: ["source-1"],
            },
            {
              vertexId: "vertex-3",
              xM: 0,
              yM: 10,
              zM: 14,
              uncertaintyM: 0.25,
              sourceRefs: ["source-1"],
            },
          ],
          contours: [
            {
              contourId: "contour-1",
              kind: "surface_boundary",
              vertexIds: ["vertex-1", "vertex-2", "vertex-3"],
              sourceRefs: ["source-1"],
            },
          ],
          surfaces: [
            {
              surfaceId: "surface-1",
              outerContourId: "contour-1",
              openingIds: [],
              edgeIds: ["edge-1"],
              azimuthDegrees: 180,
              pitch: measurement("deg", 26),
              grossHorizontalArea: measurement("m2", 100),
              grossSurfaceArea: measurement("m2", 112),
              netSurfaceArea: measurement("m2", 109),
              quality: "estimated",
              sourceRefs: ["source-1"],
            },
          ],
          edges: [
            {
              edgeId: "edge-1",
              fromVertexId: "vertex-1",
              toVertexId: "vertex-2",
              adjacentSurfaceIds: ["surface-1"],
              type: "eave",
              length2d: measurement("m", 10),
              length3d: measurement("m", 10),
              gutterCandidate: true,
              quality: "estimated",
              sourceRefs: ["source-1"],
            },
          ],
        },
        provenance: {
          sources: [
            {
              sourceId: "source-1",
              kind: "lidar",
              provider: "Kartverket",
              retrievedAt: "2026-09-04T08:00:00.000Z",
              rawContentHash: "c".repeat(64),
              license: {
                status: "authorized",
                name: "NLOD 2.0",
                attribution: "Kartverket",
              },
              visibility: "customer_safe",
              quality: {
                status: "usable",
                score: 0.9,
                reasons: ["Test fixture"],
              },
            },
          ],
          observations: [
            {
              observationId: "observation-1",
              kind: "surface_pitch",
              targetRef: "surface-1",
              value: 26,
              status: "accepted",
              sourceRefs: ["source-1"],
              confidence,
              reasons: ["Test fixture"],
            },
          ],
        },
      },
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "review_required",
      pricingReady: false,
      metrics: {
        horizontalAreaSquareMeters: 100,
        totalSurfaceAreaSquareMeters: 112,
        averageSlopeDegrees: 26,
        footprintPerimeterMeters: 42,
      },
      detailedResult: {
        schemaVersion: "roof-fusion-workbench-detailed-result.v1",
        usage: "preview_only",
        pricingReady: false,
        snapshot: {
          snapshotId: "snapshot-1",
          snapshotHash: "b".repeat(64),
          revision: 2,
        },
        vertices: [
          {
            vertexId: "vertex-1",
            xM: 0,
            yM: 0,
            zM: 10,
            uncertaintyM: 0.25,
            sourceRefs: ["source-1"],
          },
          {
            vertexId: "vertex-2",
            xM: 10,
            yM: 0,
            zM: 10,
            uncertaintyM: 0.25,
            sourceRefs: ["source-1"],
          },
          {
            vertexId: "vertex-3",
            xM: 0,
            yM: 10,
            zM: 14,
            uncertaintyM: 0.25,
            sourceRefs: ["source-1"],
          },
        ],
        contours: [
          {
            contourId: "contour-1",
            kind: "surface_boundary",
            vertexIds: ["vertex-1", "vertex-2", "vertex-3"],
            sourceRefs: ["source-1"],
          },
        ],
        surfaces: [
          {
            surfaceId: "surface-1",
            edgeIds: ["edge-1"],
            pitch: { min: 26, max: 26, confidence },
          },
        ],
        edges: [
          {
            edgeId: "edge-1",
            type: "eave",
            adjacentSurfaceIds: ["surface-1"],
          },
        ],
        sources: [
          {
            sourceId: "source-1",
            provider: "Kartverket",
            rawContentHash: "c".repeat(64),
          },
        ],
      },
    });
    expect(mocks.readDraft).toHaveBeenCalledWith("lead:13", "draft-1");
    expect(mocks.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: storedDraft,
        heightSurface: {},
        orthophoto: {},
      }),
    );
  });

  it("fails closed before invocation if the case draft hash is stale", async () => {
    mocks.readDraft.mockResolvedValue({
      ...storedDraft,
      draftHash: "b".repeat(64),
    });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it.each(["missing orthophoto georef", "missing complete height grid"])(
    "returns a reviewable trusted-input error for %s",
    async () => {
      mocks.readDraft.mockResolvedValue(storedDraft);
      mocks.invoke.mockImplementation(() => {
        throw new mocks.adapterError(
          "TRUSTED_INPUT_REQUIRED",
          "Complete EPSG:25833 evidence is required",
        );
      });

      const response = await POST(request());

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        code: "TRUSTED_INPUT_REQUIRED",
      });
    },
  );

  it("maps source-integrity failures to a stable sanitized code", async () => {
    mocks.readDraft.mockResolvedValue(storedDraft);
    mocks.invoke.mockImplementation(() => {
      throw new mocks.sourceIntegrityError(
        "Duplicate declared roof source records: secret-provider-id",
      );
    });

    const response = await POST(request());

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toMatchObject({ code: "SOURCE_INTEGRITY_INVALID" });
    expect(body.error).not.toContain("secret-provider-id");
  });

  it("maps invalid calculated output to a stable code", async () => {
    mocks.readDraft.mockResolvedValue(storedDraft);
    mocks.invoke.mockImplementation(() => {
      throw new z.ZodError([]);
    });

    const response = await POST(request());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "HEIGHT_CALCULATION_INVALID",
    });
  });

  it("fails closed for a caller that is not an administrator", async () => {
    mocks.isAdmin.mockReturnValue(false);

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.readDraft).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
