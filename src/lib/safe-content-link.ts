import { siteConfig } from "@/lib/site";

const localePath = /^\/(?:no|en)(?=\/|[?#]|$)/;
const PUBLIC_SITE_HOSTS = new Set([
  "takfornyelsenorge.no",
  "www.takfornyelsenorge.no",
  "takfornyelse.as",
  "www.takfornyelse.as",
]);

function localizeInternalPath(href: string, locale: "no" | "en") {
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.includes("\\") ||
    /[\u0000-\u001F]/.test(href)
  ) {
    return null;
  }

  return localePath.test(href) ? href : `/${locale}${href}`;
}

export function safeContentHref(
  rawHref: string,
  locale: "no" | "en" = "no",
) {
  const href = rawHref.trim();
  if (!href || href.length > 2048) return null;
  if (href.startsWith("#")) return href;
  if (href.startsWith("/")) {
    return localizeInternalPath(href, locale);
  }

  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const siteOrigin = new URL(siteConfig.url).origin;
    if (url.origin === siteOrigin || PUBLIC_SITE_HOSTS.has(url.hostname)) {
      return localizeInternalPath(
        `${url.pathname}${url.search}${url.hash}`,
        locale,
      );
    }

    return href;
  } catch {
    return null;
  }
}
