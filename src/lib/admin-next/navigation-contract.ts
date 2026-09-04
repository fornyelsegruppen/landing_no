export type AdminWorkspaceMode = "canonical" | "preview";

export const unifiedAdminPrimaryNavigation = [
  { key: "today", canonicalHref: "/admin-v2", previewHref: "/admin-next-preview/today" },
  { key: "cases", canonicalHref: "/admin-v2/cases", previewHref: "/admin-v2/cases" },
  { key: "work", canonicalHref: "/admin-v2/work", previewHref: "/admin-v2/work" },
  { key: "documents", canonicalHref: "/admin-v2/documents", previewHref: "/admin-v2/documents" },
  { key: "seo", canonicalHref: "/admin-v2/blog", previewHref: "/admin-v2/blog" },
] as const;

export const unifiedAdminUtilityNavigation = [
  { key: "operations", href: "/admin-v2/settings?view=operations" },
  { key: "archive", href: "/admin-v2/archive" },
  { key: "team", href: "/admin-v2/employees" },
  { key: "settings", href: "/admin-v2/settings" },
] as const;

export type UnifiedAdminPrimaryNavigationKey =
  (typeof unifiedAdminPrimaryNavigation)[number]["key"];
export type UnifiedAdminUtilityNavigationKey =
  (typeof unifiedAdminUtilityNavigation)[number]["key"];

export function adminNavigationHref(
  item: (typeof unifiedAdminPrimaryNavigation)[number],
  mode: AdminWorkspaceMode,
) {
  return mode === "preview" ? item.previewHref : item.canonicalHref;
}

export function isAdminNavigationActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  if (path === "/admin-v2" || path === "/admin-next-preview/today") {
    return pathname === path;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}
