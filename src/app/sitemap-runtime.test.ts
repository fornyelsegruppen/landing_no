import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cms = vi.hoisted(() => ({
  getPayload: vi.fn(),
  find: vi.fn(),
  findGlobal: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/payload", () => ({ getPayload: cms.getPayload }));
import sitemap, { dynamic } from "./sitemap";

const published = {
  id: 3,
  slug: "synthetic-published-article",
  titleNo: "Syntetisk publisert artikkel",
  contentNo: "Norsk testinnhold",
  _status: "published",
  editorialStatus: "published",
  createdAt: "2026-09-12T10:00:00.000Z",
  updatedAt: "2026-09-12T10:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PAYLOAD_BUILD_WITHOUT_DB", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  cms.getPayload.mockImplementation(async () => {
    if (process.env.PAYLOAD_BUILD_WITHOUT_DB === "1") {
      throw new Error(
        "CMS access disabled for database-independent build check",
      );
    }
    return { find: cms.find, findGlobal: cms.findGlobal };
  });
  cms.findGlobal.mockResolvedValue({ updatedAt: published.updatedAt });
  cms.find.mockImplementation(async ({ collection }) => ({
    docs: collection === "posts" ? [published] : [],
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("runtime sitemap metadata", () => {
  it("explicitly opts the special metadata handler out of prerender caching", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("first runtime call after build guard removal reads actual CMS entries", async () => {
    vi.stubEnv("PAYLOAD_BUILD_WITHOUT_DB", "1");
    // Model the old fallback; the real build artifact gate separately proves
    // Next no longer executes/caches this handler during the guarded build.
    expect(
      (await sitemap()).some(({ url }) => url.includes(published.slug)),
    ).toBe(false);
    expect(cms.find).not.toHaveBeenCalled();
    vi.stubEnv("PAYLOAD_BUILD_WITHOUT_DB", "");
    expect(
      (await sitemap()).some(({ url }) =>
        url.endsWith(`/no/blogg/${published.slug}`),
      ),
    ).toBe(true);
  });

  it("keeps published filters and bounded shallow reads rather than draft data", async () => {
    await sitemap();
    expect(cms.findGlobal).toHaveBeenCalledTimes(1);
    expect(cms.find).toHaveBeenCalledTimes(2);
    expect(cms.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "posts",
        depth: 0,
        draft: false,
        limit: 1000,
        pagination: false,
        overrideAccess: true,
        where: {
          and: [
            { _status: { equals: "published" } },
            { editorialStatus: { equals: "published" } },
          ],
        },
      }),
    );
    expect(cms.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "pages",
        depth: 0,
        draft: false,
        limit: 1000,
        pagination: false,
      }),
    );
  });

  it("does not keep an outage fallback after the next healthy request", async () => {
    cms.getPayload
      .mockRejectedValueOnce(new Error("settings offline"))
      .mockRejectedValueOnce(new Error("pages offline"))
      .mockRejectedValueOnce(new Error("posts offline"));
    const fallback = await sitemap();
    expect(fallback.some(({ url }) => url.includes(published.slug))).toBe(
      false,
    );
    expect(fallback.some(({ url }) => url.endsWith("/no/blogg"))).toBe(true);
    expect(
      (await sitemap()).some(({ url }) => url.includes(published.slug)),
    ).toBe(true);
  });

  it("never emits draft/unpublished article returned by an inconsistent source", async () => {
    cms.find.mockImplementation(async ({ collection }) => ({
      docs: collection === "posts" ? [{ ...published, _status: "draft" }] : [],
    }));
    expect(
      (await sitemap()).some(({ url }) => url.includes(published.slug)),
    ).toBe(false);
  });
});
