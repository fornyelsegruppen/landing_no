import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
} from "payload";

const denyExternalAccess = () => false;

export const protectRoofFusionWorkbenchDraftAppendOnly: CollectionBeforeChangeHook = ({
  context,
  operation,
}) => {
  if (operation !== "create") {
    throw new Error("Roof Fusion workbench drafts are append-only");
  }
  if (context?.trustedRoofFusionWorkbenchDraftAppend !== true) {
    throw new Error("Workbench drafts require the canonical repository");
  }
};

export const rejectRoofFusionWorkbenchDraftDelete: CollectionBeforeDeleteHook = () => {
  throw new Error("Roof Fusion workbench drafts are append-only");
};

export const RoofFusionWorkbenchDrafts: CollectionConfig = {
  slug: "roof-fusion-workbench-drafts",
  admin: { hidden: true },
  access: {
    create: denyExternalAccess,
    delete: denyExternalAccess,
    read: denyExternalAccess,
    update: denyExternalAccess,
  },
  hooks: {
    beforeChange: [protectRoofFusionWorkbenchDraftAppendOnly],
    beforeDelete: [rejectRoofFusionWorkbenchDraftDelete],
  },
  fields: [
    { name: "draftId", type: "text", required: true, unique: true, index: true },
    { name: "caseId", type: "text", required: true, index: true },
    { name: "caseRevisionKey", type: "text", required: true, unique: true, index: true },
    { name: "revision", type: "number", required: true, min: 1, index: true },
    { name: "supersedesDraftId", type: "text", index: true },
    { name: "draftHash", type: "text", required: true, index: true },
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true },
    { name: "state", type: "text", required: true, index: true },
    { name: "sourceContentHash", type: "text", required: true, index: true },
    { name: "draft", type: "json", required: true, admin: { hidden: true } },
  ],
};
