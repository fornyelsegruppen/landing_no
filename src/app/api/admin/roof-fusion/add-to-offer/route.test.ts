import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertAccess: vi.fn(),
  auth: vi.fn(),
  execute: vi.fn(),
  getPayload: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: mocks.isAdmin }));
vi.mock("@/lib/roof-fusion/offer-bridge-v1", () => ({
  executeRoofFusionOfferBridgeV1: mocks.execute,
}));
vi.mock("@/lib/roof-fusion/preview-read-adapters-v1", async (original) => {
  const actual = await original<
    typeof import("@/lib/roof-fusion/preview-read-adapters-v1")
  >();
  return {
    ...actual,
    PayloadRoofFusionCaseAuthorizationV1: class {
      assertAdminCaseAccess = mocks.assertAccess;
    },
  };
});

import { POST } from "./route";

const hash = "a".repeat(64);
const body = {
  schemaVersion: "roof-fusion-offer-bridge-request.v1",
  caseId: "lead:13",
  expectedCaseRevision: 7,
  expectedAddressRevision: 2,
  snapshot: {
    snapshotId: "rf-13-r4",
    revision: 4,
    snapshotHash: hash,
    inputHash: "b".repeat(64),
    renderHash: "c".repeat(64),
  },
  idempotencyKey: "offer-lead-13-r4",
};

function request(value: unknown = body) {
  return new Request("http://localhost/api/admin/roof-fusion/add-to-offer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Correlation-ID": "corr-rf-offer-route",
    },
    body: JSON.stringify(value),
  });
}

describe("POST /api/admin/roof-fusion/add-to-offer", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ADMIN_NEXT_MODE", "preview");
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "true");
    vi.stubEnv("FEATURE_ADMIN_NEXT_RF_OFFER_BRIDGE", "true");
    mocks.auth.mockReset().mockResolvedValue({
      user: { id: 7, role: "admin", active: true, displayName: "Admin" },
    });
    mocks.getPayload.mockReset().mockResolvedValue({ auth: mocks.auth });
    mocks.isAdmin.mockReset().mockReturnValue(true);
    mocks.assertAccess.mockReset().mockResolvedValue(undefined);
    mocks.execute.mockReset().mockResolvedValue({
      schemaVersion: "roof-fusion-offer-bridge-result.v1",
      status: "applied",
      caseId: "lead:13",
      snapshot: body.snapshot,
      measurement: { id: 31, version: 2, inputHash: hash },
      quote: { id: 41, version: 3 },
      contractId: 51,
      customerSideEffects: "none",
      offerHref: "/admin-next-preview/cases/13?focus=offer-41",
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["production", "true"],
    ["preview", "false"],
  ])(
    "fails closed before Payload/auth in %s when bridge flag is %s",
    async (vercelEnvironment, flag) => {
      vi.stubEnv("VERCEL_ENV", vercelEnvironment);
      vi.stubEnv("FEATURE_ADMIN_NEXT_RF_OFFER_BRIDGE", flag);

      const response = await POST(request());

      expect(response.status).toBe(404);
      expect(mocks.getPayload).not.toHaveBeenCalled();
      expect(mocks.auth).not.toHaveBeenCalled();
      expect(mocks.execute).not.toHaveBeenCalled();
    },
  );

  it("authorizes the exact case and keeps actor/correlation server-owned", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.assertAccess).toHaveBeenCalledWith(
      "lead:13",
      expect.objectContaining({ id: 7 }),
    );
    expect(mocks.execute).toHaveBeenCalledWith({
      payload: { auth: mocks.auth },
      request: body,
      actorId: 7,
      actorDisplayName: "Admin",
      correlationId: "corr-rf-offer-route",
    });
  });

  it("rejects malformed commands before Payload initialization", async () => {
    const response = await POST(request({ ...body, unexpected: true }));

    expect(response.status).toBe(400);
    expect(mocks.getPayload).not.toHaveBeenCalled();
  });

  it("returns 200 for an exact idempotent replay", async () => {
    mocks.execute.mockResolvedValue({
      ...(await mocks.execute()),
      status: "replayed",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "replayed",
      customerSideEffects: "none",
    });
  });
});
