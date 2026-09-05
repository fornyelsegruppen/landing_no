import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from "payload";
import { resolveContractTermsApproval } from "@/lib/platform/contract-terms-approval";
import { adminOnly, userIsAdmin } from "../access/roles";

export const protectContractTerms: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (operation === "update" && originalDoc?.status === "approved") {
    const locked = ["version", "contractText", "withdrawalInstructions", "withdrawalFormUrl"];
    if (locked.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]))) {
      throw new Error("Approved contract terms are immutable. Create a new version.");
    }
  }
  if (data.status === "approved" && originalDoc?.status !== "approved") {
    if (!userIsAdmin(req.user)) throw new Error("Only an active administrator may approve contract terms");
    const approval = resolveContractTermsApproval(process.env);
    if (!approval) throw new Error("LEGAL_REVIEW_REFERENCE is required before terms approval");
    data.legalReviewReference = approval.reference;
    data.approvedBy = req.user?.id;
    data.approvedAt = new Date().toISOString();
  }
  return data;
};

export const preventApprovedTermsDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const terms = await req.payload.findByID({ collection: "contract-terms", id, depth: 0, overrideAccess: true, req });
  if (terms.status === "approved") throw new Error("Retire approved terms; do not delete the legal audit history.");
};

export const ContractTerms: CollectionConfig = {
  slug: "contract-terms",
  labels: { singular: "Kontraktsvilkår", plural: "Kontraktsvilkår" },
  admin: { group: "Priser og tilbud", useAsTitle: "version", defaultColumns: ["version", "status", "approvedAt", "legalReviewReference"], description: "Versjonerte vilkår. Produksjonsgodkjenning krever dokumentert juridisk referanse." },
  access: { admin: ({ req }) => adminOnly({ req }) === true, create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly },
  hooks: { beforeChange: [protectContractTerms], beforeDelete: [preventApprovedTermsDeletion] },
  fields: [
    { name: "version", type: "text", required: true, unique: true, index: true },
    { name: "title", type: "text", required: true },
    { name: "contractText", type: "textarea", required: true, minLength: 100 },
    { name: "withdrawalInstructions", type: "textarea", required: true, minLength: 100 },
    { name: "withdrawalFormUrl", type: "text", required: true },
    { name: "status", type: "select", required: true, defaultValue: "draft", index: true, options: [
      { label: "Utkast", value: "draft" }, { label: "Godkjent", value: "approved" }, { label: "Utgått", value: "retired" },
    ] },
    { name: "legalReviewReference", type: "text", admin: { readOnly: true } },
    { name: "approvedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "approvedAt", type: "date", admin: { readOnly: true } },
  ],
};
