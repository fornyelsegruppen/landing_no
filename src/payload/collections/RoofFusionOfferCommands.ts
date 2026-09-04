import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
} from "payload";

const denyExternalAccess = () => false;

export const protectRoofFusionOfferCommandAppend: CollectionBeforeChangeHook = ({
  context,
  data,
  operation,
}) => {
  if (operation !== "create") {
    throw new Error("Roof Fusion offer commands are append-only");
  }
  if (context?.trustedRoofFusionOfferCommandAppend !== true) {
    throw new Error(
      "Roof Fusion offer commands require the canonical Preview bridge",
    );
  }
  return data;
};

export const rejectRoofFusionOfferCommandDelete: CollectionBeforeDeleteHook =
  () => {
    throw new Error("Roof Fusion offer commands are append-only");
  };

export const RoofFusionOfferCommands: CollectionConfig = {
  slug: "roof-fusion-offer-commands",
  admin: { hidden: true },
  access: {
    create: denyExternalAccess,
    delete: denyExternalAccess,
    read: denyExternalAccess,
    update: denyExternalAccess,
  },
  hooks: {
    beforeChange: [protectRoofFusionOfferCommandAppend],
    beforeDelete: [rejectRoofFusionOfferCommandDelete],
  },
  fields: [
    { name: "ledgerKey", type: "text", required: true, unique: true, index: true },
    {
      name: "idempotencyScopeKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    { name: "caseId", type: "text", required: true, index: true },
    { name: "idempotencyKey", type: "text", required: true, index: true },
    { name: "commandHash", type: "text", required: true, index: true },
    { name: "caseRevision", type: "number", required: true, min: 1 },
    { name: "addressRevision", type: "number", required: true, min: 1 },
    { name: "snapshotId", type: "text", required: true, index: true },
    { name: "snapshotRevision", type: "number", required: true, min: 1 },
    { name: "snapshotHash", type: "text", required: true, index: true },
    { name: "inputHash", type: "text", required: true, index: true },
    { name: "rendererHash", type: "text", required: true, index: true },
    {
      name: "measurement",
      type: "relationship",
      relationTo: "roof-measurements",
      required: true,
      index: true,
    },
    {
      name: "quote",
      type: "relationship",
      relationTo: "quotes",
      required: true,
      index: true,
    },
    {
      name: "contract",
      type: "relationship",
      relationTo: "contracts",
      required: true,
      index: true,
    },
    { name: "actor", type: "relationship", relationTo: "users", required: true },
    { name: "correlationId", type: "text", required: true, index: true },
    { name: "occurredAt", type: "date", required: true, index: true },
    { name: "result", type: "json", required: true },
  ],
};
