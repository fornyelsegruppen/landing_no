import type { CollectionConfig } from "payload";
import {
  adminOnly,
  adminsAndEditors,
  authenticatedOrPublished,
} from "../access/roles";

export const Projects: CollectionConfig = {
  slug: "projects",
  admin: {
    group: "Innstillinger",
    useAsTitle: "titleNo",
    defaultColumns: ["titleNo", "order", "updatedAt"],
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
    { name: "titleNo", type: "text", required: true, label: "Title (NO)" },
    { name: "titleEn", type: "text", required: true, label: "Title (EN)" },
    { name: "order", type: "number", defaultValue: 0 },
    {
      name: "stages",
      type: "array",
      labels: { singular: "Stage", plural: "Stages" },
      fields: [
        {
          name: "label",
          type: "select",
          required: true,
          options: [
            { label: "Before", value: "before" },
            { label: "During", value: "during" },
            { label: "After", value: "after" },
          ],
        },
        {
          name: "captionNo",
          type: "text",
          required: true,
          label: "Caption (NO)",
        },
        {
          name: "captionEn",
          type: "text",
          required: true,
          label: "Caption (EN)",
        },
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          label: "Image",
          admin: {
            description: "Upload via Media library (Vercel Blob). Preferred.",
          },
        },
        {
          name: "imageUrl",
          type: "text",
          label: "Image URL (fallback)",
          admin: {
            description: "Used only if no uploaded image is selected",
          },
          validate: (
            value: string | null | undefined,
            { siblingData }: { siblingData: { image?: unknown } },
          ) => {
            if (!value && !siblingData?.image) {
              return "Upload an image or paste an image URL";
            }
            return true;
          },
        },
      ],
    },
  ],
};
