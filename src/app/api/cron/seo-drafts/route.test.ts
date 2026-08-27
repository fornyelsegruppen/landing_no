import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  assertReady: vi.fn(),
  generate: vi.fn(),
  getPayload: vi.fn(),
}));

vi.mock("@/lib/security/cron-auth", () => ({ cronRequestAuthorized: mocks.authorized }));
vi.mock("@/lib/platform/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform/features")>();
  return { ...actual, assertFeatureReady: mocks.assertReady };
});
vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/lib/blog/payload-blog-engine", () => ({ generateNextPayloadBlogDraft: mocks.generate }));
vi.mock("@/lib/providers/gemini-ai-provider", () => ({ GeminiAiProvider: class GeminiAiProvider {} }));

import { GET } from "./route";

describe("SEO draft cron", () => {
  beforeEach(() => {
    mocks.authorized.mockReset().mockReturnValue(true);
    mocks.assertReady.mockReset();
    mocks.getPayload.mockReset().mockResolvedValue({});
    mocks.generate.mockReset().mockResolvedValue({ duplicate: false, run: { id: 5 }, post: { id: 7 } });
  });

  it("rejects a request without the cron secret", async () => {
    mocks.authorized.mockReturnValue(false);

    const response = await GET(new Request("https://www.takfornyelse.as/api/cron/seo-drafts"));

    expect(response.status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("delegates to the idempotent draft generator only when enabled", async () => {
    const response = await GET(new Request("https://www.takfornyelse.as/api/cron/seo-drafts"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, duplicate: false, runId: 5, postId: 7 });
    expect(mocks.assertReady).toHaveBeenCalledWith("seoScheduler");
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ triggerSource: "cron", idempotencyKey: expect.any(String) }));
  });
});
