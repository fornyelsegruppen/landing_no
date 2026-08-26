import { describe, expect, it } from "vitest";
import { protectOfficialInvoice } from "./OfficialInvoices";

const confirmed = {
  id: 1,
  status: "issued",
  extractionStatus: "confirmed",
  lead: 1,
  workOrder: 2,
  invoiceRecord: 3,
  originalDocument: 4,
  originalHash: "a".repeat(64),
  invoiceNumber: "10001",
  issuedAt: "2026-08-26T12:00:00.000Z",
  dueAt: "2026-09-09T12:00:00.000Z",
  subtotalExVatOre: 100_000,
  vatOre: 25_000,
  totalIncVatOre: 125_000,
  confirmedBy: 5,
  confirmedAt: "2026-08-26T12:00:00.000Z",
};

describe("official invoice safeguards", () => {
  it("requires imports to start in administrator review", () => {
    expect(() => protectOfficialInvoice({ operation: "create", data: { status: "sent" } } as never)).toThrow(/start in review/);
  });

  it("locks the original invoice identity and monetary fields after confirmation", () => {
    expect(() => protectOfficialInvoice({ operation: "update", originalDoc: confirmed, data: { invoiceNumber: "changed" } } as never)).toThrow(/immutable/);
  });

  it("allows the controlled issued to sent transition", () => {
    expect(protectOfficialInvoice({ operation: "update", originalDoc: confirmed, data: { status: "sent", sentAt: "2026-08-26T13:00:00.000Z" } } as never)).toMatchObject({ status: "sent" });
  });

  it("requires payment evidence before paid status", () => {
    expect(() => protectOfficialInvoice({ operation: "update", originalDoc: { ...confirmed, status: "awaiting_payment" }, data: { status: "paid" } } as never)).toThrow(/Paid amount/);
  });
});
