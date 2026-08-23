import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from "payload";
import { changeDocumentHash } from "@/lib/change-agreements/document";
import { assertChangeTransition, type ChangeStatus } from "@/lib/change-agreements/workflow";
import { adminOnly, userIsAdmin } from "../access/roles";

const immutableFields = ["workOrder", "contract", "version", "snapshot", "documentHash", "reasonCode", "beforeTotalIncVatOre", "afterTotalIncVatOre", "validUntil"];

export const protectChangeAgreement: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req, context }) => {
  if (operation === "create") {
    if (data.status && data.status !== "draft") throw new Error("New change agreements must start as drafts");
    if (data.snapshot) data.documentHash = changeDocumentHash(data.snapshot);
    return data;
  }
  if (!originalDoc) return data;
  if (data.status && data.status !== originalDoc.status) assertChangeTransition(originalDoc.status as ChangeStatus, data.status as ChangeStatus);
  if (data.status === "approved" && originalDoc.status !== "approved") {
    if (!userIsAdmin(req.user) && context?.trustedChangeApproval !== true) throw new Error("Only an active administrator may approve a change agreement");
    const snapshot = data.snapshot ?? originalDoc.snapshot;
    const hash = data.documentHash ?? originalDoc.documentHash;
    if (changeDocumentHash(snapshot) !== hash) throw new Error("Change agreement document hash mismatch");
    data.approvedBy = data.approvedBy ?? req.user?.id;
    data.approvedAt = data.approvedAt ?? new Date().toISOString();
  }
  if (originalDoc.status !== "draft" && immutableFields.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]))) {
    throw new Error("An approved change agreement is immutable. Create a new version.");
  }
  if (originalDoc.status === "accepted" && Object.keys(data).some((key) => key !== "updatedAt")) throw new Error("An accepted change agreement is immutable");
  return data;
};

export const preventAcceptedChangeDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const agreement = await req.payload.findByID({ collection: "change-agreements", id, depth: 0, overrideAccess: true, req });
  if (agreement.status === "accepted") throw new Error("Accepted change agreements must be retained with the contract history");
};

export const ChangeAgreements: CollectionConfig = {
  slug: "change-agreements",
  labels: { singular: "Endringsavtale", plural: "Endringsavtaler" },
  admin: { group: "Priser og tilbud", useAsTitle: "reference", defaultColumns: ["reference", "workOrder", "version", "status", "beforeTotalIncVatOre", "afterTotalIncVatOre", "updatedAt"], description: "Versjonerte pris-/omfangsendringer som krever admin og skriftlig kundegodkjenning." },
  access: { admin: ({ req }) => adminOnly({ req }) === true, create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly },
  hooks: { beforeChange: [protectChangeAgreement], beforeDelete: [preventAcceptedChangeDeletion] },
  fields: [
    { name: "reference", type: "text", required: true, unique: true, index: true },
    { name: "workOrder", type: "relationship", relationTo: "work-orders", required: true, index: true },
    { name: "contract", type: "relationship", relationTo: "contracts", required: true, index: true },
    { name: "version", type: "number", required: true, min: 1 },
    { name: "supersedes", type: "relationship", relationTo: "change-agreements" },
    { name: "snapshot", type: "json", required: true, admin: { readOnly: true } },
    { name: "documentHash", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "reasonCode", type: "select", required: true, options: ["over_tolerance", "over_maximum", "scope_change"] },
    { name: "reasonDescription", type: "textarea", required: true },
    { name: "beforeTotalIncVatOre", type: "number", required: true, admin: { readOnly: true } },
    { name: "afterTotalIncVatOre", type: "number", required: true, admin: { readOnly: true } },
    { name: "validUntil", type: "date", required: true, index: true },
    { name: "status", type: "select", required: true, defaultValue: "draft", index: true, options: [
      { label: "Utkast", value: "draft" }, { label: "Godkjent", value: "approved" }, { label: "Sendt", value: "sent" }, { label: "Åpnet", value: "viewed" },
      { label: "Akseptert", value: "accepted" }, { label: "Avslått", value: "declined" }, { label: "Tilbakekalt", value: "revoked" }, { label: "Erstattet", value: "superseded" },
    ] },
    { name: "approvedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "approvedAt", type: "date", admin: { readOnly: true } },
    { name: "sentAt", type: "date", admin: { readOnly: true } },
    { name: "viewedAt", type: "date", admin: { readOnly: true } },
    { name: "acceptanceEvidence", type: "json", admin: { readOnly: true } },
    { name: "acceptedDocument", type: "relationship", relationTo: "private-media", admin: { readOnly: true } },
    { name: "acceptedAt", type: "date", admin: { readOnly: true } },
    { name: "declinedAt", type: "date", admin: { readOnly: true } },
    { name: "changeActions", type: "ui", admin: { components: { Field: "/components/ChangeAgreementActions" } } },
  ],
};
