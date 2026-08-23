import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return handleI18nRouting(request);
}

export const config = {
  // Exclude Payload admin, APIs, secure customer/worker surfaces, internals and static files.
  matcher: [
    "/((?!admin|user|api|payload|media|henvendelse|tilbud|endring|_next|_vercel|.*\\..*).*)",
  ],
};
