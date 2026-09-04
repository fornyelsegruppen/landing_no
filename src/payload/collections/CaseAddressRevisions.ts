import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
} from "payload";

const denyExternalAccess = () => false;

export const protectCaseAddressRevisionAppend: CollectionBeforeChangeHook = ({
  context,
  data,
  operation,
}) => {
  if (operation !== "create") {
    throw new Error("Case address history is append-only");
  }
  if (context?.trustedCaseAddressRevisionAppend !== true) {
    throw new Error(
      "Case address history requires the canonical Preview command",
    );
  }
  return data;
};

export const rejectCaseAddressRevisionDelete: CollectionBeforeDeleteHook =
  () => {
    throw new Error("Case address history is append-only");
  };

export const CaseAddressRevisions: CollectionConfig = {
  slug: "case-address-revisions",
  admin: { hidden: true },
  access: {
    create: denyExternalAccess,
    delete: denyExternalAccess,
    read: denyExternalAccess,
    update: denyExternalAccess,
  },
  hooks: {
    beforeChange: [protectCaseAddressRevisionAppend],
    beforeDelete: [rejectCaseAddressRevisionDelete],
  },
  fields: [
    {
      name: "ledgerKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "revisionKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    { name: "lead", type: "relationship", relationTo: "leads", index: true },
    { name: "caseId", type: "text", required: true, index: true },
    { name: "addressRevision", type: "number", required: true, min: 2 },
    {
      name: "previousAddressRevision",
      type: "number",
      required: true,
      min: 1,
    },
    {
      name: "expectedCaseRevision",
      type: "number",
      required: true,
      min: 1,
    },
    {
      name: "resultingCaseRevision",
      type: "number",
      required: true,
      min: 2,
    },
    { name: "idempotencyKey", type: "text", required: true, index: true },
    { name: "commandHash", type: "text", required: true, index: true },
    { name: "correlationId", type: "text", required: true, index: true },
    { name: "actor", type: "relationship", relationTo: "users", index: true },
    {
      name: "reasonCode",
      type: "select",
      required: true,
      options: [
        "operator_correction",
        "customer_confirmation",
        "provider_resolution",
        "data_quality_recovery",
      ],
    },
    { name: "before", type: "json", required: true },
    { name: "after", type: "json", required: true },
    { name: "beforeHash", type: "text", required: true, index: true },
    { name: "afterHash", type: "text", required: true, index: true },
    {
      name: "rfInvalidationStatus",
      type: "select",
      required: true,
      options: ["invalidated", "not_applicable"],
    },
    { name: "invalidatedRfSnapshotId", type: "text", index: true },
    { name: "invalidatedRfSnapshotRevision", type: "number", min: 1 },
    { name: "invalidatedRfSnapshotHash", type: "text", index: true },
    { name: "occurredAt", type: "date", required: true, index: true },
    { name: "result", type: "json", required: true },
  ],
};
