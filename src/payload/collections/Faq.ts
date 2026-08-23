import type { CollectionConfig } from "payload";
import {
  adminOnly,
  adminsAndEditors,
  authenticatedOrPublished,
} from "../access/roles";

export const Faq: CollectionConfig = {
  slug: "faq",
  admin: {
    group: "Innstillinger",
    useAsTitle: "questionNo",
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: authenticatedOrPublished,
    readVersions: adminsAndEditors,
    update: adminsAndEditors,
  },
  versions: {
    drafts: true,
    maxPerDoc: 20,
  },
  fields: [
    { name: "questionNo", type: "text", required: true },
    { name: "questionEn", type: "text", required: true },
    { name: "answerNo", type: "textarea", required: true },
    { name: "answerEn", type: "textarea", required: true },
    { name: "order", type: "number", defaultValue: 0 },
  ],
};
