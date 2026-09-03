export const publicSeoOrigin = "https://www.takfornyelse.as";

export function canonicalBlogUrl(locale: "no" | "en", slug: string) {
  return `${publicSeoOrigin}/${locale}/blogg/${slug}`;
}
