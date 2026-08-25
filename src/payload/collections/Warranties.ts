import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import { documentHash } from "@/lib/quotes/document";
import { adminOnly } from "../access/roles";

export const protectWarranty: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (operation === "create") {
    if (data.status && data.status !== "active") throw new Error("A confirmed warranty must start as active");
    data.documentHash = documentHash(data.snapshot);
    return data;
  }
  if (!originalDoc) return data;
  const immutable = ["lead", "workOrder", "snapshot", "documentHash", "scope", "startsAt", "endsAt", "termsVersion"];
  if (immutable.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]))) throw new Error("An active warranty is immutable");
  if (data.status && data.status !== originalDoc.status && !(originalDoc.status === "active" && ["expired", "revoked"].includes(data.status))) throw new Error(`Invalid warranty status transition: ${originalDoc.status} -> ${data.status}`);
  return data;
};

export const Warranties: CollectionConfig = {
  slug: "warranties",
  labels: { singular: "Garanti", plural: "Garantier" },
  admin: { group: "Arbeid", useAsTitle: "reference", defaultColumns: ["reference", "workOrder", "status", "startsAt", "endsAt", "updatedAt"], description: "Saksbekreftede garantier. Omfang og varighet må kontrolleres av administrator før aktivering." },
  access: { create: adminOnly, read: adminOnly, update: adminOnly, delete: () => false },
  hooks: { beforeChange: [protectWarranty] },
  fields: [
    { name: "reference", type: "text", required: true, unique: true, index: true },
    { name: "lead", type: "relationship", relationTo: "leads", required: true, index: true },
    { name: "workOrder", type: "relationship", relationTo: "work-orders", required: true, unique: true, index: true },
    { name: "status", type: "select", required: true, defaultValue: "active", index: true, options: ["active", "expired", "revoked"] },
    { name: "scope", type: "textarea", required: true },
    { name: "startsAt", type: "date", required: true, index: true },
    { name: "endsAt", type: "date", required: true, index: true },
    { name: "termsVersion", type: "text", required: true },
    { name: "snapshot", type: "json", required: true, admin: { readOnly: true } },
    { name: "documentHash", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "document", type: "relationship", relationTo: "private-media", admin: { readOnly: true } },
    { name: "approvedBy", type: "relationship", relationTo: "users", required: true, admin: { readOnly: true } },
    { name: "approvedAt", type: "date", required: true, admin: { readOnly: true } },
  ],
};
