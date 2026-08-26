export type PublicNavigationItem = {
  href: string;
  label: string;
};

const guideLabels = {
  no: "Råd og guider",
  en: "Advice & guides",
} as const;

function normalizedInternalPath(href: string): string | null {
  try {
    const absolute = /^[a-z][a-z\d+.-]*:/i.test(href);
    const url = new URL(href, "https://www.takfornyelse.as");
    if (absolute && !/(^|\.)takfornyelse\.as$/i.test(url.hostname)) return null;

    const withoutLocale = url.pathname.replace(/^\/(?:no|en)(?=\/|$)/, "");
    return (withoutLocale.replace(/\/+$/, "") || "/").toLowerCase();
  } catch {
    return null;
  }
}

export function isGuideNavigationHref(href: string): boolean {
  return normalizedInternalPath(href) === "/blogg";
}

function isContactNavigationHref(href: string): boolean {
  try {
    const url = new URL(href, "https://www.takfornyelse.as");
    const path = normalizedInternalPath(href);
    return url.hash.toLowerCase() === "#kontakt" || path === "/kontakt";
  } catch {
    return false;
  }
}

export function withGuideNavigation(
  items: PublicNavigationItem[],
  locale: "no" | "en",
): PublicNavigationItem[] {
  const guide = { href: "/blogg", label: guideLabels[locale] };
  const result: PublicNavigationItem[] = [];
  let foundGuide = false;

  for (const item of items) {
    if (isGuideNavigationHref(item.href)) {
      if (!foundGuide) result.push(guide);
      foundGuide = true;
      continue;
    }
    result.push(item);
  }

  if (foundGuide) return result;

  const contactIndex = result.findIndex((item) =>
    isContactNavigationHref(item.href),
  );
  if (contactIndex === -1) return [...result, guide];

  return [
    ...result.slice(0, contactIndex),
    guide,
    ...result.slice(contactIndex),
  ];
}
