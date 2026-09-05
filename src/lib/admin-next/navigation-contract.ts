export type AdminWorkspaceMode = "canonical" | "preview";

export const unifiedAdminPrimaryNavigation = [
  {
    key: "today",
    canonicalHref: "/admin-v2",
    previewHref:
      "/admin-next-preview/work?view=today&queue=all&limit=25",
    canonicalActivePrefixes: ["/admin-v2"],
    previewActivePrefixes: [
      "/admin-next-preview/work",
      "/admin-next-preview/today",
    ],
    activeMatch: "exact",
  },
  {
    key: "cases",
    canonicalHref: "/admin-v2/cases",
    previewHref: "/admin-v2/cases",
    canonicalActivePrefixes: ["/admin-v2/cases"],
    previewActivePrefixes: ["/admin-next-preview/cases", "/admin-v2/cases"],
    activeMatch: "prefix",
  },
  {
    key: "work",
    canonicalHref: "/admin-v2/work",
    previewHref: "/admin-v2/work",
    canonicalActivePrefixes: ["/admin-v2/work"],
    previewActivePrefixes: ["/admin-v2/work"],
    activeMatch: "prefix",
  },
  {
    key: "documents",
    canonicalHref: "/admin-v2/documents",
    previewHref: "/admin-v2/documents",
    canonicalActivePrefixes: ["/admin-v2/documents"],
    previewActivePrefixes: [
      "/admin-next-preview/documents",
      "/admin-v2/documents",
    ],
    activeMatch: "prefix",
  },
  {
    key: "seo",
    canonicalHref: "/admin-v2/blog",
    previewHref: "/admin-v2/blog",
    canonicalActivePrefixes: ["/admin-v2/blog"],
    previewActivePrefixes: ["/admin-next-preview/seo", "/admin-v2/blog"],
    activeMatch: "prefix",
  },
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
export type UnifiedAdminPrimaryNavigationItem =
  (typeof unifiedAdminPrimaryNavigation)[number];

export function adminNavigationHref(
  item: UnifiedAdminPrimaryNavigationItem,
  mode: AdminWorkspaceMode,
) {
  return mode === "preview" ? item.previewHref : item.canonicalHref;
}

export function adminNavigationActivePrefixes(
  item: UnifiedAdminPrimaryNavigationItem,
  mode: AdminWorkspaceMode,
) {
  return mode === "preview"
    ? item.previewActivePrefixes
    : item.canonicalActivePrefixes;
}

export function isAdminNavigationActive(
  pathname: string,
  item: UnifiedAdminPrimaryNavigationItem,
  mode: AdminWorkspaceMode,
) {
  return adminNavigationActivePrefixes(item, mode).some((prefix) =>
    item.activeMatch === "exact"
      ? pathname === prefix
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAdminUtilityNavigationActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}
