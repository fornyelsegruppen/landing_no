import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  assertExpectedDocumentHash,
  assertCurrentContractTarget,
  assertCurrentQuoteTarget,
  assertWorkOrderContractTarget,
  StaleCommercialContextError,
} from "./commercial-action-guard";

function payloadFor(
  quotes: Array<Record<string, unknown>>,
  contracts: Array<Record<string, unknown>>,
) {
  return {
    find: vi
      .fn()
      .mockResolvedValueOnce({ docs: quotes })
      .mockResolvedValueOnce({ docs: contracts }),
  } as unknown as Payload;
}

describe("commercial action guard", () => {
  it("blocks an action when the document changed without changing its database id", () => {
    expect(() => assertExpectedDocumentHash({
      expectedDocumentHash: "a".repeat(64),
      currentDocumentHash: "b".repeat(64),
      currentReference: "K-15-V2",
    })).toThrowError(StaleCommercialContextError);
  });

  it("blocks an old quote when V2 is the working version", async () => {
    const payload = payloadFor(
      [
        { id: 12, reference: "T-15-V2", version: 2, status: "approved" },
        { id: 10, reference: "T-15-V1", version: 1, status: "accepted" },
      ],
      [],
    );
    await expect(
      assertCurrentQuoteTarget(payload, { leadId: 15, quoteId: 10 }),
    ).rejects.toMatchObject({
      name: "StaleCommercialContextError",
      currentReference: "T-15-V2",
    });
  });

  it("allows only the working contract to be counter-signed", async () => {
    const payload = payloadFor(
      [
        { id: 12, reference: "T-15-V2", version: 2, status: "accepted" },
        { id: 10, reference: "T-15-V1", version: 1, status: "accepted" },
      ],
      [
        { id: 22, quote: 12, reference: "K-15-V2", version: 2, status: "signed" },
        { id: 20, quote: 10, reference: "K-15-V1", version: 1, status: "signed", companySignedAt: "2026-08-26T10:00:00Z" },
      ],
    );
    await expect(
      assertCurrentContractTarget(payload, { leadId: 15, contractId: 22 }),
    ).resolves.toBeTruthy();
  });

  it("blocks work-order creation while a newer contract is pending", async () => {
    const payload = payloadFor(
      [
        { id: 12, reference: "T-15-V2", version: 2, status: "accepted" },
        { id: 10, reference: "T-15-V1", version: 1, status: "accepted" },
      ],
      [
        { id: 22, quote: 12, reference: "K-15-V2", version: 2, status: "issued" },
        { id: 20, quote: 10, reference: "K-15-V1", version: 1, status: "signed", companySignedAt: "2026-08-26T10:00:00Z" },
      ],
    );
    await expect(
      assertWorkOrderContractTarget(payload, { leadId: 15, contractId: 20 }),
    ).rejects.toBeInstanceOf(StaleCommercialContextError);
  });
});
