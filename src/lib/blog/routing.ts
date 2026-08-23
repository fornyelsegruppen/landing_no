import { availablePostLocales } from "./editorial-policy";

type BlogPostRouteData = {
  slug: string;
  titleNo?: string | null;
  titleEn?: string | null;
  contentNo?: string | null;
  contentEn?: string | null;
};

export function blogPostLanguageUrls(post: BlogPostRouteData, baseUrl: string) {
  const locales = availablePostLocales(post);
  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      `${baseUrl}/${locale}/blogg/${post.slug}`,
    ]),
  );
}
