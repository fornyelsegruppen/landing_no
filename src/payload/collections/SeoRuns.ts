import type { CollectionConfig } from "payload";
import { adminOnly } from "../access/roles";

export const SeoRuns: CollectionConfig = {
  slug: "seo-runs",
  labels: { singular: "SEO-kjøring", plural: "SEO-kjøringer" },
  admin: {
    group: "Blogg",
    useAsTitle: "jobType",
    defaultColumns: ["jobType", "status", "startedAt", "finishedAt", "createdPost"],
    description: "Ikke-sensitive spor for temavalg, utkast og kvalitetssjekk.",
  },
  access: {
    admin: ({ req }) => adminOnly({ req }) === true,
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true },
    { name: "jobType", type: "text", required: true, index: true },
    {
      name: "triggerSource",
      type: "select",
      required: true,
      options: [
        { label: "Manuell", value: "manual" },
        { label: "Tidsplan", value: "cron" },
        { label: "Regenerering", value: "regenerate" },
      ],
    },
    { name: "weekKey", type: "text", index: true },
    { name: "slot", type: "text" },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "running",
      index: true,
      options: [
        { label: "Kjører", value: "running" },
        { label: "Fullført", value: "completed" },
        { label: "Feilet", value: "failed" },
        { label: "Krever kontroll", value: "attention" },
      ],
    },
    { name: "startedAt", type: "date", required: true, index: true },
    { name: "finishedAt", type: "date" },
    { name: "selectedTopics", type: "relationship", relationTo: "seo-topics", hasMany: true },
    { name: "rejectedTopics", type: "relationship", relationTo: "seo-topics", hasMany: true },
    { name: "modelVersion", type: "text" },
    { name: "promptVersion", type: "text" },
    { name: "knowledgeVersion", type: "text" },
    { name: "qualityResult", type: "json" },
    { name: "errorCode", type: "text" },
    {
      name: "errorMessage",
      type: "textarea",
      maxLength: 500,
      admin: { description: "Sanitert feiltekst uten prompts, nøkler eller kundedata." },
    },
    { name: "createdPost", type: "relationship", relationTo: "posts" },
  ],
};
