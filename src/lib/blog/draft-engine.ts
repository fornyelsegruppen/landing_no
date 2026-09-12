import {
  ProviderUnavailableError,
  type AiProvider,
} from "@/lib/providers/contracts";
import {
  generatedArticleSchema,
  type GeneratedArticle,
} from "./article-schema";
import { blogKnowledgeVersion } from "./knowledge-base";
import {
  buildBlogArticlePrompt,
  buildBlogSystemPrompt,
  blogPromptVersion,
  type RegenerationFeedback,
} from "./prompt";
import {
  evaluateArticleQuality,
  type ArticleQualityResult,
} from "./quality-gates";
import type { ExistingTopic, TopicCandidate } from "./topic-engine";
import { normalizeGeneratedArticleDraft } from "./draft-normalizer";

export class ArticleQualityBlockedError extends Error {
  runId?: string | number;

  constructor(
    readonly quality: ArticleQualityResult,
    readonly provenance?: Pick<
      GeneratedDraftResult,
      "provider" | "model" | "promptVersion" | "knowledgeVersion"
    >,
  ) {
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
  regenerationFeedback?: RegenerationFeedback;
}): Promise<GeneratedDraftResult> {
  let generated: Awaited<ReturnType<AiProvider["generate"]>>;
  try {
    generated = await input.provider.generate({
      task: "blog.article.draft",
      system: buildBlogSystemPrompt(),
      prompt: buildBlogArticlePrompt(
        input.topic,
        input.existing.map((item) => item.title),
        input.regenerationFeedback,
      ),
      schemaName: blogPromptVersion,
      correlationId: input.correlationId,
    });
  } catch {
    throw new ProviderUnavailableError(input.provider.health().provider, "degraded");
  }
  const normalized = normalizeGeneratedArticleDraft(generated.data);
  const parsed = generatedArticleSchema.safeParse(normalized);
  const quality = evaluateArticleQuality(
    parsed.success ? parsed.data : normalized,
    input.topic,
    input.existing,
    input.now,
  );
  if (!parsed.success || !quality.passed) {
    throw new ArticleQualityBlockedError(quality, {
      provider: generated.provider,
      model: generated.model,
      promptVersion: generated.promptVersion || blogPromptVersion,
      knowledgeVersion: blogKnowledgeVersion,
    });
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
