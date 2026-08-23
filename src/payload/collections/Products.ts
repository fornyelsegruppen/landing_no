import type { CollectionConfig } from "payload";
import {
  adminOnly,
  adminsAndEditors,
  authenticatedOrPublished,
} from "../access/roles";

export const Products: CollectionConfig = {
  slug: "products",
  admin: {
    group: "Innstillinger",
    useAsTitle: "name",
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
    { name: "name", type: "text", required: true },
    { name: "categoryNo", type: "text", required: true },
    { name: "categoryEn", type: "text", required: true },
    { name: "descriptionNo", type: "textarea", required: true },
    { name: "descriptionEn", type: "textarea", required: true },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      label: "Product image",
    },
    {
      name: "badgesNo",
      type: "array",
      fields: [{ name: "label", type: "text", required: true }],
    },
    {
      name: "badgesEn",
      type: "array",
      fields: [{ name: "label", type: "text", required: true }],
    },
    { name: "order", type: "number", defaultValue: 0 },
  ],
};
