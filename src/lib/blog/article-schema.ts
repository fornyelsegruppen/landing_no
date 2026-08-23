import { z } from "zod";

const sourceSchema = z.object({
  label: z.string().trim().min(2).max(160),
  url: z.string().url().max(1000),
  publisher: z.string().trim().min(2).max(120),
});

export const generatedArticleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  title: z.string().trim().min(20).max(90),
  excerpt: z.string().trim().min(60).max(320),
  content: z.string().trim().min(700).max(15_000),
  seoTitle: z.string().trim().min(20).max(70),
  seoDescription: z.string().trim().min(80).max(170),
  primaryKeyword: z.string().trim().min(2).max(100),
  secondaryKeywords: z.array(z.string().trim().min(2).max(100)).max(8),
  internalLinks: z
    .array(
      z.object({
        href: z.string().regex(/^\/[a-z0-9/-]+$/).max(300),
        anchor: z.string().trim().min(2).max(120),
        reason: z.string().trim().min(4).max(240),
      }),
    )
    .min(1)
    .max(6),
  faq: z
    .array(
      z.object({
        question: z.string().trim().min(10).max(180),
        answer: z.string().trim().min(30).max(700),
      }),
    )
    .min(2)
    .max(6),
  sources: z.array(sourceSchema).min(1).max(10),
  ctaVariant: z.enum(["assessment", "wash", "renewal", "new_roof"]),
  imageBrief: z.string().trim().min(20).max(500),
  imageAlt: z.string().trim().min(10).max(180),
  claimsForReview: z.array(z.string().trim().min(3).max(300)).max(12),
  usefulnessReason: z.string().trim().min(20).max(500),
});

export type GeneratedArticle = z.infer<typeof generatedArticleSchema>;

export const generatedArticleJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    slug: { type: "string" },
    title: { type: "string" },
    excerpt: { type: "string" },
    content: { type: "string" },
    seoTitle: { type: "string" },
    seoDescription: { type: "string" },
    primaryKeyword: { type: "string" },
    secondaryKeywords: { type: "array", items: { type: "string" } },
    internalLinks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          href: { type: "string" },
          anchor: { type: "string" },
          reason: { type: "string" },
        },
        required: ["href", "anchor", "reason"],
      },
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
        required: ["question", "answer"],
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          url: { type: "string" },
          publisher: { type: "string" },
        },
        required: ["label", "url", "publisher"],
      },
    },
    ctaVariant: {
      type: "string",
      enum: ["assessment", "wash", "renewal", "new_roof"],
    },
    imageBrief: { type: "string" },
    imageAlt: { type: "string" },
    claimsForReview: { type: "array", items: { type: "string" } },
    usefulnessReason: { type: "string" },
  },
  required: [
    "slug",
    "title",
    "excerpt",
    "content",
    "seoTitle",
    "seoDescription",
    "primaryKeyword",
    "secondaryKeywords",
    "internalLinks",
    "faq",
    "sources",
    "ctaVariant",
    "imageBrief",
    "imageAlt",
    "claimsForReview",
    "usefulnessReason",
  ],
} as const;
