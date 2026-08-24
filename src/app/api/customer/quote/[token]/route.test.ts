import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildContractSnapshot, buildQuoteSnapshot, documentHash } from "@/lib/quotes/document";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), find: vi.fn(), findByID: vi.fn(), remove: vi.fn(), load: vi.fn(), enqueue: vi.fn(), deliver: vi.fn(), provider: { health: vi.fn(() => ({ status: "ready" })) } }));
vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => ({ create: mocks.create, update: mocks.update, find: mocks.find, findByID: mocks.findByID, delete: mocks.remove })) }));
vi.mock("@/lib/quotes/customer-view", () => ({ loadCustomerQuote: mocks.load }));
vi.mock("@/lib/messages/message-engine", () => ({ enqueueMessageJob: mocks.enqueue, deliverMessage: mocks.deliver }));
vi.mock("@/lib/providers/email-provider", () => ({ createEmailProvider: () => mocks.provider }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: () => "192.0.2.1", rateLimit: vi.fn(async () => ({ success: true, remaining: 10 })) }));
vi.mock("@/lib/platform/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform/features")>();
  return { ...actual, assertFeatureReady: vi.fn() };
});
vi.mock("@/lib/quotes/quote-pdf", () => ({ buildQuoteContractPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])) }));

import { POST } from "./route";

const quote = buildQuoteSnapshot({ quoteReference: "T-1-V1", leadId: 1, serviceKey: "takvask", serviceDescription: "Takvask", propertyAddress: "Testveien 1", measurement: { id: 1, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1000, actualAreaMaxTenths: 1100, source: "test", credits: "test", capturedAt: "2026-08-23T00:00:00Z", assumptions: ["test"] }, pricing: { calculationId: 1, inputHash: "b".repeat(64), ruleId: 1, ruleVersion: 1, unitPriceExVatOre: 10000, subtotalExVatOre: 1100000, vatBasisPoints: 2500, vatOre: 275000, totalIncVatOre: 1375000, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 1512500 }, termsVersion: "v1", validUntil: "2099-09-01T00:00:00Z" });
const contract = buildContractSnapshot({ contractReference: "K-1-V1", quote, customer: { name: "Test Kunde", address: "Testveien 1", email: "test@example.test" }, terms: { version: "v1", text: "Dette er en lang nok kontrollert kontraktstekst for testing av signeringsflyten og alle låste opplysninger.", withdrawalInstructions: "Kunden har mottatt full informasjon om angrerett og standard angreskjema før avtalen inngås.", withdrawalFormUrl: "https://example.test/form" } });
const baseView = { accessRecordId: 9, quoteId: 1, quoteStatus: "viewed", quoteReference: "T-1-V1", contractId: 2, contractStatus: "issued", contractReference: "K-1-V1", documentHash: documentHash(contract), snapshot: contract, display: {}, customerName: "Test Kunde", signedAt: null, signatureEvidence: null, signedDocumentId: null };
const signatureData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/customer/quote/token", { method: "POST", headers: { "Content-Type": "application/json", "user-agent": "test" }, body: JSON.stringify(body) });
}

describe("customer quote signing route", () => {
  beforeEach(() => {
    process.env.PAYLOAD_SECRET = "test-secret-at-least-32-characters-long";
    mocks.create.mockReset().mockImplementation(async ({ collection }: { collection: string }) => collection === "private-media" ? { id: 77 } : { id: 88 });
    mocks.update.mockReset().mockImplementation(async ({ collection, where }: { collection: string; where?: unknown }) => collection === "contracts" && where ? { docs: [{ id: 2, status: "signed" }], errors: [] } : { id: 1 });
    mocks.find.mockReset().mockResolvedValue({ docs: [] }); mocks.findByID.mockReset(); mocks.remove.mockReset(); mocks.enqueue.mockReset(); mocks.deliver.mockReset(); mocks.provider.health.mockClear();
    mocks.load.mockReset().mockResolvedValue({ ...baseView });
  });

  it("stores an immutable signed PDF and queues one durable confirmation", async () => {
    const response = await POST(request({ action: "sign", signerName: "Test Kunde", signatureData, expectedDocumentHash: documentHash(contract), paymentObligationAccepted: true, termsAccepted: true, withdrawalInformationReceived: true, earlyStartRequested: false, earlyStartLossAcknowledged: false }), { params: Promise.resolve({ token: "t".repeat(43) }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "signed" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ collection: "private-media", file: expect.objectContaining({ mimetype: "application/pdf" }) }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ collection: "messages", data: expect.objectContaining({ attachments: [77], idempotencyKey: "contract-signed:2" }) }));
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.anything(), 88, expect.any(String));
    expect(mocks.deliver).toHaveBeenCalledWith(expect.anything(), mocks.provider, 88, expect.any(String));
  });

  it("is idempotent after the same contract is already signed", async () => {
    mocks.load.mockResolvedValue({ ...baseView, quoteStatus: "accepted", contractStatus: "signed" });
    const response = await POST(request({ action: "sign", signerName: "Test Kunde", signatureData, expectedDocumentHash: documentHash(contract), paymentObligationAccepted: true, termsAccepted: true, withdrawalInformationReceived: true, earlyStartRequested: false, earlyStartLossAcknowledged: false }), { params: Promise.resolve({ token: "t".repeat(43) }) });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ idempotent: true });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not reveal an invalid or revoked customer relationship", async () => {
    mocks.load.mockResolvedValue(null);
    const response = await POST(request({ action: "decline" }), { params: Promise.resolve({ token: "x".repeat(43) }) });
    expect(response.status).toBe(404);
  });
});
