import type { EmailProvider } from "./contracts";
import { ResendEmailProvider } from "./resend-email-provider";
import { LogEmailProvider } from "./safe-providers";

function enabled(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

/**
 * Select the configured delivery provider without allowing the safe log
 * transport to leak into production. Preview logging is deliberately opt-in.
 */
export function createEmailProvider(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EmailProvider {
  if (
    !environment.RESEND_API_KEY?.trim()
    && environment.VERCEL_ENV === "preview"
    && enabled(environment.ALLOW_PREVIEW_EMAIL_LOG)
  ) {
    return new LogEmailProvider();
  }

  return new ResendEmailProvider(environment as NodeJS.ProcessEnv);
}
