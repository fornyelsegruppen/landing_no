export function enabled(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

export function seoExecutorRequestAllowed(
  request: Request,
  environment = process.env,
) {
  if (environment.VERCEL_ENV === "preview") {
    return Boolean(
      environment.SEO_PREVIEW_CANARY_ID?.match(/^[a-z0-9][a-z0-9-]{0,63}$/i),
    );
  }
  if (environment.VERCEL_ENV !== "production") return false;
  try {
    return (
      new URL(request.url).origin === "https://takfornyelsenorge.no" &&
      new URL(environment.NEXT_PUBLIC_SITE_URL || "").origin ===
        "https://takfornyelsenorge.no"
    );
  } catch {
    return false;
  }
}
