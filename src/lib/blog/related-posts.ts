import type { CmsPostDocument } from "@/lib/cms-pages";
import { availablePostLocales } from "@/lib/blog/editorial-policy";
import { isPubliclyPublishedPost } from "@/lib/blog/publication-visibility";
import type { Locale } from "@/lib/site";

export function publicRelatedPosts(
  relations: (number | string | CmsPostDocument)[] | null | undefined,
  locale: Locale,
): CmsPostDocument[] {
  return (relations || []).filter(
    (relation): relation is CmsPostDocument =>
      typeof relation === "object" &&
      relation !== null &&
      Boolean(relation.slug) &&
      isPubliclyPublishedPost(relation) &&
      availablePostLocales(relation).includes(locale),
  );
}
