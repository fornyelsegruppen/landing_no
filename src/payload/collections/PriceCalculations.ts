import type { CollectionConfig } from "payload";
import { adminOnly } from "../access/roles";

export const PriceCalculations: CollectionConfig = {
  slug: "price-calculations",
  labels: { singular: "Prisberegning", plural: "Prisberegninger" },
  admin: {
    group: "Priser og tilbud", useAsTitle: "reference",
    defaultColumns: ["reference", "lead", "measurement", "priceRule", "totalIncVatOre", "status", "createdAt"],
    description: "Uforanderlige beregningsspor. AI kan bare forklare tall som allerede er beregnet her.",
  },
  access: { admin: ({ req }) => adminOnly({ req }) === true, create: adminOnly, read: adminOnly, update: () => false, delete: adminOnly },
  fields: [
    { name: "reference", type: "text", required: true, unique: true, index: true },
    { name: "lead", type: "relationship", relationTo: "leads", required: true, index: true },
    { name: "measurement", type: "relationship", relationTo: "roof-measurements", required: true, index: true },
    { name: "priceRule", type: "relationship", relationTo: "price-rules", required: true, index: true },
    { name: "inputSnapshot", type: "json", required: true },
    { name: "outputSnapshot", type: "json", required: true },
    { name: "inputHash", type: "text", required: true, index: true },
    { name: "subtotalExVatOre", type: "number", required: true },
    { name: "vatOre", type: "number", required: true },
    { name: "totalIncVatOre", type: "number", required: true },
    { name: "maximumTotalIncVatOre", type: "number" },
    { name: "status", type: "select", required: true, defaultValue: "draft", options: [
      { label: "Utkast", value: "draft" }, { label: "Klar for tilbud", value: "ready" }, { label: "Blokkert", value: "blocked" }, { label: "Erstattet", value: "superseded" },
    ] },
    { name: "blockingReasons", type: "json" },
  ],
};
