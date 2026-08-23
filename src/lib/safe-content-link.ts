export function safeContentHref(
  rawHref: string,
  locale: "no" | "en" = "no",
) {
  const href = rawHref.trim();
  if (!href || href.length > 2048) return null;
  if (href.startsWith("#")) return href;
  if (href.startsWith("/") && !href.startsWith("//")) {
    if (/^\/(no|en)(\/|$)/.test(href)) return href;
    return `/${locale}${href}`;
  }

  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? href : null;
  } catch {
    return null;
  }
}
