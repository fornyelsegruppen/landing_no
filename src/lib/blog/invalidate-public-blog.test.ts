import { expect, it, vi } from "vitest";
const invalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: invalidate }));
import { invalidatePublicBlog } from "./invalidate-public-blog";

it("invalidates localized article, list, home and sitemap paths", () => {
  invalidatePublicBlog();
  expect(invalidate.mock.calls).toEqual([
    ["/[locale]/blogg/[slug]", "page"],
    ["/[locale]/blogg", "page"],
    ["/[locale]", "page"],
    ["/sitemap.xml"],
  ]);
});
