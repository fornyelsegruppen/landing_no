import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertFeatureReady: vi.fn(),
  auth: vi.fn(),
  rebuild: vi.fn(),
  audit: vi.fn(),
  claim: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  userIsAdmin: vi.fn(),
  FeatureUnavailableError: class FeatureUnavailableError extends Error {
    constructor(
      readonly feature: string,
      readonly reason: "disabled" | "configuration_required",
      readonly unavailable: string[] = [],
    ) {
      super(`Feature ${feature} is ${reason}`);
    }
  },
}));
vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({ auth: mocks.auth })),
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: mocks.userIsAdmin }));
vi.mock("@/lib/platform/features", () => ({
  assertFeatureReady: mocks.assertFeatureReady,
  FeatureUnavailableError: mocks.FeatureUnavailableError,
}));
vi.mock("@/lib/pricing/commercial-package", () => ({
  rebuildCommercialPackage: mocks.rebuild,
}));
vi.mock("@/lib/pricing/commercial-package-request", () => ({
  claimCommercialPackageRequest: mocks.claim,
  completeCommercialPackageRequest: mocks.complete,
  failCommercialPackageRequest: mocks.fail,
}));
vi.mock("@/lib/audit/payload-audit-writer", () => ({
  createPayloadAuditWriter: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: mocks.audit }));

import { POST } from "./route";

describe("commercial package API", () => {
  beforeEach(() => {
    mocks.auth
      .mockReset()
      .mockResolvedValue({ user: { id: 9, role: "admin" } });
    mocks.assertFeatureReady.mockReset();
    mocks.userIsAdmin.mockReset().mockReturnValue(true);
    mocks.rebuild.mockReset().mockResolvedValue({
      sourceQuoteId: 1,
      base: { quote: { id: 2, reference: "T-7-V2" } },
      recommended: { quote: { id: 3, reference: "T-7-V3" } },
    });
    mocks.audit.mockReset().mockResolvedValue(undefined);
    mocks.claim.mockReset().mockResolvedValue({ kind: "claimed", jobId: 41 });
    mocks.complete.mockReset().mockResolvedValue(undefined);
    mocks.fail.mockReset().mockResolvedValue(undefined);
  });

  it("creates audited base and recommended options", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(201);
    expect(mocks.rebuild).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        administratorId: 9,
        expectedRevision: 12,
        leadId: 7,
        recommendedServiceKey: "takvask_impregnering",
        sourceQuoteId: 1,
      }),
    );
    expect(mocks.audit).toHaveBeenCalled();
    expect(mocks.complete).toHaveBeenCalledWith(expect.anything(), 41, {
      baseQuoteId: 2,
      baseQuoteReference: "T-7-V2",
      recommendedQuoteId: 3,
      recommendedQuoteReference: "T-7-V3",
    });
    await expect(response.json()).resolves.toMatchObject({
      status: "completed",
      idempotent: false,
    });
  });

  it("requires a stable idempotency key", async () => {
    const response = await POST(request({ idempotencyKey: null }), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(400);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("rejects a worker before any commercial mutation", async () => {
    mocks.userIsAdmin.mockReturnValue(false);
    const response = await POST(request(), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(403);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.rebuild).not.toHaveBeenCalled();
  });

  it("fails closed when customer quotes are disabled", async () => {
    mocks.assertFeatureReady.mockImplementation((feature: string) => {
      if (feature === "customerQuotes") {
        throw new mocks.FeatureUnavailableError(feature, "disabled");
      }
    });
    const response = await POST(request(), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(503);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.rebuild).not.toHaveBeenCalled();
  });

  it("fails closed when the case revision engine is disabled", async () => {
    mocks.assertFeatureReady.mockImplementation((feature: string) => {
      if (feature === "caseStateEngineV2") {
        throw new mocks.FeatureUnavailableError(feature, "disabled");
      }
    });
    const response = await POST(request(), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(503);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.rebuild).not.toHaveBeenCalled();
  });

  it("returns a controlled validation error for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/leads/7/commercial-package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "a2cc6d27-9977-41a7-af73-50d5bda1ef25",
        },
        body: "{",
      }),
      { params: Promise.resolve({ id: "7" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("returns the original completed result without rebuilding", async () => {
    mocks.claim.mockResolvedValue({
      kind: "completed",
      result: {
        baseQuoteId: 2,
        baseQuoteReference: "T-7-V2",
        recommendedQuoteId: 3,
        recommendedQuoteReference: "T-7-V3",
      },
    });
    const response = await POST(request(), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.rebuild).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      status: "completed",
      idempotent: true,
      baseQuoteId: 2,
    });
  });

  it("reports an in-flight duplicate without starting another rebuild", async () => {
    mocks.claim.mockResolvedValue({ kind: "processing" });
    const response = await POST(request(), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(202);
    expect(mocks.rebuild).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      idempotent: true,
      status: "processing",
    });
  });

  it("rejects a different request body for an already claimed revision", async () => {
    mocks.claim.mockResolvedValue({ kind: "conflict" });
    const response = await POST(request(), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "STALE_COMMERCIAL_CONTEXT",
    });
    expect(mocks.rebuild).not.toHaveBeenCalled();
  });

  it("marks the request for attention when rebuilding fails", async () => {
    mocks.rebuild.mockRejectedValue(new Error("controlled failure"));
    const response = await POST(request(), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(response.status).toBe(409);
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.anything(),
      41,
      expect.any(Error),
    );
  });
});

function request(input: { idempotencyKey?: string | null } = {}) {
  const headers = new Headers({ "Content-Type": "application/json" });
  const idempotencyKey =
    input.idempotencyKey === undefined
      ? "a2cc6d27-9977-41a7-af73-50d5bda1ef25"
      : input.idempotencyKey;
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  return new Request("http://localhost/api/admin/leads/7/commercial-package", {
    method: "POST",
    headers,
    body: JSON.stringify({
      baseUnitPriceExVatOre: 9900,
      discountKind: "percent",
      discountValue: 5,
      expectedRevision: 12,
      reason: "Godkjent sesongrabatt",
      recommendedServiceKey: "takvask_impregnering",
      sourceQuoteId: 1,
    }),
  });
}
