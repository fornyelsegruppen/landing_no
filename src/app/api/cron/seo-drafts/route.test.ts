import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  assertReady: vi.fn(),
  generate: vi.fn(),
  getPayload: vi.fn(),
  refresh: vi.fn(),
  listSignals: vi.fn(),
}));

vi.mock("@/lib/security/cron-auth", () => ({
  cronRequestAuthorized: mocks.authorized,
}));
vi.mock("@/lib/platform/features", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/platform/features")>();
  return { ...actual, assertFeatureReady: mocks.assertReady };
});
vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/lib/blog/payload-blog-engine", () => ({
  generateNextPayloadBlogDraft: mocks.generate,
  refreshPayloadSearchSignals: mocks.refresh,
}));
vi.mock("@/lib/providers/google-search-console-provider", () => ({
  GoogleSearchConsoleProvider: class {
    health() {
      return { status: "ready" };
    }
    listSignalRefresh = mocks.listSignals;
  },
}));
vi.mock("@/lib/providers/gemini-ai-provider", () => ({
  GeminiAiProvider: class GeminiAiProvider {},
}));

import { GET } from "./route";

describe("SEO draft cron", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("SEO_PREVIEW_CANARY_ID", "local-test");
    mocks.authorized.mockReset().mockReturnValue(true);
    mocks.assertReady.mockReset();
    mocks.getPayload.mockReset().mockResolvedValue({});
    mocks.refresh
      .mockReset()
      .mockResolvedValue({ created: 0, updated: 0, skipped: 0, received: 0 });
    mocks.listSignals
      .mockReset()
      .mockResolvedValue({
        current: {
          signals: [],
          status: "no-data",
          periodStart: "2026-08-13",
          periodEnd: "2026-09-09",
        },
        geography: "unknown",
      });
    mocks.generate
      .mockReset()
      .mockResolvedValue({ duplicate: false, run: { id: 5 }, post: { id: 7 } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("records the configured property on successful and failed source refreshes", async () => {
    const property = "sc-domain:takfornyelsenorge.no";
    vi.stubEnv("GOOGLE_SEARCH_CONSOLE_SITE_URL", property);
    const create = vi.fn().mockResolvedValue({ id: 91 });
    const update = vi.fn().mockResolvedValue({ id: 91 });
    mocks.getPayload.mockResolvedValue({ create, update });
    await GET(new Request("https://example.invalid/api/cron/seo-drafts"));
    const refresh = mocks.generate.mock.calls[0][0].refreshSignals;
    await refresh();
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qualityResult: expect.objectContaining({ property }),
        }),
      }),
    );
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "completed",
          qualityResult: expect.objectContaining({
            property,
            access: "verified",
            observationStatus: "no-data",
          }),
        }),
      }),
    );
    mocks.listSignals.mockRejectedValueOnce(new Error("synthetic denied"));
    await expect(refresh()).rejects.toThrow("synthetic denied");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          qualityResult: expect.objectContaining({
            property,
            access: "failed",
          }),
        }),
      }),
    );
  });

  it("rejects a request without the cron secret", async () => {
    mocks.authorized.mockReturnValue(false);

    const response = await GET(
      new Request("https://www.takfornyelse.as/api/cron/seo-drafts"),
    );

    expect(response.status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("delegates to the idempotent draft generator only when enabled", async () => {
    const response = await GET(
      new Request("https://www.takfornyelse.as/api/cron/seo-drafts"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      duplicate: false,
      runId: 5,
      postId: 7,
    });
    expect(mocks.assertReady).toHaveBeenCalledWith("seoScheduler");
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerSource: "cron",
        idempotencyKey: expect.any(String),
      }),
    );
  });
});
