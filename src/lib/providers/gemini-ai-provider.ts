import type {
  AiGenerateRequest,
  AiGenerateResult,
  AiProvider,
  ProviderHealth,
} from "./contracts";
import { ProviderUnavailableError } from "./contracts";
import { generatedArticleJsonSchema } from "@/lib/blog/article-schema";

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; status?: string };
};

export class GeminiAiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    environment: Readonly<Record<string, string | undefined>> = process.env,
    private readonly request: typeof fetch = fetch,
  ) {
    this.apiKey = environment.GEMINI_API_KEY?.trim() || "";
    this.model = environment.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  }

  health(): ProviderHealth {
    return this.apiKey
      ? { status: "ready", provider: "gemini" }
      : {
          status: "configuration_required",
          provider: "gemini",
          detail: "GEMINI_API_KEY is missing",
        };
  }

  async generate(input: AiGenerateRequest): Promise<AiGenerateResult> {
    if (!this.apiKey) {
      throw new ProviderUnavailableError("gemini", "configuration_required");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const attachments = input.attachments ?? [];
      if (attachments.length > 3 || attachments.some((item) => item.dataBase64.length > 14_000_000)) {
        throw new TypeError("AI image attachment limit exceeded");
      }
      const response = await this.request(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
            "x-client-correlation-id": input.correlationId,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.system }] },
            contents: [{ role: "user", parts: [
              { text: input.prompt },
              ...attachments.map((attachment) => ({ inlineData: { mimeType: attachment.mimeType, data: attachment.dataBase64 } })),
            ] }],
            generationConfig: {
              temperature: 0.25,
              responseMimeType: "application/json",
              responseJsonSchema: input.schema || generatedArticleJsonSchema,
            },
          }),
        },
      );
      const result = (await response.json()) as GeminiResponse;
      if (!response.ok) {
        console.error("[gemini] Request failed", {
          httpStatus: response.status,
          providerStatus: result.error?.status || "unknown",
          providerMessage: (result.error?.message || "unknown").slice(0, 500),
        });
        throw new Error(`Gemini request failed (${response.status}): ${result.error?.status || "unknown"}`);
      }
      const text = result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();
      if (!text) throw new Error("Gemini returned no structured text");
      return {
        data: JSON.parse(text) as unknown,
        provider: "gemini",
        model: this.model,
        promptVersion: input.schemaName,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
