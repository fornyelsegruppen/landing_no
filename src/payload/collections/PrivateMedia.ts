import type { CollectionConfig } from "payload";
import { adminOnly } from "../access/roles";

export const PrivateMedia: CollectionConfig = {
  slug: "private-media",
  labels: { singular: "Private file", plural: "Private files" },
  admin: {
    group: "Innstillinger",
    useAsTitle: "filename",
    defaultColumns: ["filename", "classification", "createdAt"],
    description:
      "Customer, contract and work files. Access must always be authorized server-side.",
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  upload: {
    staticDir: "private-media",
    mimeTypes: ["image/*", "application/pdf"],
  },
  fields: [
    {
      name: "classification",
      type: "select",
      required: true,
      defaultValue: "customer",
      index: true,
      options: [
        { label: "Customer", value: "customer" },
        { label: "Measurement", value: "measurement" },
        { label: "Contract", value: "contract" },
        { label: "Work documentation", value: "work" },
      ],
    },
    { name: "ownerType", type: "text", index: true },
    { name: "ownerId", type: "text", index: true },
    {
      name: "alt",
      type: "text",
      admin: { description: "Required when the file is an image shown in UI." },
    },
  ],
};
