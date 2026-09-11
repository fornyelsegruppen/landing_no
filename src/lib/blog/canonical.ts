export const publicSeoOrigin = "https://takfornyelsenorge.no";

export function canonicalBlogUrl(locale: "no" | "en", slug: string) {
  return `${publicSeoOrigin}/${locale}/blogg/${slug}`;
}
