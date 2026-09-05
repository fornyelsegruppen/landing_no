type Environment = Readonly<Record<string, string | undefined>>;

type RecipientValue = unknown;

export const previewEmailSubjectPrefix = "[PREVIEW TEST]";

function normalizeEmail(value: string) {
  const trimmed = value.trim().toLowerCase();
  const displayNameMatch = trimmed.match(/<([^<>]+)>$/u);
  const address = (displayNameMatch?.[1] || trimmed).trim();
  return /^[^\s@]+@[^\s@]+$/u.test(address) ? address : null;
}

function recipientStrings(value: RecipientValue): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap(recipientStrings);
  if (value && typeof value === "object" && "address" in value) {
    return recipientStrings((value as { address?: unknown }).address);
  }
  return [];
}

function inspectRecipientValue(value: RecipientValue): {
  invalid: boolean;
  values: string[];
} {
  if (value === undefined || value === null || value === "") {
    return { invalid: false, values: [] };
  }
  if (typeof value === "string") {
    return { invalid: false, values: recipientStrings(value) };
  }
  if (Array.isArray(value)) {
    return value.reduce(
      (result, entry) => {
        const inspected = inspectRecipientValue(entry);
        return {
          invalid: result.invalid || inspected.invalid,
          values: [...result.values, ...inspected.values],
        };
      },
      { invalid: false, values: [] } as {
        invalid: boolean;
        values: string[];
      },
    );
  }
  if (value && typeof value === "object" && "address" in value) {
    const inspected = inspectRecipientValue(
      (value as { address?: unknown }).address,
    );
    return {
      invalid: inspected.invalid || inspected.values.length === 0,
      values: inspected.values,
    };
  }
  return { invalid: true, values: [] };
}

function recipients(value: RecipientValue) {
  return recipientStrings(value)
    .map((entry) => normalizeEmail(entry))
    .filter((entry): entry is string => Boolean(entry));
}

export function previewEmailRecipientAllowlist(
  environment: Environment = process.env,
) {
  return new Set(
    recipients(environment.PREVIEW_EMAIL_RECIPIENT_ALLOWLIST || ""),
  );
}

export class PreviewEmailRecipientBlockedError extends Error {
  constructor(
    readonly reason:
      | "allowlist_missing"
      | "recipient_invalid"
      | "recipient_not_allowed",
  ) {
    super("Preview email delivery is blocked by the exact-recipient policy.");
    this.name = "PreviewEmailRecipientBlockedError";
  }
}

/**
 * Every actual Preview email transport is restricted to an explicit list.
 * Production behavior is intentionally unchanged. Accept cc/bcc now so a
 * future provider cannot bypass this policy by adding another recipient field.
 */
export function assertPreviewEmailRecipientsAllowed(
  input: { to: RecipientValue; cc?: RecipientValue; bcc?: RecipientValue },
  environment: Environment = process.env,
) {
  if (environment.VERCEL_ENV !== "preview") return;
  const allowlist = previewEmailRecipientAllowlist(environment);
  if (allowlist.size === 0) {
    throw new PreviewEmailRecipientBlockedError("allowlist_missing");
  }
  const inspected = [input.to, input.cc, input.bcc].map(
    inspectRecipientValue,
  );
  const rawRecipients = inspected.flatMap((entry) => entry.values);
  const allRecipients = rawRecipients.map((recipient) =>
    normalizeEmail(recipient),
  );
  if (
    inspected.some((entry) => entry.invalid) ||
    allRecipients.length === 0 ||
    allRecipients.some((recipient) => recipient === null)
  ) {
    throw new PreviewEmailRecipientBlockedError("recipient_invalid");
  }
  if (
    (allRecipients as string[]).some(
      (recipient) => !allowlist.has(recipient),
    )
  ) {
    throw new PreviewEmailRecipientBlockedError("recipient_not_allowed");
  }
}

export function previewEmailSubject(
  subject: string,
  environment: Environment = process.env,
) {
  if (environment.VERCEL_ENV !== "preview") return subject;
  return subject.startsWith(previewEmailSubjectPrefix)
    ? subject
    : `${previewEmailSubjectPrefix} ${subject}`;
}
