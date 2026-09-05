import { Resend } from "resend";
import {
  assertPreviewEmailRecipientsAllowed,
  previewEmailSubject,
} from "@/lib/messages/preview-email-recipient-policy";
import type { DeliveryResult, EmailMessage, EmailProvider, ProviderHealth } from "./contracts";
import { ProviderUnavailableError } from "./contracts";

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;

  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {
    this.apiKey = environment.RESEND_API_KEY?.trim() || "";
  }

  health(): ProviderHealth {
    return this.apiKey
      ? { status: "ready", provider: "resend" }
      : { status: "configuration_required", provider: "resend", detail: "RESEND_API_KEY is missing" };
  }

  async send(message: EmailMessage): Promise<DeliveryResult> {
    if (!this.apiKey) throw new ProviderUnavailableError("resend", "configuration_required");
    assertPreviewEmailRecipientsAllowed({ to: message.to }, this.environment);
    const response = await new Resend(this.apiKey).emails.send(
      {
        from: this.environment.LEAD_FROM_EMAIL || "Takfornyelse <post@takfornyelse.as>",
        to: message.to,
        subject: previewEmailSubject(message.subject, this.environment),
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        ...(message.attachments?.length ? { attachments: message.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.contentBase64,
          contentType: attachment.contentType,
        })) } : {}),
      },
      { idempotencyKey: message.idempotencyKey },
    );
    if (response.error || !response.data?.id) {
      throw new Error(`Resend delivery failed (${response.error?.name || "unknown"})`);
    }
    return {
      provider: "resend",
      providerMessageId: response.data.id,
      acceptedAt: new Date().toISOString(),
    };
  }
}
