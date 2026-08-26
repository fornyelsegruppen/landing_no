import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import { adminOnly } from "../access/roles";

const immutableAfterConfirmation = [
  "lead",
  "workOrder",
  "invoiceRecord",
  "originalDocument",
  "originalHash",
  "invoiceNumber",
  "issuedAt",
  "dueAt",
  "subtotalExVatOre",
  "vatOre",
  "totalIncVatOre",
];

export const protectOfficialInvoice: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation === "create") {
    if (data.status && data.status !== "needs_review") throw new Error("A new official invoice import must start in review");
    if (data.extractionStatus && !["needs_review", "failed"].includes(data.extractionStatus)) throw new Error("Imported invoice metadata must be reviewed by an administrator");
    return data;
  }
  if (!originalDoc) return data;
  if (originalDoc.extractionStatus === "confirmed" && immutableAfterConfirmation.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]))) {
    throw new Error("A confirmed official invoice is immutable; use a credit note and a new invoice");
  }
  const merged = { ...originalDoc, ...data };
  const nextExtraction = merged.extractionStatus;
  if (nextExtraction === "confirmed") {
    for (const field of ["invoiceNumber", "issuedAt", "dueAt", "subtotalExVatOre", "vatOre", "totalIncVatOre", "confirmedBy", "confirmedAt"]) {
      if (merged[field] === undefined || merged[field] === null || merged[field] === "") throw new Error(`Confirmed invoice is missing ${field}`);
    }
    if (merged.subtotalExVatOre + merged.vatOre !== merged.totalIncVatOre) throw new Error("Official invoice VAT totals are inconsistent");
  }
  if (data.status && data.status !== originalDoc.status) {
    const transitions: Record<string, string[]> = {
      needs_review: ["issued", "cancelled"],
      issued: ["sent", "cancelled", "credited"],
      sent: ["awaiting_payment", "paid", "overdue", "credited", "cancelled"],
      awaiting_payment: ["paid", "overdue", "credited", "cancelled"],
      overdue: ["paid", "credited", "cancelled"],
      paid: ["credited"],
      credited: [],
      cancelled: [],
    };
    if (!transitions[originalDoc.status]?.includes(data.status)) throw new Error(`Invalid official invoice status transition: ${originalDoc.status} -> ${data.status}`);
  }
  if (["issued", "sent", "awaiting_payment", "paid", "overdue", "credited"].includes(merged.status) && nextExtraction !== "confirmed") {
    throw new Error("Official invoice metadata must be confirmed before changing its workflow status");
  }
  if (merged.status === "paid" && (!merged.paidAt || typeof merged.paidAmountOre !== "number" || merged.paidAmountOre <= 0)) {
    throw new Error("Paid amount and payment date are required");
  }
  return data;
};

export const OfficialInvoices: CollectionConfig = {
  slug: "official-invoices",
  labels: { singular: "Offisiell faktura", plural: "Offisielle fakturaer" },
  admin: {
    group: "Arbeid",
    useAsTitle: "invoiceNumber",
    defaultColumns: ["invoiceNumber", "lead", "status", "totalIncVatOre", "dueAt", "updatedAt"],
    description: "Originale Fiken-PDF-er og operativ betalingsoppfølging. Originalfilen kan ikke erstattes etter bekreftelse.",
  },
  access: { create: adminOnly, read: adminOnly, update: adminOnly, delete: () => false },
  hooks: { beforeChange: [protectOfficialInvoice] },
  fields: [
    { name: "reference", type: "text", required: true, unique: true, index: true },
    { name: "lead", type: "relationship", relationTo: "leads", required: true, index: true },
    { name: "workOrder", type: "relationship", relationTo: "work-orders", required: true, index: true },
    { name: "invoiceRecord", type: "relationship", relationTo: "invoice-records", required: true, index: true },
    { name: "status", type: "select", required: true, defaultValue: "needs_review", index: true, options: ["needs_review", "issued", "sent", "awaiting_payment", "paid", "overdue", "credited", "cancelled"] },
    { name: "originalDocument", type: "relationship", relationTo: "private-media", required: true, admin: { readOnly: true } },
    { name: "originalHash", type: "text", required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: "extractionStatus", type: "select", required: true, defaultValue: "needs_review", index: true, options: ["needs_review", "confirmed", "failed"] },
    { name: "extractedData", type: "json", admin: { readOnly: true } },
    { name: "invoiceNumber", type: "text", unique: true, index: true },
    { name: "issuedAt", type: "date" },
    { name: "dueAt", type: "date", index: true },
    { name: "subtotalExVatOre", type: "number", min: 0 },
    { name: "vatOre", type: "number", min: 0 },
    { name: "totalIncVatOre", type: "number", min: 0 },
    { name: "confirmedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "confirmedAt", type: "date", admin: { readOnly: true } },
    { name: "sentAt", type: "date", admin: { readOnly: true } },
    { name: "paidAmountOre", type: "number", min: 1 },
    { name: "paidAt", type: "date" },
    { name: "bankReference", type: "text", label: "Bankreferanse (valgfri)" },
    { name: "bankCheckedAt", type: "date", admin: { readOnly: true } },
    { name: "bankCheckedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "adminNote", type: "textarea", label: "Intern merknad" },
  ],
};

