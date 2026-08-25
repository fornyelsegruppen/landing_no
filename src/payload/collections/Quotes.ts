import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from "payload";
import { documentHash } from "@/lib/quotes/document";
import { assertQuoteTransition, type QuoteStatus } from "@/lib/quotes/workflow";
import { adminOnly, userIsAdmin } from "../access/roles";

const immutableFields = ["lead", "measurement", "priceCalculation", "version", "optionGroup", "optionKind", "siblingQuote", "snapshot", "snapshotHash", "termsVersion", "validUntil"] as const;

export const protectQuoteVersion: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req, context }) => {
  if (operation === "create") {
    if (data.status && data.status !== "draft") throw new Error("New quotes must start as drafts");
    if (data.snapshot) data.snapshotHash = documentHash(data.snapshot);
    return data;
  }
  if (!originalDoc) return data;
  if (data.status && data.status !== originalDoc.status) assertQuoteTransition(originalDoc.status as QuoteStatus, data.status as QuoteStatus);
  if (data.status === "approved" && originalDoc.status !== "approved") {
    if (!userIsAdmin(req.user) && context?.trustedQuoteApproval !== true) throw new Error("Only an active administrator may approve a quote");
    const snapshot = data.snapshot ?? originalDoc.snapshot;
    const expectedHash = data.snapshotHash ?? originalDoc.snapshotHash;
    if (documentHash(snapshot) !== expectedHash) throw new Error("Quote snapshot hash mismatch");
    data.approvedBy = data.approvedBy ?? req.user?.id;
    data.approvedAt = data.approvedAt ?? new Date().toISOString();
  }
  if (originalDoc.status !== "draft") {
    const changed = immutableFields.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]));
    if (changed) throw new Error("An approved or issued quote is immutable. Create a new version.");
  }
  return data;
};

export const preventLockedQuoteDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const quote = await req.payload.findByID({ collection: "quotes", id, depth: 0, overrideAccess: true, req });
  if (["accepted"].includes(quote.status)) throw new Error("Accepted quotes are retained with their signed contract.");
};

export const Quotes: CollectionConfig = {
  slug: "quotes",
  labels: { singular: "Tilbud", plural: "Tilbud" },
  admin: {
    group: "Priser og tilbud", useAsTitle: "reference",
    defaultColumns: ["reference", "lead", "version", "status", "totalIncVatOre", "validUntil", "updatedAt"],
    description: "Versjonerte kundetilbud låst til godkjent måling og prisberegning.",
  },
  access: { admin: ({ req }) => adminOnly({ req }) === true, create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly },
  hooks: { beforeChange: [protectQuoteVersion], beforeDelete: [preventLockedQuoteDeletion] },
  fields: [
    { name: "reference", type: "text", required: true, unique: true, index: true },
    { name: "lead", type: "relationship", relationTo: "leads", required: true, index: true },
    { name: "measurement", type: "relationship", relationTo: "roof-measurements", required: true },
    { name: "priceCalculation", type: "relationship", relationTo: "price-calculations", required: true },
    { name: "version", type: "number", required: true, min: 1 },
    { name: "supersedes", type: "relationship", relationTo: "quotes" },
    { name: "optionGroup", type: "text", label: "Tilbudsgruppe", index: true, admin: { readOnly: true } },
    { name: "optionKind", type: "select", label: "Alternativ", options: [{ label: "Opprinnelig", value: "base" }, { label: "Anbefalt tillegg", value: "recommended" }], admin: { readOnly: true } },
    { name: "siblingQuote", type: "relationship", relationTo: "quotes", label: "Sammenlignbart alternativ", admin: { readOnly: true } },
    { name: "snapshot", type: "json", required: true, admin: { readOnly: true } },
    { name: "snapshotHash", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "serviceDescription", type: "text", required: true },
    { name: "totalIncVatOre", type: "number", required: true, admin: { readOnly: true } },
    { name: "maximumTotalIncVatOre", type: "number", admin: { readOnly: true } },
    { name: "termsVersion", type: "text", required: true },
    { name: "validUntil", type: "date", required: true, index: true },
    { name: "status", type: "select", required: true, defaultValue: "draft", index: true, options: [
      { label: "Utkast", value: "draft" }, { label: "Godkjent", value: "approved" }, { label: "Sendt", value: "sent" },
      { label: "Åpnet", value: "viewed" }, { label: "Akseptert", value: "accepted" }, { label: "Avslått", value: "declined" },
      { label: "Utløpt", value: "expired" }, { label: "Tilbakekalt", value: "revoked" }, { label: "Erstattet", value: "superseded" },
    ] },
    { name: "approvedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "approvedAt", type: "date", admin: { readOnly: true } },
    { name: "selectedOptionQuote", type: "relationship", relationTo: "quotes", label: "Kundens valgte alternativ", admin: { readOnly: true } },
    { name: "sentAt", type: "date", admin: { readOnly: true } },
    { name: "viewedAt", type: "date", admin: { readOnly: true } },
    { name: "acceptedAt", type: "date", admin: { readOnly: true } },
    { name: "declinedAt", type: "date", admin: { readOnly: true } },
    { name: "declineReason", type: "text", label: "Strukturert avslagsårsak", admin: { readOnly: true } },
    { name: "declineComment", type: "textarea", label: "Kundens kommentar til avslag", admin: { readOnly: true } },
    { name: "quoteActions", type: "ui", admin: { components: { Field: "/components/QuoteActions" } } },
  ],
};
