import type { Locale } from "@/lib/site";

export function safePreviewPath(
  locale: Locale,
  requestedPath: string | null | undefined,
) {
  const fallback = `/${locale}`;
  if (!requestedPath) return fallback;
  if (
    !requestedPath.startsWith(`/${locale}/`) ||
    requestedPath.startsWith("//") ||
    requestedPath.includes("\\") ||
    /[\r\n\0]/.test(requestedPath)
  ) {
    return fallback;
  }
  return requestedPath;
}
