import { beforeEach, describe, expect, it, vi } from "vitest";
import { validGeneratedArticle } from "./test-fixtures";

const mocks = vi.hoisted(() => ({
  attachStock: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  generate: vi.fn(),
  update: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/ai/payload-usage-limit", () => ({
  assertPayloadAiUsageAvailable: vi.fn(),
}));
vi.mock("./draft-engine", () => ({
  ArticleQualityBlockedError: class ArticleQualityBlockedError extends Error {},
  generateBlogDraft: mocks.generate,
}));
vi.mock("./stock-image", () => ({
  attachPexelsStockImageToPost: mocks.attachStock,
}));
vi.mock("@/lib/providers/pexels-stock-image-provider", () => ({
  PexelsStockImageProvider: class PexelsStockImageProvider {
    isConfigured() {
      return true;
    }
  },
}));

import { generateNextPayloadBlogDraft } from "./payload-blog-engine";

describe("payload blog draft generation", () => {
  beforeEach(() => {
    let topicFingerprintChecks = 0;
    mocks.find.mockReset().mockImplementation(async (input) => {
      if (input.collection === "seo-runs") return { docs: [] };
      if (input.collection === "posts") return { docs: [] };
      if (input.collection === "services") return { docs: [{ id: 3 }] };
      if (input.collection === "seo-topics") {
        if (input.where?.fingerprint) {
          topicFingerprintChecks += 1;
          return { docs: [] };
        }
        return {
          docs: [
            {
              id: 21,
              topic: "Hva koster takvask per m2?",
              primaryKeyword: "takvask pris",
              secondaryKeywords: [],
              searchIntent: "commercial",
              source: "manual",
              service: { key: "takvask" },
              topicScore: 90,
            },
          ],
        };
      }
      throw new Error(`Unexpected collection ${input.collection}`);
    });
    mocks.create.mockReset().mockImplementation(async (input) => {
      if (input.collection === "seo-runs") return { id: 7, ...input.data };
      if (input.collection === "posts") return { id: 55, ...input.data };
      if (input.collection === "seo-topics") return { id: topicFingerprintChecks, ...input.data };
      throw new Error(`Unexpected create ${input.collection}`);
    });
    mocks.update.mockReset().mockImplementation(async (input) => ({
      id: input.id,
      ...input.data,
    }));
    mocks.warn.mockReset();
    mocks.generate.mockReset().mockResolvedValue({
      article: validGeneratedArticle(),
      quality: { passed: true, score: 91, issues: [], checkedAt: "2026-09-12T00:00:00.000Z" },
      provider: "test",
      model: "test-model",
      promptVersion: "test-prompt",
      knowledgeVersion: "test-knowledge",
    });
    mocks.attachStock.mockReset().mockResolvedValue({
      outcome: "no_alternative",
      query: "Norwegian house roof tiles exterior",
      existingAssetId: "",
    });
  });

  it("retains the already-created initial draft when configured Pexels returns no image", async () => {
    const result = await generateNextPayloadBlogDraft({
      payload: {
        find: mocks.find,
        create: mocks.create,
        update: mocks.update,
        logger: { warn: mocks.warn },
      } as never,
      provider: {} as never,
      idempotencyKey: "seo-draft:2026-W37:monday",
      correlationId: "phase1-initial-stock-no-alternative",
      triggerSource: "manual",
    });

    expect(result).toMatchObject({ duplicate: false, post: { id: 55 } });
    expect(mocks.create).toHaveBeenCalledTimes(12);
    expect(mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining("retaining the valid draft"),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "seo-runs",
        id: 7,
        data: expect.objectContaining({ status: "completed", createdPost: 55 }),
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "seo-topics",
        id: 21,
        data: expect.objectContaining({ status: "drafted", relatedPost: 55 }),
      }),
    );
  });
});
