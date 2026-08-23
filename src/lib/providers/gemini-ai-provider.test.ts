import { describe, expect, it, vi } from "vitest";
import { GeminiAiProvider } from "./gemini-ai-provider";
import { validGeneratedArticle } from "@/lib/blog/test-fixtures";

describe("Gemini AI provider", () => {
  it("reports configuration required without exposing or using a missing key", () => {
    expect(new GeminiAiProvider({}).health()).toMatchObject({
      status: "configuration_required",
      provider: "gemini",
    });
  });

  it("requests structured JSON and keeps the API key out of URL and body", async () => {
    const request = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) => {
      void _url;
      void _options;
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validGeneratedArticle()) }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const provider = new GeminiAiProvider(
      { GEMINI_API_KEY: "secret-test-key", GEMINI_MODEL: "gemini-test" },
      request as typeof fetch,
    );
    await provider.generate({
      task: "blog.article.draft",
      system: "system",
      prompt: "prompt",
      schemaName: "schema-v1",
      correlationId: "gemini-test-123",
    });
    const [url, options] = request.mock.calls[0]!;
    expect(String(url)).not.toContain("secret-test-key");
    expect(String(options?.body)).not.toContain("secret-test-key");
    expect((options?.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-test-key");
    expect(String(options?.body)).toContain("responseFormat");
  });
});
