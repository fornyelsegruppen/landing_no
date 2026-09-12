import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
vi.mock("server-only", () => ({}));
import {
  assertCurrentContractTarget,
  assertCurrentQuoteTarget,
  assertExpectedDocumentHash,
  assertWorkOrderContractTarget,
  StaleCommercialContextError,
} from "./commercial-action-guard";

const selection = vi.hoisted(() => ({
  value: {
    measurementId: null,
    priceId: null,
    workingQuoteId: null,
    workingContractId: null,
    actionContractId: null,
    effectiveContractId: null,
    effectiveQuoteId: null,
    workOrderId: null,
    messageId: null,
  } as Record<string, number | null>,
}));

vi.mock("./case-current-selection", () => ({
  loadCaseCurrentSelection: vi.fn(async () => selection.value),
}));

function payloadFor(
  quotes: Array<Record<string, unknown>>,
  contracts: Array<Record<string, unknown>>,
) {
  const docs = new Map<string, Record<string, unknown>>();
  for (const doc of quotes)
    docs.set(`quotes:${doc.id}`, "lead" in doc ? doc : { ...doc, lead: 15 });
  for (const doc of contracts) docs.set(`contracts:${doc.id}`, doc);
  return {
    db: { name: "postgres" },
    findByID: vi.fn(
      async ({ collection, id }: { collection: string; id: number }) =>
        docs.get(`${collection}:${id}`) || null,
    ),
  } as unknown as Payload;
}

const admin = { id: 9, active: true, role: "admin" } as const;

describe("commercial action guard", () => {
  beforeEach(() => {
    selection.value = {
      measurementId: null,
      priceId: null,
      workingQuoteId: null,
      workingContractId: null,
      actionContractId: null,
      effectiveContractId: null,
      effectiveQuoteId: null,
      workOrderId: null,
      messageId: null,
    };
  });

  it("blocks an action when the document changed without changing its database id", () => {
    expect(() =>
      assertExpectedDocumentHash({
        expectedDocumentHash: "a".repeat(64),
        currentDocumentHash: "b".repeat(64),
        currentReference: "K-15-V2",
      }),
    ).toThrowError(StaleCommercialContextError);
  });

  it("blocks an old quote using the bounded current selection", async () => {
    selection.value.workingQuoteId = 312;
    const payload = payloadFor(
      [{ id: 312, reference: "T-15-V2", version: 2, status: "approved" }],
      [],
    );
    await expect(
      assertCurrentQuoteTarget(payload, admin, { leadId: 15, quoteId: 310 }),
    ).rejects.toMatchObject({
      name: "StaleCommercialContextError",
      currentReference: "T-15-V2",
    });
  });

  it("finds the current contract beyond the old 100-record cap", async () => {
    selection.value.workingQuoteId = 415;
    selection.value.workingContractId = 515;
    const quotes = Array.from({ length: 101 }, (_, index) => ({
      id: 1000 + index,
      reference: `T-${index}`,
      version: index + 1,
      status: "superseded",
    }));
    quotes.push({
      id: 415,
      reference: "T-current",
      version: 2,
      status: "accepted",
    });
    const contracts = [
      {
        id: 515,
        quote: 415,
        reference: "K-current",
        version: 2,
        status: "signed",
      },
    ];
    const payload = payloadFor(quotes, contracts);
    await expect(
      assertCurrentContractTarget(payload, admin, {
        leadId: 15,
        contractId: 515,
        expectedVersion: 2,
      }),
    ).resolves.toMatchObject({
      workingContract: { id: 515 },
    });
    expect(payload.findByID).toHaveBeenCalledTimes(2);
  });

  it("allows the selected effective contract when no newer working contract exists", async () => {
    selection.value.workingQuoteId = 612;
    selection.value.workingContractId = 620;
    selection.value.effectiveContractId = 620;
    const payload = payloadFor(
      [{ id: 612, reference: "T-15-V2", version: 2, status: "accepted" }],
      [
        {
          id: 620,
          quote: 612,
          reference: "K-15-V2",
          version: 2,
          status: "signed",
          companySignedAt: "2026-08-26T10:00:00Z",
        },
      ],
    );
    await expect(
      assertWorkOrderContractTarget(payload, admin, {
        leadId: 15,
        contractId: 620,
        expectedVersion: 2,
      }),
    ).resolves.toBeTruthy();
  });

  it("allows an effective contract when the selection has no working contract", async () => {
    selection.value.workingQuoteId = 651;
    selection.value.workingContractId = null;
    selection.value.effectiveContractId = 660;
    const payload = payloadFor(
      [
        {
          id: 650,
          lead: 15,
          reference: "T-15",
          version: 1,
          status: "accepted",
        },
        {
          id: 651,
          lead: 15,
          reference: "T-15-V2",
          version: 2,
          status: "draft",
        },
      ],
      [
        {
          id: 660,
          quote: 650,
          reference: "K-15",
          version: 1,
          status: "signed",
          companySignedAt: "2026-08-26T10:00:00Z",
        },
      ],
    );
    await expect(
      assertWorkOrderContractTarget(payload, admin, {
        leadId: 15,
        contractId: 660,
      }),
    ).resolves.toBeTruthy();
  });

  it("blocks work-order creation while a newer contract is pending", async () => {
    selection.value.workingQuoteId = 712;
    selection.value.workingContractId = 722;
    selection.value.effectiveContractId = 720;
    const payload = payloadFor(
      [{ id: 712, reference: "T-15-V2", version: 2, status: "accepted" }],
      [
        {
          id: 722,
          quote: 712,
          reference: "K-15-V2",
          version: 2,
          status: "issued",
        },
        {
          id: 720,
          quote: 712,
          reference: "K-15-V1",
          version: 1,
          status: "signed",
          companySignedAt: "2026-08-26T10:00:00Z",
        },
      ],
    );
    await expect(
      assertWorkOrderContractTarget(payload, admin, {
        leadId: 15,
        contractId: 720,
      }),
    ).rejects.toBeInstanceOf(StaleCommercialContextError);
  });

  it("fails closed when a selected current record cannot be hydrated", async () => {
    selection.value.workingQuoteId = 812;
    selection.value.workingContractId = 821;
    selection.value.effectiveContractId = 820;
    const payload = payloadFor(
      [{ id: 812, reference: "T-current", version: 2, status: "accepted" }],
      [
        {
          id: 820,
          quote: 812,
          reference: "K-effective",
          version: 1,
          status: "signed",
          companySignedAt: "2026-08-26T10:00:00Z",
        },
      ],
    );
    await expect(
      assertWorkOrderContractTarget(payload, admin, {
        leadId: 15,
        contractId: 820,
      }),
    ).rejects.toBeInstanceOf(StaleCommercialContextError);
  });

  it("does not fall back to an effective record when the selected working quote is missing", async () => {
    selection.value.workingQuoteId = 813;
    selection.value.effectiveContractId = 820;
    const payload = payloadFor(
      [
        {
          id: 811,
          lead: 15,
          reference: "T-effective",
          version: 1,
          status: "accepted",
        },
      ],
      [
        {
          id: 820,
          quote: 811,
          reference: "K-effective",
          version: 1,
          status: "signed",
          companySignedAt: "2026-08-26T10:00:00Z",
        },
      ],
    );
    await expect(
      assertCurrentQuoteTarget(payload, admin, { leadId: 15, quoteId: 811 }),
    ).rejects.toBeInstanceOf(StaleCommercialContextError);
  });

  it("does not perform any read when no authenticated admin is supplied", async () => {
    const { loadCaseCurrentSelection } =
      await import("./case-current-selection");
    vi.mocked(loadCaseCurrentSelection).mockClear();
    const payload = payloadFor([], []);
    await expect(
      assertCurrentQuoteTarget(payload, null, { leadId: 15, quoteId: 1 }),
    ).rejects.toThrow();
    expect(loadCaseCurrentSelection).not.toHaveBeenCalled();
  });
});
