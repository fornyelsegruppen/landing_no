import { expect, it, vi } from "vitest";
import { getImplicitTags } from "next/dist/server/lib/implicit-tags";
import { NEXT_CACHE_IMPLICIT_TAG_ID } from "next/dist/lib/constants";
const invalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: invalidate }));
import { invalidatePublicBlog } from "./invalidate-public-blog";

it("invalidates localized article, list, home and sitemap paths", () => {
  invalidatePublicBlog();
  expect(invalidate.mock.calls).toEqual([
    ["/(site)/[locale]/blogg/[slug]", "page"],
    ["/(site)/[locale]/blogg", "page"],
    ["/(site)/[locale]", "page"],
    ["/sitemap.xml"],
  ]);
});

it("matches installed Next implicit tags, including the real route group", async () => {
  invalidate.mockClear();
  invalidatePublicBlog();
  const renderedRoutes = [
    ["/(site)/[locale]/blogg/[slug]/page", "/no/blogg/test-article"],
    ["/(site)/[locale]/blogg/page", "/no/blogg"],
    ["/(site)/[locale]/page", "/no"],
    ["/sitemap.xml/route", "/sitemap.xml"],
  ];
  for (const [index, [page, pathname]] of renderedRoutes.entries()) {
    const implicit = await getImplicitTags(page, pathname, null);
    const [path, type] = invalidate.mock.calls[index];
    const invalidationTag = `${NEXT_CACHE_IMPLICIT_TAG_ID}${path}${type ? `/${type}` : ""}`;
    expect(implicit.tags).toContain(invalidationTag);
    if (type)
      expect(implicit.tags).not.toContain(
        invalidationTag.replace("/(site)", ""),
      );
  }
});
