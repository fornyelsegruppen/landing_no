import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildQuoteSnapshot } from "./document";

const mocks = vi.hoisted(() => ({ issueToken: vi.fn(), revokeTokens: vi.fn() }));
vi.mock("./customer-access", () => ({ issueQuoteAccessToken: mocks.issueToken, revokeQuoteAccessTokens: mocks.revokeTokens }));
vi.mock("@/lib/site", () => ({ siteConfig: { url: "https://example.test", phone: "47 73 58 88" } }));

import { issueQuoteCustomerLink } from "./issue";

function snapshot(reference: string, serviceKey: string, serviceDescription: string, total: number) {
  return buildQuoteSnapshot({ quoteReference: reference, leadId: 1, serviceKey, serviceDescription, propertyAddress: "Testveien 1", measurement: { id: 1, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1000, actualAreaMaxTenths: 1100, source: "test", credits: "test", capturedAt: "2026-08-23T00:00:00Z", assumptions: ["test"] }, pricing: { calculationId: 1, inputHash: "b".repeat(64), ruleId: 1, ruleVersion: 1, unitPriceExVatOre: 10000, subtotalExVatOre: Math.round(total / 1.25), vatBasisPoints: 2500, vatOre: total - Math.round(total / 1.25), totalIncVatOre: total, toleranceBasisPoints: 1000, maximumTotalIncVatOre: Math.round(total * 1.1) }, termsVersion: "v1", validUntil: "2099-09-01T00:00:00Z" });
}

describe("grouped quote issuing", () => {
  afterEach(() => {
    delete process.env.PREVIEW_E2E_NONBINDING_DOCUMENTS;
    delete process.env.VERCEL_ENV;
  });

  beforeEach(() => {
    mocks.revokeTokens.mockReset().mockResolvedValue(undefined);
    mocks.issueToken.mockReset().mockResolvedValueOnce({ token: "base-token", record: { id: 31 } }).mockResolvedValueOnce({ token: "recommended-token", record: { id: 32 } });
  });

  it("sends base and recommended alternatives in one message", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.PREVIEW_E2E_NONBINDING_DOCUMENTS = "true";
    const base = { id: 10, reference: "T-1-V2", lead: 1, version: 2, validUntil: "2099-09-01T00:00:00Z", status: "approved", optionKind: "base", siblingQuote: 11, snapshot: snapshot("T-1-V2", "takvask", "Takvask", 1_250_000) };
    const recommended = { id: 11, reference: "T-1-V3", lead: 1, version: 3, validUntil: "2099-09-01T00:00:00Z", status: "approved", optionKind: "recommended", siblingQuote: 10, snapshot: snapshot("T-1-V3", "takvask_impregnering", "Takvask og impregnering", 1_750_000) };
    const create = vi.fn().mockImplementation(async ({ data }: { data: unknown }) => ({ id: 90, ...(data as object) }));
    const payload = {
      findByID: vi.fn().mockImplementation(async ({ collection, id }: { collection: string; id: number }) => collection === "leads" ? { id: 1, name: "Test Kunde", email: "test@example.no" } : id === 10 ? base : recommended),
      find: vi.fn().mockImplementation(async ({ where }: { where: { quote: { equals: number } } }) => ({ docs: [{ id: where.quote.equals === 10 ? 20 : 21, status: "draft" }] })),
      update: vi.fn().mockResolvedValue({}),
      create,
    };
    const result = await issueQuoteCustomerLink(payload as never, 10);
    const message = create.mock.calls[0][0].data as { bodyText: string; subject: string };
    expect(result.alternative?.quote.id).toBe(11);
    expect(message.bodyText).toContain("Opprinnelig forespørsel");
    expect(message.bodyText).toContain("Anbefalt alternativ");
    expect(message.bodyText).toContain("base-token");
    expect(message.bodyText).toContain("recommended-token");
    expect(message.subject).toContain("[PREVIEW TEST] [IKKE BINDENDE]");
    expect(message.bodyText).toContain("[PREVIEW TEST – IKKE BINDENDE]");
    expect(message.bodyText).toContain("ingen bindende bestilling");
    expect(mocks.revokeTokens).toHaveBeenCalledTimes(2);
  });

  it("labels a superseding quote as an updated proposal without implying it was the original request", async () => {
    mocks.issueToken.mockReset().mockResolvedValueOnce({ token: "revised-token", record: { id: 41 } });
    const revised = {
      id: 12,
      reference: "T-1-V2",
      lead: 1,
      version: 2,
      supersedes: 10,
      validUntil: "2099-09-01T00:00:00Z",
      status: "approved",
      snapshot: snapshot("T-1-V2", "takvask_impregnering", "Takvask og impregnering", 1_750_000),
    };
    const create = vi.fn().mockImplementation(async ({ data }: { data: unknown }) => ({ id: 91, ...(data as object) }));
    const payload = {
      findByID: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => collection === "leads" ? { id: 1, name: "Test Kunde", email: "test@example.no" } : revised),
      find: vi.fn().mockResolvedValue({ docs: [{ id: 22, status: "draft" }] }),
      update: vi.fn().mockResolvedValue({}),
      create,
    };

    await issueQuoteCustomerLink(payload as never, 12);
    const message = create.mock.calls[0][0].data as { bodyText: string };
    expect(message.bodyText).toContain("oppdatert tilbud T-1-V2");
    expect(message.bodyText).toContain("Oppdatert forslag: Takvask og impregnering");
    expect(message.bodyText).toContain("Den tidligere avtalen endres ikke");
    expect(message.bodyText).not.toContain("Opprinnelig forespørsel");
    expect(mocks.revokeTokens).toHaveBeenCalledWith(payload, 12);
  });
});
