const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type RequestOriginDecision = {
  allowed: boolean;
  reason: "safe-method" | "server-to-server" | "same-origin" | "cross-site" | "origin-mismatch";
};

function normalizeOrigin(value: string | null | undefined) {
  if (!value || value === "null") return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF boundary for browser-facing custom APIs.
 *
 * Browsers send Origin and/or Sec-Fetch-Site for mutations. Requests without
 * either header are retained for trusted server-to-server clients and tests;
 * webhook and cron endpoints are deliberately kept outside this boundary.
 */
export function evaluateMutationOrigin(request: Pick<Request, "headers" | "method" | "url">): RequestOriginDecision {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
    return { allowed: true, reason: "safe-method" };
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return { allowed: false, reason: "cross-site" };
  }

  const suppliedOrigin = request.headers.get("origin");
  if (!suppliedOrigin) {
    return { allowed: true, reason: "server-to-server" };
  }

  const origin = normalizeOrigin(suppliedOrigin);
  const requestOrigin = normalizeOrigin(request.url);
  if (origin && requestOrigin && origin === requestOrigin && fetchSite !== "cross-site") {
    return { allowed: true, reason: "same-origin" };
  }

  return { allowed: false, reason: "origin-mismatch" };
}

export function isBrowserMutationApi(pathname: string) {
  return [
    "/api/admin",
    "/api/customer",
    "/api/lead",
    "/api/user",
    "/api/worker",
    "/api/preview",
    "/api/exit-preview",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
