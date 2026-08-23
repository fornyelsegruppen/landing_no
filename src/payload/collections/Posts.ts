import type { CollectionConfig } from "payload";
import { validateContentSlug } from "../../lib/content-paths";
import { prepareEditorialPost } from "../../lib/blog/editorial-policy";
import {
  adminOnly,
  adminsAndEditors,
  authenticatedOrPublished,
} from "../access/roles";

export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Artikkel", plural: "Blogg" },
  admin: {
    group: "Blogg",
    useAsTitle: "titleNo",
    defaultColumns: [
      "titleNo",
      "primaryKeyword",
      "editorialStatus",
      "scheduledAt",
      "publishedAt",
      "_status",
    ],
    livePreview: {
      url: ({ data, req }) =>
        data.slug
          ? `${req.payload.config.serverURL}/api/preview?locale=no&path=${encodeURIComponent(`/no/blogg/${String(data.slug)}`)}`
          : null,
    },
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: authenticatedOrPublished,
    readVersions: adminsAndEditors,
    update: adminsAndEditors,
  },
  versions: {
    drafts: { autosave: true },
    maxPerDoc: 20,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) =>
        prepareEditorialPost(originalDoc, data) as typeof data,
    ],
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
    { name: "titleEn", type: "text", label: "Title (EN, optional)" },
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
          "Safe Markdown: ## headings, lists, **bold** and [link text](https://...). HTML is not rendered.",
      },
    },
    {
      name: "contentEn",
      type: "textarea",
      label: "Content (EN, optional)",
      admin: {
        rows: 20,
        description:
          "Leave empty until a complete English version has been reviewed.",
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
    {
      name: "editorialStatus",
      type: "select",
      label: "Redaksjonell status",
      required: true,
      defaultValue: "draft",
      index: true,
      admin: { position: "sidebar" },
      options: [
        { label: "Utkast", value: "draft" },
        { label: "AI-kontroll", value: "ai_qa" },
        { label: "Menneskelig kontroll", value: "human_review" },
        { label: "Avvist", value: "rejected" },
        { label: "Godkjent", value: "approved" },
        { label: "Planlagt", value: "scheduled" },
        { label: "Publisert", value: "published" },
      ],
    },
    {
      name: "scheduledAt",
      type: "date",
      label: "Planlagt publisering",
      index: true,
      admin: {
        position: "sidebar",
        description:
          "Kan bare lagres når redaksjonell status er Godkjent eller Planlagt.",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "searchIntent",
      type: "select",
      label: "Søkeintensjon",
      options: [
        { label: "Informasjon", value: "informational" },
        { label: "Kommersiell", value: "commercial" },
        { label: "Lokal", value: "local" },
        { label: "Sammenligning", value: "comparison" },
      ],
    },
    { name: "primaryKeyword", type: "text", label: "Primært søkeord", index: true },
    {
      name: "secondaryKeywords",
      type: "array",
      label: "Sekundære søkeord",
      fields: [{ name: "keyword", type: "text", required: true }],
    },
    { name: "primaryService", type: "relationship", relationTo: "services" },
    { name: "locationText", type: "text", label: "Relevant sted/område" },
    { name: "category", type: "text", label: "Innholdskategori" },
    {
      name: "sources",
      type: "array",
      label: "Kilder",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true },
        { name: "publisher", type: "text" },
        { name: "accessedAt", type: "date", label: "Kontrollert dato" },
      ],
    },
    { name: "authorName", type: "text", label: "Forfatter" },
    { name: "reviewerName", type: "text", label: "Faglig kontrollør" },
    { name: "reviewedAt", type: "date", label: "Faglig kontrollert" },
    { name: "aiAssisted", type: "checkbox", label: "AI-assistert", defaultValue: false },
    { name: "aiGenerationRun", type: "relationship", relationTo: "seo-runs" },
    {
      name: "qualityScore",
      type: "number",
      label: "Kvalitetsscore",
      min: 0,
      max: 100,
    },
    { name: "qualityChecks", type: "json", label: "Kvalitetskontroll" },
    {
      name: "reviewFlags",
      type: "array",
      label: "Kontrollpunkter",
      fields: [{ name: "flag", type: "textarea", required: true }],
    },
    {
      name: "proposedInternalLinks",
      type: "array",
      label: "Foreslåtte internlenker",
      fields: [
        { name: "href", type: "text", required: true },
        { name: "anchor", type: "text", required: true },
        { name: "reason", type: "textarea", required: true },
      ],
    },
    { name: "imageBrief", type: "textarea", label: "Bildebehov" },
    { name: "imageAlt", type: "text", label: "Foreslått alt-tekst" },
    {
      name: "relatedPosts",
      type: "relationship",
      relationTo: "posts",
      hasMany: true,
      label: "Relaterte artikler",
    },
    {
      name: "relatedServices",
      type: "relationship",
      relationTo: "services",
      hasMany: true,
      label: "Relaterte tjenester",
    },
    {
      name: "ctaVariant",
      type: "select",
      label: "CTA-variant",
      defaultValue: "assessment",
      options: [
        { label: "Gratis vurdering", value: "assessment" },
        { label: "Takvask", value: "wash" },
        { label: "Takfornying", value: "renewal" },
        { label: "Nytt tak", value: "new_roof" },
      ],
    },
    {
      name: "faqItems",
      type: "array",
      label: "Spørsmål og svar",
      fields: [
        { name: "questionNo", type: "text", required: true, label: "Spørsmål (NO)" },
        { name: "answerNo", type: "textarea", required: true, label: "Svar (NO)" },
        { name: "questionEn", type: "text", label: "Question (EN, optional)" },
        { name: "answerEn", type: "textarea", label: "Answer (EN, optional)" },
      ],
    },
    { name: "lastContentAuditAt", type: "date", label: "Sist innholdskontroll" },
    {
      name: "leadPerformance",
      type: "group",
      label: "Henvendelser fra artikkelen (siste 90 dager)",
      fields: [
        { name: "leads", type: "number", label: "Henvendelser", min: 0 },
        { name: "convertedLeads", type: "number", label: "Konverterte", min: 0 },
        { name: "updatedAt", type: "date", label: "Sist beregnet" },
      ],
    },
    {
      name: "searchPerformance",
      type: "group",
      label: "Search Console (siste 90 dager)",
      fields: [
        { name: "impressions", type: "number", label: "Visninger", min: 0 },
        { name: "clicks", type: "number", label: "Klikk", min: 0 },
        { name: "ctr", type: "number", label: "CTR", min: 0 },
        { name: "averagePosition", type: "number", label: "Gjennomsnittsposisjon", min: 0 },
        { name: "updatedAt", type: "date", label: "Sist hentet" },
        { name: "indexVerdict", type: "text", label: "Indekseringsvurdering" },
        { name: "coverageState", type: "text", label: "Dekningsstatus" },
        { name: "lastCrawlAt", type: "date", label: "Siste Google-gjennomgang" },
      ],
    },
    { name: "performanceNotes", type: "textarea", label: "Resultatnotater" },
    {
      name: "contentAudit",
      type: "group",
      label: "Innholdsanbefaling",
      admin: { description: "Systemets anbefaling er beslutningsstøtte. Administrator må kontrollere og utføre eventuell endring." },
      fields: [
        { name: "recommendation", type: "select", options: [
          { label: "Behold", value: "keep" }, { label: "Oppdater", value: "update" }, { label: "Slå sammen", value: "merge" }, { label: "Redirect", value: "redirect" },
        ] },
        { name: "reason", type: "textarea", label: "Begrunnelse" },
        { name: "generatedAt", type: "date", label: "Beregnet" },
        { name: "targetPost", type: "relationship", relationTo: "posts", label: "Valgt målside" },
        { name: "reviewedAt", type: "date", label: "Kontrollert av administrator" },
      ],
    },
    {
      name: "workflowActions",
      type: "ui",
      admin: {
        components: { Field: "/components/BlogWorkflowActions" },
      },
    },
  ],
};
