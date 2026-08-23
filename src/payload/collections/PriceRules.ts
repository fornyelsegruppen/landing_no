import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from "payload";
import { adminOnly, userIsAdmin } from "../access/roles";

const immutableRuleFields = ["version", "serviceKey", "unitPriceExVatOre", "vatBasisPoints", "minimumExVatOre", "toleranceBasisPoints", "maximumExVatOre", "validFrom", "validTo", "termsVersion"] as const;

export const protectApprovedPriceRule: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (operation === "update" && originalDoc?.status === "approved") {
    const changed = immutableRuleFields.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]));
    if (changed) throw new Error("An approved price rule is immutable. Create a new version instead.");
  }
  if (data.status === "approved" && originalDoc?.status !== "approved") {
    if (!userIsAdmin(req.user)) throw new Error("Only an active administrator can approve a price rule");
    data.approvedBy = req.user?.id;
    data.approvedAt = new Date().toISOString();
  }
  return data;
};

export const preventApprovedPriceRuleDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const rule = await req.payload.findByID({ collection: "price-rules", id, depth: 0, overrideAccess: true, req });
  if (rule.status === "approved") throw new Error("Retire approved price rules; do not delete their audit history.");
};

export const PriceRules: CollectionConfig = {
  slug: "price-rules",
  labels: { singular: "Prisregel", plural: "Prisregler" },
  admin: {
    group: "Priser og tilbud",
    useAsTitle: "reference",
    defaultColumns: ["reference", "serviceKey", "version", "unitPriceExVatOre", "status", "validFrom"],
    description: "Kun godkjente, versjonerte regler kan brukes. Markedsføringspriser er ikke automatisk bindende prisregler.",
  },
  access: { admin: ({ req }) => adminOnly({ req }) === true, create: adminOnly, read: adminOnly, update: adminOnly, delete: adminOnly },
  hooks: { beforeChange: [protectApprovedPriceRule], beforeDelete: [preventApprovedPriceRuleDeletion] },
  fields: [
    { name: "reference", type: "text", required: true, unique: true, index: true },
    { name: "version", type: "number", required: true, min: 1 },
    { name: "serviceKey", type: "select", required: true, index: true, options: [
      { label: "Takvask", value: "takvask" },
      { label: "Takvask + impregnering", value: "takvask_impregnering" },
      { label: "Impregnering", value: "impregnering" },
      { label: "Takmaling", value: "takmaling" },
      { label: "Nytt tak", value: "nytt_tak" },
    ] },
    { name: "unitPriceExVatOre", type: "number", required: true, min: 0, label: "Pris per m² eks. mva. (øre)" },
    { name: "vatBasisPoints", type: "number", required: true, defaultValue: 2500, min: 0, max: 10000, label: "Mva. (basispunkter)" },
    { name: "minimumExVatOre", type: "number", required: true, defaultValue: 0, min: 0, label: "Minstepris eks. mva. (øre)" },
    { name: "toleranceBasisPoints", type: "number", required: true, defaultValue: 0, min: 0, max: 5000, label: "Tillatt avvik (basispunkter)" },
    { name: "maximumExVatOre", type: "number", min: 0, label: "Makspris eks. mva. (øre), valgfritt" },
    { name: "validFrom", type: "date", required: true, index: true },
    { name: "validTo", type: "date", index: true },
    { name: "termsVersion", type: "text", required: true },
    { name: "notes", type: "textarea" },
    { name: "status", type: "select", required: true, defaultValue: "draft", index: true, options: [
      { label: "Utkast", value: "draft" }, { label: "Godkjent", value: "approved" }, { label: "Utgått", value: "retired" },
    ] },
    { name: "approvedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "approvedAt", type: "date", admin: { readOnly: true } },
  ],
};
