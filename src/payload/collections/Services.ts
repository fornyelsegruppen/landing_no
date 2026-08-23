import type { CollectionConfig } from "payload";
import {
  adminOnly,
  adminsAndEditors,
  authenticatedOrPublished,
} from "../access/roles";

export const Services: CollectionConfig = {
  slug: "services",
  admin: {
    group: "Innstillinger",
    useAsTitle: "titleNo",
    defaultColumns: ["titleNo", "featured", "order"],
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
    { name: "key", type: "text", required: true, unique: true },
    { name: "titleNo", type: "text", required: true, label: "Title (NO)" },
    { name: "titleEn", type: "text", required: true, label: "Title (EN)" },
    {
      name: "descriptionNo",
      type: "textarea",
      required: true,
      label: "Description (NO)",
    },
    {
      name: "descriptionEn",
      type: "textarea",
      required: true,
      label: "Description (EN)",
    },
    {
      name: "icon",
      type: "select",
      defaultValue: "check",
      options: [
        { label: "Check", value: "check" },
        { label: "Shield", value: "shield" },
        { label: "Droplets", value: "droplets" },
        { label: "Paint", value: "paint" },
        { label: "Home", value: "home" },
        { label: "Wrench", value: "wrench" },
        { label: "Sparkles", value: "sparkles" },
      ],
    },
    { name: "featured", type: "checkbox", defaultValue: true },
    { name: "order", type: "number", defaultValue: 0 },
  ],
};
