import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  assertReady: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/security/cron-auth", () => ({
  cronRequestAuthorized: mocks.authorized,
}));
vi.mock("@/lib/platform/features", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/platform/features")>();
  return { ...actual, assertFeatureReady: mocks.assertReady };
});
vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({ find: mocks.find, update: mocks.update })),
}));

import { GET } from "./route";

describe("scheduled post publishing cron", () => {
  beforeEach(() => {
    vi.stubEnv("FEATURE_SEO_AUTO_PUBLISH", "true");
    mocks.authorized.mockReset().mockReturnValue(true);
    mocks.assertReady.mockReset();
    mocks.find.mockReset().mockResolvedValue({
      docs: [
        {
          id: 8,
          editorialStatus: "scheduled",
          sources: [
            {
              label: "Arbeidstilsynet",
              url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
              publisher: "Arbeidstilsynet",
            },
          ],
          reviewerName: "Kari",
          reviewedAt: "2026-08-27T08:00:00.000Z",
        },
      ],
    });
    mocks.update.mockReset().mockResolvedValue({ id: 8, _status: "published" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests without cron authorization", async () => {
    mocks.authorized.mockReturnValue(false);

    const response = await GET(
      new Request("https://www.takfornyelse.as/api/cron/publish-posts"),
    );

    expect(response.status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("fails closed while automatic SEO publication is not explicitly enabled", async () => {
    delete process.env.FEATURE_SEO_AUTO_PUBLISH;

    const response = await GET(
      new Request("https://www.takfornyelse.as/api/cron/publish-posts"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "disabled",
      feature: "seoAutoPublish",
    });
    expect(mocks.assertReady).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("selects only administrator-reviewed scheduled drafts", async () => {
    const response = await GET(
      new Request("https://www.takfornyelse.as/api/cron/publish-posts"),
    );

    expect(response.status).toBe(200);
    expect(mocks.assertReady).toHaveBeenCalledWith("seoScheduler");
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "posts",
        draft: true,
        where: {
          and: expect.arrayContaining([
            { _status: { equals: "draft" } },
            { editorialStatus: { equals: "scheduled" } },
          ]),
        },
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "posts",
        id: 8,
        draft: false,
        data: { _status: "published" },
      }),
    );
  });

  it("keeps scheduled posts in attention when publishability checks fail", async () => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          id: 8,
          editorialStatus: "scheduled",
          sources: [
            {
              label: "SINTEF",
              url: "https://www.sintef.no/",
              publisher: "SINTEF",
            },
          ],
          reviewerName: "Kari",
          reviewedAt: "2026-08-27T08:00:00.000Z",
        },
      ],
    });

    const response = await GET(
      new Request("https://www.takfornyelse.as/api/cron/publish-posts"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      published: [],
      attention: [8],
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
