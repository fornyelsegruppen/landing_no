import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { evaluateMutationOrigin, isBrowserMutationApi } from "./lib/security/request-origin";

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (isBrowserMutationApi(request.nextUrl.pathname)) {
      const decision = evaluateMutationOrigin(request);
      if (!decision.allowed) {
        return NextResponse.json(
          { error: "Cross-site request blocked" },
          { status: 403, headers: { "Cache-Control": "no-store", Vary: "Origin" } },
        );
      }
    }
    return NextResponse.next();
  }

  return handleI18nRouting(request);
}

export const config = {
  // Exclude Payload admin, APIs, secure customer/worker surfaces, internals and static files.
  matcher: [
    "/api/:path*",
    "/((?!admin|user|api|payload|media|henvendelse|tilbud|endring|_next|_vercel|.*\\..*).*)",
  ],
};
