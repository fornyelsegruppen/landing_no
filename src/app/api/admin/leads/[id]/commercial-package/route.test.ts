import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rebuild: vi.fn(),
  audit: vi.fn(),
  claim: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
}));
vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({ auth: mocks.auth })),
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));
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
        leadId: 7,
        recommendedServiceKey: "takvask_impregnering",
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
      reason: "Godkjent sesongrabatt",
      recommendedServiceKey: "takvask_impregnering",
    }),
  });
}
