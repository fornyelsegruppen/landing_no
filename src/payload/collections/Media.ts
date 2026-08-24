import type { CollectionConfig } from "payload";
import { adminOnly, adminsAndEditors } from "../access/roles";

export const Media: CollectionConfig = {
  slug: "media",
  admin: {
    group: "Blogg",
    useAsTitle: "alt",
    description:
      "Upload images here (stored on Vercel Blob). Then pick them in Site Settings or Project stages. Prefer WebP when possible; large JPEG/PNG are auto-converted when supported.",
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminsAndEditors,
  },
  upload: {
    staticDir: "media",
    mimeTypes: ["image/*"],
    formatOptions: {
      format: "webp",
      options: {
        quality: 82,
      },
    },
    imageSizes: [
      {
        name: "card",
        width: 900,
        height: 675,
        position: "centre",
        formatOptions: { format: "webp", options: { quality: 80 } },
      },
      {
        name: "hero",
        width: 2000,
        withoutEnlargement: true,
        formatOptions: { format: "webp", options: { quality: 82 } },
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      admin: {
        description: "Short description for accessibility / SEO",
      },
    },
    {
      name: "stockProvider",
      type: "select",
      label: "Bildetekilde",
      defaultValue: "manual",
      options: [
        { label: "Egen opplasting", value: "manual" },
        { label: "Pexels", value: "pexels" },
      ],
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "stockAssetId",
      type: "text",
      label: "Stockbilde-ID",
      admin: { readOnly: true },
    },
    {
      name: "stockSourceUrl",
      type: "text",
      label: "Kildeside",
      admin: { readOnly: true },
    },
    {
      name: "stockPhotographer",
      type: "text",
      label: "Fotograf",
      admin: { readOnly: true },
    },
    {
      name: "stockPhotographerUrl",
      type: "text",
      label: "Fotografside",
      admin: { readOnly: true },
    },
    {
      name: "stockLicenseUrl",
      type: "text",
      label: "Lisens",
      admin: { readOnly: true },
    },
    {
      name: "stockRetrievedAt",
      type: "date",
      label: "Hentet",
      admin: { readOnly: true },
    },
    {
      name: "stockQuery",
      type: "text",
      label: "Bildesøk",
      admin: { readOnly: true },
    },
  ],
};
