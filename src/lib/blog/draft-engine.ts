import type { AiProvider } from "@/lib/providers/contracts";
import { generatedArticleSchema, type GeneratedArticle } from "./article-schema";
import { blogKnowledgeVersion } from "./knowledge-base";
import { buildBlogArticlePrompt, buildBlogSystemPrompt, blogPromptVersion } from "./prompt";
import {
  evaluateArticleQuality,
  type ArticleQualityResult,
} from "./quality-gates";
import type { ExistingTopic, TopicCandidate } from "./topic-engine";

export class ArticleQualityBlockedError extends Error {
  constructor(readonly quality: ArticleQualityResult) {
    super("Generated article did not pass deterministic quality gates");
    this.name = "ArticleQualityBlockedError";
  }
}

export type GeneratedDraftResult = {
  article: GeneratedArticle;
  quality: ArticleQualityResult;
  provider: string;
  model: string;
  promptVersion: string;
  knowledgeVersion: string;
};

export async function generateBlogDraft(input: {
  provider: AiProvider;
  topic: TopicCandidate;
  existing: ExistingTopic[];
  correlationId: string;
  now?: Date;
}): Promise<GeneratedDraftResult> {
  const generated = await input.provider.generate({
    task: "blog.article.draft",
    system: buildBlogSystemPrompt(),
    prompt: buildBlogArticlePrompt(
      input.topic,
      input.existing.map((item) => item.title),
    ),
    schemaName: blogPromptVersion,
    correlationId: input.correlationId,
  });
  const parsed = generatedArticleSchema.safeParse(generated.data);
  const quality = evaluateArticleQuality(
    parsed.success ? parsed.data : generated.data,
    input.topic,
    input.existing,
    input.now,
  );
  if (!parsed.success || !quality.passed) {
    throw new ArticleQualityBlockedError(quality);
  }
  return {
    article: parsed.data,
    quality,
    provider: generated.provider,
    model: generated.model,
    promptVersion: generated.promptVersion || blogPromptVersion,
    knowledgeVersion: blogKnowledgeVersion,
  };
}
