import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from "payload";
import { assertContractTransition, type ContractStatus } from "@/lib/quotes/workflow";
import { adminOnly } from "../access/roles";

const immutableFields = ["quote", "version", "snapshot", "documentHash", "termsVersion"] as const;

export const protectContractVersion: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (operation === "create" && data.status && data.status !== "draft") throw new Error("New contracts must start as drafts");
  if (!originalDoc) return data;
  if (data.status && data.status !== originalDoc.status) assertContractTransition(originalDoc.status as ContractStatus, data.status as ContractStatus);
  if (originalDoc.status !== "draft") {
    const changed = immutableFields.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]));
    if (changed) throw new Error("An issued or signed contract is immutable. Create a new version.");
  }
  if (originalDoc.status === "signed" && Object.keys(data).some((key) => key !== "updatedAt")) throw new Error("A signed contract cannot be changed");
  return data;
};

export const preventSignedContractDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const contract = await req.payload.findByID({ collection: "contracts", id, depth: 0, overrideAccess: true, req });
  if (contract.status === "signed") throw new Error("Signed contracts are immutable records and cannot be deleted through the admin UI.");
};

export const Contracts: CollectionConfig = {
  slug: "contracts",
  labels: { singular: "Kontrakt", plural: "Kontrakter" },
  admin: {
    group: "Priser og tilbud", useAsTitle: "reference",
    defaultColumns: ["reference", "quote", "version", "status", "signedAt", "updatedAt"],
    description: "Låste kontraktsdokumenter med hash, samtykker og signaturbevis.",
  },
  access: { admin: ({ req }) => adminOnly({ req }) === true, create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly },
  hooks: { beforeChange: [protectContractVersion], beforeDelete: [preventSignedContractDeletion] },
  fields: [
    { name: "reference", type: "text", required: true, unique: true, index: true },
    { name: "quote", type: "relationship", relationTo: "quotes", required: true, index: true },
    { name: "version", type: "number", required: true, min: 1 },
    { name: "supersedes", type: "relationship", relationTo: "contracts" },
    { name: "snapshot", type: "json", required: true, admin: { readOnly: true } },
    { name: "documentHash", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "termsVersion", type: "text", required: true },
    { name: "status", type: "select", required: true, defaultValue: "draft", index: true, options: [
      { label: "Utkast", value: "draft" }, { label: "Utstedt", value: "issued" }, { label: "Signert", value: "signed" },
      { label: "Avslått", value: "declined" }, { label: "Tilbakekalt", value: "revoked" }, { label: "Erstattet", value: "superseded" },
    ] },
    { name: "signatureEvidence", type: "json", admin: { readOnly: true } },
    { name: "signedDocument", type: "relationship", relationTo: "private-media", admin: { readOnly: true } },
    { name: "signedAt", type: "date", admin: { readOnly: true } },
    { name: "workOrderAction", type: "ui", admin: { components: { Field: "/components/ContractWorkOrderAction" } } },
  ],
};
