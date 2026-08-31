import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  caseActionRequiresConfirmation,
  deriveCaseNextAction,
  loadAdminCase,
} from "./case-read-model";

describe("admin case next action", () => {
  it("requires confirmation for every financial action", () => {
    expect(caseActionRequiresConfirmation("calculate_price")).toBe(true);
    expect(caseActionRequiresConfirmation("create_quote")).toBe(true);
    expect(caseActionRequiresConfirmation("approve_quote")).toBe(true);
    expect(caseActionRequiresConfirmation("issue_quote")).toBe(true);
    expect(caseActionRequiresConfirmation("approve_package")).toBe(true);
    expect(caseActionRequiresConfirmation("generate_reply")).toBe(false);
    expect(caseActionRequiresConfirmation("approve_message")).toBe(false);
  });

  it.each([
    [{ leadStatus: "new" }, "generate_reply"],
    [
      {
        leadStatus: "customer_waiting",
        message: {
          id: 9,
          status: "delivered",
          direction: "inbound",
          category: "customer_question",
        },
      },
      "prepare_question_reply",
    ],
    [
      { leadStatus: "draft_ready", message: { id: 1, status: "draft" } },
      "approve_message",
    ],
    [
      {
        leadStatus: "draft_ready",
        canPreparePackage: true,
        message: { id: 1, status: "draft", category: "ai_reply" },
      },
      "prepare_package",
    ],
    [
      { leadStatus: "new", message: { id: 2, status: "failed" } },
      "retry_message",
    ],
    [
      { leadStatus: "measuring", message: { id: 1, status: "sent" } },
      "prepare_package",
    ],
    [
      {
        leadStatus: "measuring",
        message: { id: 1, status: "cancelled" },
        measurement: { id: 3, status: "review_required" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "draft" },
        contract: { id: 6, status: "draft" },
      },
      "approve_package",
    ],
    [
      {
        leadStatus: "measuring",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "review_required" },
      },
      "approve_measurement",
    ],
    [
      {
        leadStatus: "measuring",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
      },
      "calculate_price",
    ],
    [
      {
        leadStatus: "quoted",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "ready" },
      },
      "create_quote",
    ],
    [
      {
        leadStatus: "quoted",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "draft" },
      },
      "approve_quote",
    ],
    [
      {
        leadStatus: "quoted",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "approved" },
      },
      "issue_quote",
    ],
    [
      {
        leadStatus: "waiting_customer",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "sent" },
      },
      "wait_customer",
    ],
    [
      {
        leadStatus: "waiting_customer",
        message: { id: 1, status: "sent" },
        quote: { id: 5, status: "declined" },
      },
      "follow_up_decline",
    ],
    [
      {
        leadStatus: "converted",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "accepted" },
        contract: { id: 6, status: "signed" },
      },
      "company_sign_contract",
    ],
    [
      {
        leadStatus: "converted",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "accepted" },
        contract: {
          id: 6,
          status: "signed",
          companySignedAt: "2026-08-25T12:00:00Z",
        },
      },
      "create_work_order",
    ],
    [
      {
        leadStatus: "converted",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "accepted" },
        contract: {
          id: 6,
          status: "signed",
          companySignedAt: "2026-08-25T12:00:00Z",
        },
        workOrder: { id: 7, status: "unassigned" },
      },
      "assign_worker",
    ],
    [
      {
        leadStatus: "converted",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "accepted" },
        contract: {
          id: 6,
          status: "signed",
          companySignedAt: "2026-08-25T12:00:00Z",
        },
        workOrder: { id: 7, status: "assigned" },
      },
      "schedule_work",
    ],
    [
      {
        leadStatus: "converted",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "accepted" },
        contract: {
          id: 6,
          status: "signed",
          companySignedAt: "2026-08-25T12:00:00Z",
        },
        workOrder: { id: 7, status: "blocked" },
      },
      "resolve_work_block",
    ],
    [
      { leadStatus: "converted", workOrder: { id: 7, status: "scheduled" } },
      "wait_scheduled_start",
    ],
    [
      { leadStatus: "converted", workOrder: { id: 7, status: "precheck" } },
      "wait_worker_precheck",
    ],
    [
      { leadStatus: "converted", workOrder: { id: 7, status: "in_progress" } },
      "wait_work_completion",
    ],
    [
      {
        leadStatus: "converted",
        message: { id: 1, status: "sent" },
        measurement: { id: 3, status: "approved" },
        price: { id: 4, status: "superseded" },
        quote: { id: 5, status: "accepted" },
        contract: {
          id: 6,
          status: "signed",
          companySignedAt: "2026-08-25T12:00:00Z",
        },
        workOrder: {
          id: 7,
          status: "completed",
          documentationSubmittedAt: "2026-08-25T13:00:00Z",
        },
      },
      "review_completion",
    ],
    [
      { leadStatus: "converted", workOrder: { id: 7, status: "completed" } },
      "wait_worker_documentation",
    ],
    [
      { leadStatus: "converted", workOrder: { id: 7, status: "documented" } },
      "none",
    ],
    [
      { leadStatus: "converted", workOrder: { id: 7, status: "cancelled" } },
      "none",
    ],
    [
      {
        leadStatus: "converted",
        quote: { id: 5, status: "accepted" },
        contract: {
          id: 6,
          status: "signed",
          companySignedAt: "2026-08-25T12:00:00Z",
        },
      },
      "create_work_order",
    ],
    [
      {
        leadStatus: "customer_waiting",
        nextActionBlocker: "CUSTOMER_CANCELLATION_REQUEST",
        quote: { id: 5, status: "accepted" },
        contract: {
          id: 6,
          status: "signed",
          companySignedAt: "2026-08-25T12:00:00Z",
        },
      },
      "review_cancellation",
    ],
    [
      {
        leadStatus: "closed",
        message: { id: 8, status: "draft", category: "follow_up" },
      },
      "approve_message",
    ],
    [
      {
        leadStatus: "closed",
        message: {
          id: 9,
          status: "draft",
          category: "follow_up",
          closesContract: true,
        },
      },
      "send_closure_confirmation",
    ],
    [{ leadStatus: "closed" }, "none"],
  ])("derives %s as %s", (input, expected) => {
    expect(deriveCaseNextAction(input)).toMatchObject({ kind: expected });
  });
});

describe("admin case read model", () => {
  it("returns null for an unknown lead", async () => {
    const payload = {
      findByID: vi.fn().mockRejectedValue(new Error("not found")),
    } as unknown as Payload;
    await expect(loadAdminCase(payload, 404)).resolves.toBeNull();
  });

  it("assembles the customer journey without returning raw access tokens", async () => {
    const findByID = vi.fn().mockResolvedValue({
      id: 1,
      name: "Ola Nordmann",
      email: "ola@example.no",
      phone: "99999999",
      address: "Testveien",
      houseNumber: "1",
      postal: "0001",
      city: "Oslo",
      inquiryType: "takvask",
      photoUrls:
        "https://safe.blob.vercel-storage.com/leads/roof-1.jpg\nhttps://safe.blob.vercel-storage.com/leads/roof-2.jpg",
      status: "quoted",
      createdAt: "2026-08-24T08:00:00.000Z",
    });
    const responses = [
      {
        docs: [
          {
            id: 2,
            reference: "TM-1-V1",
            status: "approved",
            actualAreaMinTenths: 1000,
            actualAreaMaxTenths: 1200,
            createdAt: "2026-08-24T09:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 3,
            reference: "PB-1-RAW-TIMESTAMP",
            status: "superseded",
            measurement: 2,
            priceRule: 9,
            inputHash: "a".repeat(64),
            inputSnapshot: {
              measurementVersion: 1,
              rule: {
                id: 9,
                version: 3,
                serviceKey: "takvask",
              },
            },
            outputSnapshot: {
              quantityTenths: 1200,
              toleranceBasisPoints: 1000,
              lineItems: [
                {
                  code: "takvask",
                  quantityTenths: 1200,
                  unitPriceExVatOre: 8333,
                  totalExVatOre: 1000000,
                },
              ],
            },
            subtotalExVatOre: 1000000,
            vatOre: 250000,
            totalIncVatOre: 1250000,
            maximumTotalIncVatOre: 1375000,
            createdAt: "2026-08-24T10:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 4,
            reference: "T-1-V1",
            version: 1,
            priceCalculation: 3,
            status: "approved",
            createdAt: "2026-08-24T11:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 5,
            subject: "Takk",
            bodyText: "Hei",
            direction: "outbound",
            category: "receipt",
            channel: "email",
            status: "sent",
            aiAnalysis: { recommendedNextAction: "start_measurement" },
            createdAt: "2026-08-24T08:01:00.000Z",
          },
        ],
      },
      { docs: [] },
      {
        docs: [
          {
            id: 8,
            reference: "END-6-RAW-HASH",
            kind: "change_or_cancel",
            status: "admin_review",
            createdAt: "2026-08-24T12:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 6,
            reference: "K-1-V1",
            status: "draft",
            createdAt: "2026-08-24T11:01:00.000Z",
          },
        ],
      },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      {
        docs: [
          {
            id: 7,
            filename: "tilbud.pdf",
            classification: "contract",
            mimeType: "application/pdf",
            ownerType: "quote",
            ownerId: "4",
            createdAt: "2026-08-24T11:02:00.000Z",
            url: "https://safe.blob.vercel-storage.com/private/file.pdf",
          },
        ],
      },
    ];
    const find = vi.fn().mockImplementation(async () => responses.shift());
    const result = await loadAdminCase(
      { findByID, find } as unknown as Payload,
      1,
    );

    expect(result?.lead.address).toBe("Testveien 1 0001 Oslo");
    expect(result?.lead.photoCount).toBe(2);
    expect(JSON.stringify(result)).not.toContain("roof-1.jpg");
    expect(result?.quote?.reference).toBe("T-1-V1");
    expect(result?.price?.reference).toBe("PB-1-V1");
    expect(result?.priceCalculations[0]).toMatchObject({
      reference: "PB-1-V1",
      measurementId: 2,
      priceRuleId: 9,
      priceRuleVersion: 3,
      quantityTenths: 1200,
      serviceKey: "takvask",
      totalIncVatOre: 1250000,
    });
    expect(result?.contractRequests[0]?.reference).toBe("END-1-V1");
    expect(result?.timeline.map((item) => item.title)).toEqual(
      expect.arrayContaining(["PB-1-V1", "END-1-V1"]),
    );
    expect(result?.nextAction.kind).toBe("issue_quote");
    expect(result?.documents[0]?.href).toBe("/api/admin/media/7");
    expect(JSON.stringify(result)).not.toContain("tokenHash");
    expect(result?.timeline.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        "lead",
        "message",
        "measurement",
        "price",
        "quote",
        "contract",
        "document",
      ]),
    );
  });

  it("keeps draft and official invoices identity-safe when their numeric ids collide", async () => {
    const findByID = vi.fn().mockResolvedValue({
      id: 18,
      name: "Invoice collision UAT",
      status: "converted",
      createdAt: "2026-08-30T08:00:00.000Z",
    });
    const responses = [
      { docs: [] },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      {
        docs: [
          {
            id: 7,
            reference: "FU-18-V1",
            status: "draft",
            document: 70,
            createdAt: "2026-08-30T09:00:00.000Z",
          },
        ],
      },
      { docs: [] },
      {
        docs: [
          {
            id: 7,
            reference: "FIKEN-18-1001",
            invoiceNumber: "1001",
            status: "sent",
            originalDocument: 71,
            createdAt: "2026-08-30T10:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 70,
            filename: "FU-18-V1.pdf",
            classification: "invoice",
            ownerType: "invoice-record",
            ownerId: "7",
            createdAt: "2026-08-30T09:00:00.000Z",
          },
          {
            id: 71,
            filename: "FIKEN-18-1001.pdf",
            classification: "invoice",
            ownerType: "invoice-record",
            ownerId: "7",
            createdAt: "2026-08-30T10:00:00.000Z",
          },
        ],
      },
    ];
    const result = await loadAdminCase(
      {
        findByID,
        find: vi.fn().mockImplementation(async () => responses.shift()),
      } as unknown as Payload,
      18,
    );

    const invoiceEvents = result?.timeline.filter(
      (item) => item.type === "invoice",
    );
    expect(invoiceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "invoice-invoice-records-7",
          sourceCollection: "invoice-records",
          sourceId: 7,
          title: "FU-18-V1",
        }),
        expect.objectContaining({
          id: "invoice-official-invoices-7",
          sourceCollection: "official-invoices",
          sourceId: 7,
          title: "1001",
        }),
      ]),
    );
    expect(new Set(invoiceEvents?.map((item) => item.id)).size).toBe(2);
    expect(result?.invoice?.documentId).toBe(70);
    expect(result?.officialInvoices[0]?.originalDocumentId).toBe(71);
  });

  it("preserves the accepted change that explains a historical maximum-price breach", async () => {
    const findByID = vi.fn().mockResolvedValue({
      id: 19,
      name: "Maximum price UAT",
      status: "converted",
      createdAt: "2026-08-30T08:00:00.000Z",
    });
    const find = vi.fn().mockImplementation(
      async ({ collection }: { collection: string }) => {
        if (collection === "quotes") {
          return {
            docs: [
              {
                id: 4,
                reference: "T-19-V1",
                status: "accepted",
                totalIncVatOre: 2_587_500,
                maximumTotalIncVatOre: 2_975_600,
                createdAt: "2026-08-30T08:10:00.000Z",
              },
            ],
          };
        }
        if (collection === "work-orders") {
          return {
            docs: [
              {
                id: 6,
                reference: "A-19-V1",
                status: "documented",
                approvedChangeAgreement: { id: 9 },
                actualTotalIncVatOre: 3_400_000,
                createdAt: "2026-08-30T08:20:00.000Z",
              },
            ],
          };
        }
        if (collection === "change-agreements") {
          return {
            docs: [
              {
                id: 9,
                reference: "E-6-V1",
                workOrder: 6,
                status: "accepted",
                reasonCode: "over_maximum",
                beforeTotalIncVatOre: 2_587_500,
                afterTotalIncVatOre: 3_400_000,
                acceptedAt: "2026-08-30T08:30:00.000Z",
                snapshot: {
                  before: { maximumTotalIncVatOre: 2_975_600 },
                  after: { totalIncVatOre: 3_400_000 },
                },
                createdAt: "2026-08-30T08:25:00.000Z",
              },
            ],
          };
        }
        return { docs: [] };
      },
    );

    const result = await loadAdminCase(
      { findByID, find } as unknown as Payload,
      19,
    );

    expect(result?.workOrder?.approvedChangeAgreementId).toBe(9);
    expect(result?.changes[0]).toMatchObject({
      id: 9,
      acceptedAt: "2026-08-30T08:30:00.000Z",
      afterTotalIncVatOre: 3_400_000,
      beforeMaximumTotalIncVatOre: 2_975_600,
      reasonCode: "over_maximum",
      status: "accepted",
      workOrderId: 6,
    });
  });

  it("does not offer an obsolete draft after a newer equivalent was sent", async () => {
    const findByID = vi.fn().mockResolvedValue({
      id: 1,
      name: "Test",
      address: "Testveien",
      postal: "0001",
      status: "waiting_customer",
      createdAt: "2026-08-24T08:00:00.000Z",
    });
    const responses = [
      {
        docs: [
          {
            id: 2,
            reference: "TM-1",
            status: "approved",
            createdAt: "2026-08-24T09:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 3,
            reference: "PB-1",
            status: "superseded",
            createdAt: "2026-08-24T10:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 4,
            reference: "T-1",
            status: "viewed",
            createdAt: "2026-08-24T11:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 6,
            subject: "Tilbud T-1",
            category: "quote",
            bodyText: "Sent",
            direction: "outbound",
            channel: "email",
            status: "sent",
            createdAt: "2026-08-24T12:00:00.000Z",
          },
          {
            id: 5,
            subject: "Tilbud T-1",
            category: "quote",
            bodyText: "Draft",
            direction: "outbound",
            channel: "email",
            status: "draft",
            createdAt: "2026-08-24T11:30:00.000Z",
          },
        ],
      },
      { docs: [] },
      { docs: [] },
      {
        docs: [
          {
            id: 7,
            reference: "K-1",
            status: "issued",
            createdAt: "2026-08-24T11:00:00.000Z",
          },
        ],
      },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      { docs: [] },
    ];
    const find = vi.fn().mockImplementation(async () => responses.shift());
    const result = await loadAdminCase(
      { findByID, find } as unknown as Payload,
      1,
    );

    expect(result?.nextAction.kind).toBe("wait_customer");
  });

  it("hides a superseded AI draft instead of presenting it as a cancelled customer message", async () => {
    const findByID = vi.fn().mockResolvedValue({
      id: 8,
      name: "Test",
      address: "Testveien",
      postal: "0001",
      inquiryType: "takvask",
      status: "measuring",
      createdAt: "2026-08-25T08:00:00.000Z",
    });
    const responses = [
      {
        docs: [
          {
            id: 20,
            reference: "TM-8-V1",
            status: "review_required",
            createdAt: "2026-08-25T09:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 21,
            reference: "PB-8",
            status: "superseded",
            createdAt: "2026-08-25T09:01:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 22,
            reference: "T-8-V1",
            status: "draft",
            createdAt: "2026-08-25T09:02:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 24,
            subject: "Angående din forespørsel",
            category: "ai_reply",
            bodyText: "Draft",
            direction: "outbound",
            channel: "email",
            status: "cancelled",
            createdAt: "2026-08-25T09:03:00.000Z",
          },
          {
            id: 23,
            subject: "Vi har mottatt henvendelsen",
            category: "receipt",
            bodyText: "Sent",
            direction: "outbound",
            channel: "email",
            status: "sent",
            createdAt: "2026-08-25T08:01:00.000Z",
          },
        ],
      },
      { docs: [] },
      { docs: [] },
      {
        docs: [
          {
            id: 25,
            reference: "K-8-V1",
            status: "draft",
            createdAt: "2026-08-25T09:02:00.000Z",
          },
        ],
      },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      { docs: [] },
    ];
    const result = await loadAdminCase(
      {
        findByID,
        find: vi.fn().mockImplementation(async () => responses.shift()),
      } as unknown as Payload,
      8,
    );

    expect(result?.messages.map((message) => message.id)).toEqual([23]);
    expect(result?.timeline.some((item) => item.id === "message-24")).toBe(
      false,
    );
    expect(result?.nextAction.kind).toBe("approve_package");
  });

  it("ignores an obsolete intake AI draft after the commercial journey has started", async () => {
    const findByID = vi.fn().mockResolvedValue({
      id: 9,
      name: "Test",
      address: "Testveien",
      postal: "0001",
      inquiryType: "takvask",
      status: "converted",
      createdAt: "2026-08-25T08:00:00.000Z",
    });
    const responses = [
      {
        docs: [
          {
            id: 30,
            reference: "TM-9-V1",
            status: "approved",
            createdAt: "2026-08-25T09:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 31,
            reference: "PB-9",
            status: "ready",
            createdAt: "2026-08-25T09:01:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 32,
            reference: "T-9-V1",
            status: "accepted",
            createdAt: "2026-08-25T09:02:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 34,
            subject: "Angående din forespørsel",
            category: "ai_reply",
            bodyText: "Draft",
            direction: "outbound",
            channel: "email",
            status: "draft",
            createdAt: "2026-08-25T09:03:00.000Z",
          },
          {
            id: 33,
            subject: "Ferdig",
            category: "completion",
            bodyText: "Sent",
            direction: "outbound",
            channel: "email",
            status: "delivered",
            createdAt: "2026-08-25T12:00:00.000Z",
          },
        ],
      },
      {
        docs: [
          {
            id: 36,
            reference: "A-K-9-V1",
            status: "documented",
            documentationSubmittedAt: "2026-08-25T11:00:00.000Z",
            createdAt: "2026-08-25T10:00:00.000Z",
          },
        ],
      },
      { docs: [] },
      {
        docs: [
          {
            id: 35,
            reference: "K-9-V1",
            status: "signed",
            companySignedAt: "2026-08-25T09:30:00.000Z",
            createdAt: "2026-08-25T09:02:00.000Z",
          },
        ],
      },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      { docs: [] },
      { docs: [] },
    ];
    const result = await loadAdminCase(
      {
        findByID,
        find: vi.fn().mockImplementation(async () => responses.shift()),
      } as unknown as Payload,
      9,
    );

    expect(result?.messages.map((message) => message.id)).toEqual([33]);
    expect(result?.timeline.some((item) => item.id === "message-34")).toBe(
      false,
    );
    expect(result?.nextAction.kind).toBe("none");
  });
});
