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
    // Cloud deployments persist the bytes with the private Blob SDK and then
    // create this protected metadata record without a second public upload.
    filesRequiredOnCreate: false,
    disableLocalStorage: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    // Prevent Payload from treating persisted private Blob metadata as an
    // image re-upload merely because the default focal point is present.
    focalPoint: false,
    crop: false,
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
