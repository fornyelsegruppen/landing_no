import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildContractSnapshot, buildQuoteSnapshot, createSignatureEvidence, documentHash } from "@/lib/quotes/document";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), create: vi.fn(), update: vi.fn(), find: vi.fn(), findByID: vi.fn(),
  createMedia: vi.fn(), deleteMedia: vi.fn(), enqueue: vi.fn(), deliver: vi.fn(),
  readMedia: vi.fn(),
  provider: { health: vi.fn(() => ({ status: "ready" })) },
}));
vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => ({ auth: mocks.auth, create: mocks.create, update: mocks.update, find: mocks.find, findByID: mocks.findByID })) }));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));
vi.mock("@/lib/private-media-storage", () => ({ createPrivateMedia: mocks.createMedia, deletePrivateMedia: mocks.deleteMedia }));
vi.mock("@/lib/private-media-content", () => ({ readPrivateMediaContent: mocks.readMedia }));
vi.mock("@/lib/messages/message-engine", () => ({ enqueueMessageJob: mocks.enqueue, deliverMessage: mocks.deliver }));
vi.mock("@/lib/providers/email-provider", () => ({ createEmailProvider: () => mocks.provider }));
vi.mock("@/lib/quotes/quote-pdf", () => ({ buildQuoteContractPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])) }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: vi.fn(() => "192.0.2.1") }));
vi.mock("@/lib/audit/payload-audit-writer", () => ({ createPayloadAuditWriter: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: vi.fn(async () => undefined) }));

import { POST } from "./route";

const quote = buildQuoteSnapshot({ quoteReference: "T-1-V1", leadId: 1, serviceKey: "takvask", serviceDescription: "Takvask", propertyAddress: "Testveien 1", measurement: { id: 1, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1000, actualAreaMaxTenths: 1100, source: "test", credits: "test", capturedAt: "2026-08-23T00:00:00Z", assumptions: ["test"] }, pricing: { calculationId: 1, inputHash: "b".repeat(64), ruleId: 1, ruleVersion: 1, unitPriceExVatOre: 10000, subtotalExVatOre: 1100000, vatBasisPoints: 2500, vatOre: 275000, totalIncVatOre: 1375000, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 1512500 }, termsVersion: "v1", validUntil: "2099-09-01T00:00:00Z" });
const contractSnapshot = buildContractSnapshot({ contractReference: "K-1-V1", quote, customer: { name: "Test Kunde", address: "Testveien 1" }, terms: { version: "v1", text: "Avtalevilkår", withdrawalInstructions: "Angrerett", withdrawalFormUrl: "https://example.test/form" } });
const signatureData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=";
const customerEvidence = createSignatureEvidence({ contract: contractSnapshot, expectedDocumentHash: documentHash(contractSnapshot), signatureData, signerName: "Test Kunde", paymentObligationAccepted: true, termsAccepted: true, withdrawalInformationReceived: true, earlyStartRequested: false, earlyStartLossAcknowledged: false, ipAddress: "", userAgent: "", securitySalt: "s".repeat(32) });

describe("supplier contract signing", () => {
  beforeEach(() => {
    process.env.PAYLOAD_SECRET = "test-secret-at-least-32-characters-long";
    mocks.auth.mockReset().mockResolvedValue({ user: { id: 9, role: "admin" } });
    mocks.findByID.mockReset().mockImplementation(async ({ collection }: { collection: string }) => collection === "contracts"
      ? { id: 3, reference: "K-1-V1", quote: 2, status: "signed", documentHash: documentHash(contractSnapshot), snapshot: contractSnapshot, signatureEvidence: customerEvidence, customerSignatureImage: 30, signedAt: customerEvidence.signedAt }
      : collection === "private-media" ? { id: 30 } : { id: 2, lead: 1, status: "accepted" });
    mocks.readMedia.mockReset().mockResolvedValue({ data: Buffer.from(signatureData.split(",")[1], "base64"), filename: "signature.png", contentType: "image/png" });
    mocks.createMedia.mockReset().mockResolvedValueOnce({ id: 31 }).mockResolvedValueOnce({ id: 32 });
    mocks.update.mockReset().mockResolvedValue({ id: 3 });
    mocks.find.mockReset().mockResolvedValue({ docs: [] });
    mocks.create.mockReset().mockResolvedValue({ id: 41 });
    mocks.enqueue.mockReset(); mocks.deliver.mockReset(); mocks.deleteMedia.mockReset();
  });

  it("stores both-party evidence and sends the final PDF", async () => {
    const request = new Request("http://localhost/api/admin/contracts/3/sign", { method: "POST", headers: { "Content-Type": "application/json", "user-agent": "test" }, body: JSON.stringify({ signerName: "Kari Administrator", signatureData, expectedDocumentHash: documentHash(contractSnapshot) }) });
    const response = await POST(request, { params: Promise.resolve({ id: "3" }) });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ collection: "contracts", data: expect.objectContaining({ companySignedDocument: 32, companySignedBy: 9 }) }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ collection: "messages", data: expect.objectContaining({ attachments: [32], idempotencyKey: "contract-counter-signed:3" }) }));
    expect(mocks.deliver).toHaveBeenCalled();
  });
});
