import type { EmailAdapter } from "payload";
import {
  assertPreviewEmailRecipientsAllowed,
  previewEmailSubject,
} from "./preview-email-recipient-policy";

/** Wraps Payload-owned email paths (including auth email) in the same Preview
 * recipient and branding policy used by application messages. */
export function withPreviewEmailPolicy<T>(
  adapter: EmailAdapter<T>,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EmailAdapter<T> {
  return ({ payload }) => {
    const initialized = adapter({ payload });
    return {
      ...initialized,
      sendEmail: async (message) => {
        assertPreviewEmailRecipientsAllowed(
          { to: message.to, cc: message.cc, bcc: message.bcc },
          environment,
        );
        return initialized.sendEmail({
          ...message,
          subject: previewEmailSubject(message.subject || "", environment),
        });
      },
    };
  };
}
