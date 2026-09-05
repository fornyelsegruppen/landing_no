import { describe, expect, it } from "vitest";
import { adminNextReplyDraftingReadiness } from "./reply-drafting-readiness";

describe("adminNextReplyDraftingReadiness", () => {
  it("reports the disabled feature without exposing configuration values", () => {
    expect(
      adminNextReplyDraftingReadiness({
        FEATURE_AI_DRAFTS: "false",
        GEMINI_API_KEY: "must-not-cross-the-server-boundary",
      }),
    ).toEqual({
      ai: {
        blockers: ["FEATURE_AI_DRAFTS=false"],
        state: "feature_disabled",
      },
      manual: { state: "ready" },
    });
  });

  it("reports the missing provider configuration when the feature is enabled", () => {
    expect(
      adminNextReplyDraftingReadiness({ FEATURE_AI_DRAFTS: "true" }),
    ).toEqual({
      ai: {
        blockers: ["GEMINI_API_KEY"],
        state: "provider_configuration_required",
      },
      manual: { state: "ready" },
    });
  });

  it("reports ready only when both the flag and provider are configured", () => {
    expect(
      adminNextReplyDraftingReadiness({
        FEATURE_AI_DRAFTS: "true",
        GEMINI_API_KEY: "configured",
      }),
    ).toEqual({
      ai: { blockers: [], state: "ready" },
      manual: { state: "ready" },
    });
  });
});
