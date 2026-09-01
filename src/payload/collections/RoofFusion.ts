import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
} from "payload";

const denyExternalAccess = () => false;

export const protectRoofFusionAppendOnlyWrite: CollectionBeforeChangeHook = ({
  context,
  data,
  operation,
}) => {
  if (operation !== "create") {
    throw new Error("Roof Fusion persistence is append-only");
  }
  if (context?.trustedRoofFusionAppend !== true) {
    throw new Error("Roof Fusion records require the canonical repository");
  }
  return data;
};

export const rejectRoofFusionDelete: CollectionBeforeDeleteHook = () => {
  throw new Error("Roof Fusion persistence is append-only");
};

const appendOnlyAccess = {
  create: denyExternalAccess,
  delete: denyExternalAccess,
  read: denyExternalAccess,
  update: denyExternalAccess,
};

export const RoofFusionSnapshots: CollectionConfig = {
  slug: "roof-fusion-snapshots",
  admin: { hidden: true },
  access: appendOnlyAccess,
  hooks: {
    beforeChange: [protectRoofFusionAppendOnlyWrite],
    beforeDelete: [rejectRoofFusionDelete],
  },
  fields: [
    {
      name: "snapshotId",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    { name: "caseId", type: "text", required: true, index: true },
    {
      name: "caseRevisionKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { hidden: true },
    },
    { name: "revision", type: "number", required: true, min: 1, index: true },
    { name: "supersedesSnapshotId", type: "text", index: true },
    { name: "snapshotHash", type: "text", required: true, index: true },
    { name: "state", type: "text", required: true, index: true },
    { name: "measurementClass", type: "text", required: true, index: true },
    {
      name: "snapshot",
      type: "json",
      required: true,
      admin: { hidden: true },
    },
  ],
};

export const RoofFusionCommands: CollectionConfig = {
  slug: "roof-fusion-commands",
  admin: { hidden: true },
  access: appendOnlyAccess,
  hooks: {
    beforeChange: [protectRoofFusionAppendOnlyWrite],
    beforeDelete: [rejectRoofFusionDelete],
  },
  fields: [
    {
      name: "ledgerKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { hidden: true },
    },
    { name: "caseId", type: "text", required: true, index: true },
    { name: "idempotencyKey", type: "text", required: true, index: true },
    { name: "commandHash", type: "text", required: true, index: true },
    { name: "commandType", type: "text", required: true, index: true },
    { name: "snapshotId", type: "text", required: true, index: true },
    {
      name: "result",
      type: "json",
      required: true,
      admin: { hidden: true },
    },
  ],
};
