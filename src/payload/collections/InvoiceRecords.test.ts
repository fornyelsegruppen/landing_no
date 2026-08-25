import { describe, expect, it } from "vitest";
import { protectInvoice } from "./InvoiceRecords";

describe("invoice record invariants", () => {
  it("requires a controlled status flow and accounting reference before export", () => {
    const originalDoc = { status: "approved", externalReference: null, subtotalExVatOre: 100, vatOre: 25, totalIncVatOre: 125, issuedAt: "2026-08-25", dueAt: "2026-09-08", lead: 1, workOrder: 2, snapshot: { total: 125 } };
    expect(() => protectInvoice({ operation: "update", data: { status: "exported" }, originalDoc } as never)).toThrow(/Accounting-system reference/);
    expect(protectInvoice({ operation: "update", data: { status: "exported", externalReference: "F-100" }, originalDoc } as never)).toMatchObject({ status: "exported", externalReference: "F-100" });
    expect(() => protectInvoice({ operation: "update", data: { status: "paid", externalReference: "F-100" }, originalDoc } as never)).toThrow(/Invalid invoice status transition/);
  });

  it("keeps the final monetary basis immutable", () => {
    expect(() => protectInvoice({ operation: "update", data: { totalIncVatOre: 999 }, originalDoc: { status: "draft", totalIncVatOre: 125 } } as never)).toThrow(/immutable/);
  });
});
