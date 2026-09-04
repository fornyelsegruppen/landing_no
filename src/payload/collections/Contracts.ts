import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from "payload";
import { assertCustomerSignatureProof, assertFullySignedContractProof } from "@/lib/contracts/signing-invariants";
import { documentHash, quoteSnapshotSchema } from "@/lib/quotes/document";
import { assertContractTransition, type ContractStatus } from "@/lib/quotes/workflow";
import { adminOnly } from "../access/roles";

const immutableFields = ["quote", "version", "snapshot", "documentHash", "termsVersion"] as const;
const roofFusionImmutableFields = [
  "reference",
  "quote",
  "version",
  "supersedes",
  "snapshot",
  "documentHash",
  "termsVersion",
] as const;

function hasRoofFusionBinding(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return false;
  const quote = (snapshot as Record<string, unknown>).quote;
  if (!quote || typeof quote !== "object" || Array.isArray(quote)) return false;
  const measurement = (quote as Record<string, unknown>).measurement;
  return Boolean(
    measurement &&
      typeof measurement === "object" &&
      !Array.isArray(measurement) &&
      (measurement as Record<string, unknown>).rfBinding,
  );
}

function assertRoofFusionContractCreateBinding(data: Record<string, unknown>) {
  if (!data.snapshot || typeof data.snapshot !== "object" || Array.isArray(data.snapshot)) {
    throw new Error("Roof Fusion contract snapshot binding is invalid");
  }
  const snapshot = data.snapshot as Record<string, unknown>;
  const quote = quoteSnapshotSchema.safeParse(snapshot.quote);
  if (
    !quote.success ||
    !quote.data.measurement.rfBinding ||
    snapshot.contractReference !== data.reference ||
    snapshot.quoteHash !== documentHash(snapshot.quote) ||
    !snapshot.terms ||
    typeof snapshot.terms !== "object" ||
    Array.isArray(snapshot.terms) ||
    (snapshot.terms as Record<string, unknown>).version !== data.termsVersion ||
    data.documentHash !== documentHash(data.snapshot)
  ) {
    throw new Error(
      "Roof Fusion contract fields disagree with the immutable quote and contract snapshots",
    );
  }
}

export const protectContractVersion: CollectionBeforeChangeHook = ({ data, originalDoc, operation, context }) => {
  if (operation === "create") {
    if (data.status && data.status !== "draft") throw new Error("New contracts must start as drafts");
    if (
      hasRoofFusionBinding(data.snapshot) &&
      context?.trustedRoofFusionOfferBridge !== true
    ) {
      throw new Error(
        "Roof Fusion contract drafts require the canonical Preview offer bridge",
      );
    }
    if (hasRoofFusionBinding(data.snapshot)) {
      assertRoofFusionContractCreateBinding(data);
    }
    return data;
  }
  if (!originalDoc) return data;
  const nextDoc = { ...originalDoc, ...data };
  if (
    hasRoofFusionBinding(nextDoc.snapshot) &&
    !hasRoofFusionBinding(originalDoc.snapshot) &&
    context?.trustedRoofFusionOfferBridge !== true
  ) {
    throw new Error(
      "Roof Fusion contract bindings require the canonical Preview offer bridge",
    );
  }
  if (hasRoofFusionBinding(originalDoc.snapshot)) {
    const changed = roofFusionImmutableFields.some(
      (field) =>
        field in data &&
        JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]),
    );
    if (changed) {
      throw new Error(
        "A Roof Fusion-bound contract draft is immutable. Create a new version.",
      );
    }
  }
  if (data.status && data.status !== originalDoc.status) {
    assertContractTransition(originalDoc.status as ContractStatus, data.status as ContractStatus);
    if (data.status === "signed" && context?.trustedCustomerSignature !== true) {
      throw new Error("A contract may only be marked signed by the verified customer-signature workflow");
    }
  }
  if (nextDoc.status === "signed") assertCustomerSignatureProof(nextDoc);
  if (originalDoc.status !== "draft") {
    const changed = immutableFields.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]));
    if (changed) throw new Error("An issued or signed contract is immutable. Create a new version.");
  }
  if (originalDoc.status === "signed") {
    const counterSignatureFields = new Set([
      "companySignatureEvidence",
      "companySignatureImage",
      "companySignedDocument",
      "companySignedAt",
      "companySignedBy",
      "updatedAt",
    ]);
    const changedFields = Object.keys(data).filter((key) =>
      JSON.stringify(data[key]) !== JSON.stringify(originalDoc[key]),
    );
    if (originalDoc.companySignedAt && changedFields.length > 0) throw new Error("A contract signed by both parties cannot be changed");
    if (changedFields.some((key) => !counterSignatureFields.has(key))) throw new Error("Only the supplier counter-signature may be added after the customer has signed");
    const companyFields = new Set([
      "companySignatureEvidence",
      "companySignatureImage",
      "companySignedDocument",
      "companySignedAt",
      "companySignedBy",
    ]);
    if (changedFields.some((key) => companyFields.has(key))) {
      if (context?.trustedCompanyCountersignature !== true) {
        throw new Error("The supplier counter-signature may only be added by the verified counter-signature workflow");
      }
      assertFullySignedContractProof(nextDoc);
    }
  }
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
    { name: "signatureEvidence", type: "json", admin: { readOnly: true, description: "Kundens signaturbevis." } },
    { name: "customerSignatureImage", type: "relationship", relationTo: "private-media", admin: { readOnly: true } },
    { name: "signedDocument", type: "relationship", relationTo: "private-media", admin: { readOnly: true, description: "Kundesignert dokument som avventer leverandørens signatur." } },
    { name: "signedAt", type: "date", admin: { readOnly: true, description: "Tidspunkt kunden signerte." } },
    { name: "companySignatureEvidence", type: "json", admin: { readOnly: true, description: "Leverandørens signaturbevis." } },
    { name: "companySignatureImage", type: "relationship", relationTo: "private-media", admin: { readOnly: true } },
    { name: "companySignedDocument", type: "relationship", relationTo: "private-media", admin: { readOnly: true, description: "Endelig kontrakt signert av begge parter." } },
    { name: "companySignedAt", type: "date", index: true, admin: { readOnly: true } },
    { name: "companySignedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "workOrderAction", type: "ui", admin: { components: { Field: "/components/ContractWorkOrderAction" } } },
  ],
};
