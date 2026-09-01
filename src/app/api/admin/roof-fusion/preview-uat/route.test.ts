import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  getPayload: vi.fn(),
  prepare: vi.fn(),
  repository: { kind: "payload-roof-fusion-repository" },
}));

vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/lib/roof-fusion/payload-repository-v1", () => ({
  PayloadRoofSnapshotRepositoryV1: vi.fn(function () {
    return mocks.repository;
  }),
}));
vi.mock("@/lib/roof-fusion/preview-uat-golden-v1", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/lib/roof-fusion/preview-uat-golden-v1")
    >();
  return {
    ...original,
    prepareRoofFusionPreviewUatGoldenV1: mocks.prepare,
  };
});

import { POST } from "./route";

const admin = { active: true, id: 7, role: "admin" };

function request(caseReference = "TF-13") {
  return new Request(
    "https://preview.example.invalid/api/admin/roof-fusion/preview-uat",
    {
      body: JSON.stringify({
        caseReference,
        confirmation: "prepare-roof-fusion-preview-uat-golden.v1",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
}

describe("POST /api/admin/roof-fusion/preview-uat", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "true");
    mocks.auth.mockReset().mockResolvedValue({ user: admin });
    mocks.findByID.mockReset().mockResolvedValue({ id: 13, name: "UAT Lead" });
    mocks.getPayload.mockReset().mockResolvedValue({
      auth: mocks.auth,
      findByID: mocks.findByID,
    });
    mocks.prepare.mockReset().mockResolvedValue({
      schemaVersion: "roof-fusion-preview-uat-golden.v1",
      status: "prepared",
      snapshot: {
        measurementClass: "verified_geometry",
        revision: 3,
        snapshotHash: "a".repeat(64),
        snapshotId: "rf-uat-lead-13-r3-approved",
        state: "approved",
      },
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("binds an authenticated admin and explicit TF-to-lead identity", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      caseReference: "TF-13",
      previewHref:
        "/admin-next-preview/cases/TF-13/measurements/rf-uat-lead-13-r3-approved",
      status: "prepared",
    });
    expect(mocks.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "leads", id: 13 }),
    );
    expect(mocks.prepare).toHaveBeenCalledWith({
      repository: mocks.repository,
      leadId: 13,
    });
  });

  it("returns an idempotent success status for an existing golden", async () => {
    mocks.prepare.mockResolvedValue({
      schemaVersion: "roof-fusion-preview-uat-golden.v1",
      status: "already_prepared",
      snapshot: {
        measurementClass: "verified_geometry",
        revision: 3,
        snapshotHash: "a".repeat(64),
        snapshotId: "rf-uat-lead-13-r3-approved",
        state: "approved",
      },
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "already_prepared",
    });
  });

  it("requires an explicit UAT preparation confirmation", async () => {
    const response = await POST(
      new Request(
        "https://preview.example.invalid/api/admin/roof-fusion/preview-uat",
        {
          body: JSON.stringify({ caseReference: "TF-13" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      ),
    );
    expect(response.status).toBe(400);
    expect(mocks.getPayload).not.toHaveBeenCalled();
  });

  it("denies workers and nonexistent cases", async () => {
    mocks.auth.mockResolvedValue({
      user: { active: true, id: 8, role: "worker" },
    });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.prepare).not.toHaveBeenCalled();

    mocks.auth.mockResolvedValue({ user: admin });
    mocks.findByID.mockRejectedValue(new Error("not found"));
    expect((await POST(request())).status).toBe(404);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("denies Production before authentication or persistence access", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
});
