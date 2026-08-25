import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import { documentHash } from "@/lib/quotes/document";
import { adminOnly } from "../access/roles";

export const protectInvoice: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (operation === "create") {
    if (data.status && data.status !== "draft") throw new Error("New invoice records must start as drafts");
    data.documentHash = documentHash(data.snapshot);
    return data;
  }
  if (!originalDoc) return data;
  const immutableAmounts = ["lead", "workOrder", "subtotalExVatOre", "vatOre", "totalIncVatOre", "issuedAt", "dueAt"];
  if (immutableAmounts.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]))) throw new Error("The final invoice basis is immutable");
  if ("snapshot" in data && JSON.stringify(data.snapshot) !== JSON.stringify(originalDoc.snapshot)) {
    if (originalDoc.status !== "draft") throw new Error("An approved invoice record is immutable");
    data.documentHash = documentHash(data.snapshot);
  }
  const nextStatus = data.status ?? originalDoc.status;
  if (data.status && data.status !== originalDoc.status) {
    const transitions: Record<string, string[]> = { draft: ["approved", "cancelled"], approved: ["exported", "cancelled"], exported: ["sent", "paid", "cancelled"], sent: ["paid", "overdue", "cancelled"], overdue: ["paid", "cancelled"], paid: [], cancelled: [] };
    if (!transitions[originalDoc.status]?.includes(data.status)) throw new Error(`Invalid invoice status transition: ${originalDoc.status} -> ${data.status}`);
  }
  const merged = { ...originalDoc, ...data };
  if (["exported", "sent", "paid", "overdue"].includes(nextStatus) && !merged.externalReference?.trim()) throw new Error("Accounting-system reference is required");
  const now = new Date().toISOString();
  if (nextStatus === "approved" && originalDoc.status !== "approved") data.approvedAt = data.approvedAt ?? now;
  if (nextStatus === "sent" && originalDoc.status !== "sent") data.sentAt = data.sentAt ?? now;
  if (nextStatus === "paid" && originalDoc.status !== "paid") data.paidAt = data.paidAt ?? now;
  return data;
};

export const InvoiceRecords: CollectionConfig = {
  slug: "invoice-records",
  labels: { singular: "Fakturautkast", plural: "Fakturautkast" },
  admin: { group: "Arbeid", useAsTitle: "reference", defaultColumns: ["reference", "workOrder", "status", "totalIncVatOre", "dueAt", "updatedAt"], description: "Interne fakturautkast. Ikke bokført faktura før godkjent eksport til valgt regnskapssystem." },
  access: { create: adminOnly, read: adminOnly, update: adminOnly, delete: () => false },
  hooks: { beforeChange: [protectInvoice] },
  fields: [
    { name: "reference", type: "text", required: true, unique: true, index: true },
    { name: "lead", type: "relationship", relationTo: "leads", required: true, index: true },
    { name: "workOrder", type: "relationship", relationTo: "work-orders", required: true, unique: true, index: true },
    { name: "status", type: "select", required: true, defaultValue: "draft", index: true, options: ["draft", "approved", "exported", "sent", "paid", "overdue", "cancelled"] },
    { name: "snapshot", type: "json", required: true, admin: { readOnly: true } },
    { name: "documentHash", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "subtotalExVatOre", type: "number", required: true, admin: { readOnly: true } },
    { name: "vatOre", type: "number", required: true, admin: { readOnly: true } },
    { name: "totalIncVatOre", type: "number", required: true, admin: { readOnly: true } },
    { name: "issuedAt", type: "date", required: true },
    { name: "dueAt", type: "date", required: true, index: true },
    { name: "assignedTo", type: "relationship", relationTo: "users", label: "Ansvarlig", required: true, index: true },
    { name: "externalReference", type: "text", label: "Referanse i regnskapssystem" },
    { name: "adminNote", type: "textarea", label: "Intern merknad" },
    { name: "document", type: "relationship", relationTo: "private-media", admin: { readOnly: true } },
    { name: "approvedAt", type: "date", admin: { readOnly: true } },
    { name: "sentAt", type: "date", admin: { readOnly: true } },
    { name: "paidAt", type: "date", admin: { readOnly: true } },
  ],
};
