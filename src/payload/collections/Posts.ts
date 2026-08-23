import type { CollectionConfig } from "payload";
import { validateContentSlug } from "../../lib/content-paths";
import {
  adminOnly,
  adminsAndEditors,
  authenticatedOrPublished,
} from "../access/roles";

export const Posts: CollectionConfig = {
  slug: "posts",
  admin: {
    group: "Blogg",
    useAsTitle: "titleNo",
    defaultColumns: ["titleNo", "slug", "publishedAt", "_status"],
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
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      validate: (value: string | string[] | null | undefined) =>
        validateContentSlug(Array.isArray(value) ? value[0] : value, {
          allowReserved: true,
        }),
      admin: {
        description: "Lowercase URL segment below /blogg.",
      },
    },
    { name: "titleNo", type: "text", required: true, label: "Title (NO)" },
    { name: "titleEn", type: "text", required: true, label: "Title (EN)" },
    {
      name: "excerptNo",
      type: "textarea",
      label: "Excerpt (NO)",
      admin: { rows: 3 },
    },
    {
      name: "excerptEn",
      type: "textarea",
      label: "Excerpt (EN)",
      admin: { rows: 3 },
    },
    {
      name: "contentNo",
      type: "textarea",
      required: true,
      label: "Content (NO)",
      admin: {
        rows: 20,
        description:
          "Plain text with optional Markdown-style ## headings and - lists.",
      },
    },
    {
      name: "contentEn",
      type: "textarea",
      required: true,
      label: "Content (EN)",
      admin: {
        rows: 20,
        description:
          "Plain text with optional Markdown-style ## headings and - lists.",
      },
    },
    {
      name: "heroImage",
      type: "upload",
      relationTo: "media",
      label: "Hero image",
    },
    { name: "seoTitleNo", type: "text", label: "SEO title (NO)" },
    { name: "seoTitleEn", type: "text", label: "SEO title (EN)" },
    {
      name: "seoDescriptionNo",
      type: "textarea",
      label: "SEO description (NO)",
      admin: { rows: 3 },
    },
    {
      name: "seoDescriptionEn",
      type: "textarea",
      label: "SEO description (EN)",
      admin: { rows: 3 },
    },
    {
      name: "publishedAt",
      type: "date",
      label: "Published date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};
