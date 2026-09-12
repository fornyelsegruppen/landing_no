import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  publish: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/security/cron-auth", () => ({
  cronRequestAuthorized: mocks.authorized,
}));
vi.mock("@/lib/payload", () => ({
  getPayload: async () => ({ create: mocks.create, update: mocks.update }),
}));
vi.mock("@/lib/blog/scheduled-publisher", () => ({
  publishDueBlogPosts: mocks.publish,
}));
import { GET } from "./route";
describe("approved scheduled publisher route", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://takfornyelsenorge.no");
    vi.stubEnv("FEATURE_SEO_AUTO_PUBLISH", "true");
    vi.stubEnv("FEATURE_SEO_SCHEDULER", "true");
    mocks.authorized.mockReset().mockReturnValue(true);
    mocks.publish
      .mockReset()
      .mockResolvedValue({ published: [8], attention: [], skipped: [] });
    mocks.create.mockReset().mockResolvedValue({ id: 1 });
    mocks.update.mockReset().mockResolvedValue({ id: 1 });
  });
  afterEach(() => vi.unstubAllEnvs());
  const request = () =>
    new Request("https://takfornyelsenorge.no/api/cron/publish-posts");
  it("rejects unauthorized before DB access", async () => {
    mocks.authorized.mockReturnValue(false);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("fails closed on kill switch", async () => {
    vi.stubEnv("FEATURE_SEO_AUTO_PUBLISH", "false");
    expect((await GET(request())).status).toBe(503);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("rejects frozen/old deployment target", async () => {
    expect(
      (await GET(new Request("https://old.vercel.app/api/cron/publish-posts")))
        .status,
    ).toBe(503);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("publishes reviewed due work without requiring an AI provider", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await GET(request())).status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "completed" }),
      }),
    );
  });
  it("persists attention outcomes", async () => {
    mocks.publish.mockResolvedValue({
      published: [],
      attention: [8],
      skipped: [],
    });
    expect((await GET(request())).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "attention",
          errorCode: "POST_RECHECK_REQUIRED",
        }),
      }),
    );
  });
});
