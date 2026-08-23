import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Exclude Payload admin, API, lead gallery, Next internals and static files
  matcher: [
    "/((?!admin|user|api|payload|media|henvendelse|tilbud|_next|_vercel|.*\\..*).*)",
  ],
};
