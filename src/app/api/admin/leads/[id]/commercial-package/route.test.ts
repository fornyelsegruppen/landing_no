import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rebuild: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => ({ auth: mocks.auth })) }));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));
vi.mock("@/lib/pricing/commercial-package", () => ({ rebuildCommercialPackage: mocks.rebuild }));
vi.mock("@/lib/audit/payload-audit-writer", () => ({ createPayloadAuditWriter: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: mocks.audit }));

import { POST } from "./route";

describe("commercial package API", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({ user: { id: 9, role: "admin" } });
    mocks.rebuild.mockReset().mockResolvedValue({ sourceQuoteId: 1, base: { quote: { id: 2 } }, recommended: { quote: { id: 3 } } });
    mocks.audit.mockReset().mockResolvedValue(undefined);
  });

  it("creates audited base and recommended options", async () => {
    const response = await POST(new Request("http://localhost/api/admin/leads/7/commercial-package", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUnitPriceExVatOre: 9900, discountKind: "percent", discountValue: 5, reason: "Godkjent sesongrabatt", recommendedServiceKey: "takvask_impregnering" }) }), { params: Promise.resolve({ id: "7" }) });
    expect(response.status).toBe(201);
    expect(mocks.rebuild).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ administratorId: 9, leadId: 7, recommendedServiceKey: "takvask_impregnering" }));
    expect(mocks.audit).toHaveBeenCalled();
  });
});
