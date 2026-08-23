import { describe, expect, it } from "vitest";
import { buildPlatformHealth } from "./health";

describe("platform health", () => {
  it("returns only safe configuration metadata", () => {
    const result = buildPlatformHealth({
      FEATURE_AI_DRAFTS: "true",
      GEMINI_API_KEY: "a-secret-key",
      RESEND_API_KEY: "another-secret",
    });

    expect(result.features.aiDrafts).toMatchObject({
      enabled: true,
      ready: true,
      unavailable: [],
    });
    expect(result.integrations.ai).toMatchObject({
      readiness: "ready",
      provider: "gemini",
      missing: [],
    });
    expect(JSON.stringify(result)).not.toContain("a-secret-key");
    expect(JSON.stringify(result)).not.toContain("another-secret");
  });
});
