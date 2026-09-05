import { z } from "zod";

const recipientSchema = z.string().trim().toLowerCase().max(254).email();

function parseSingleRecipient(value: string, label: string) {
  const parsed = recipientSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`${label} must contain one valid email address`);
  }
  return parsed.data;
}

export function leadAdminRecipients(input: {
  primary: string;
  copy?: string | null;
}) {
  const recipients = [parseSingleRecipient(input.primary, "LEAD_TO_EMAIL")];
  const copy = input.copy?.trim();
  if (copy)
    recipients.push(parseSingleRecipient(copy, "LEAD_ADMIN_COPY_EMAIL"));
  return Array.from(new Set(recipients));
}
