import type { Payload } from "payload";
import { norwayDateKey } from "@/lib/norway-time";

type Environment = Readonly<Record<string, string | undefined>>;

type PaymentReminderInvoice = {
  bankCheckedAt?: string | null;
  dueAt?: string | null;
  status?: string | null;
};

type PaymentReminderMessage = {
  aiAnalysis?: unknown;
  approvedAt?: string | null;
  createdAt?: string | null;
  deliveredAt?: string | null;
  sentAt?: string | null;
};

type PaymentReminderDeliveryMessage = PaymentReminderMessage & {
  id: number;
  lead?: unknown;
};

export const defaultPaymentReminderCooldownDays = 7;

export function paymentReminderCooldownDays(
  environment: Environment = process.env,
) {
  const configured = Number(environment.PAYMENT_REMINDER_COOLDOWN_DAYS);
  return Number.isSafeInteger(configured) &&
    configured >= 1 &&
    configured <= 365
    ? configured
    : defaultPaymentReminderCooldownDays;
}

export function paymentReminderKey(invoiceId: number, now: Date) {
  return `${paymentReminderPrefix(invoiceId)}${norwayDateKey(now)}`;
}

export function paymentReminderPrefix(invoiceId: number) {
  return `official-invoice-reminder:${invoiceId}:`;
}

export function assertPaymentReminderInvoiceReady<
  T extends PaymentReminderInvoice,
>(
  invoice: T,
  now = new Date(),
): asserts invoice is T & {
  bankCheckedAt: string;
  dueAt: string;
  status: "sent" | "awaiting_payment" | "overdue";
} {
  if (!["sent", "awaiting_payment", "overdue"].includes(invoice.status || "")) {
    throw new TypeError("Only an unpaid sent invoice can receive a reminder");
  }
  const dueAt = invoice.dueAt ? new Date(invoice.dueAt) : null;
  if (
    !dueAt ||
    Number.isNaN(dueAt.getTime()) ||
    dueAt.getTime() >= now.getTime()
  ) {
    throw new TypeError("The invoice is not overdue");
  }
  if (
    !invoice.bankCheckedAt ||
    norwayDateKey(invoice.bankCheckedAt) !== norwayDateKey(now)
  ) {
    throw new TypeError(
      "Check the bank today before preparing or sending a reminder",
    );
  }
}

function reminderTimestamp(message: PaymentReminderMessage) {
  const analysis =
    message.aiAnalysis &&
    typeof message.aiAnalysis === "object" &&
    !Array.isArray(message.aiAnalysis)
      ? (message.aiAnalysis as Record<string, unknown>)
      : {};
  for (const value of [
    typeof analysis.paymentReminderSendClaimedAt === "string"
      ? analysis.paymentReminderSendClaimedAt
      : null,
    message.deliveredAt,
    message.sentAt,
    message.approvedAt,
    message.createdAt,
  ]) {
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

function relationId(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  ) {
    return (value as { id: number }).id;
  }
  return null;
}

function paymentAnalysis(message: PaymentReminderMessage) {
  return message.aiAnalysis &&
    typeof message.aiAnalysis === "object" &&
    !Array.isArray(message.aiAnalysis)
    ? (message.aiAnalysis as Record<string, unknown>)
    : {};
}

export function paymentReminderInvoiceId(message: PaymentReminderMessage) {
  const analysis = paymentAnalysis(message);
  if (analysis.financeAction !== "payment_reminder") return null;
  if (
    typeof analysis.officialInvoiceId !== "number" ||
    !Number.isSafeInteger(analysis.officialInvoiceId)
  ) {
    throw new TypeError("Payment reminder has no valid invoice reference");
  }
  return analysis.officialInvoiceId;
}

export async function assertAndClaimPaymentReminderSend(
  payload: Payload,
  message: PaymentReminderDeliveryMessage,
  expectedInvoiceId: number,
  now = new Date(),
) {
  const invoiceId = paymentReminderInvoiceId(message);
  if (invoiceId !== expectedInvoiceId) {
    throw new TypeError("Payment reminder invoice reference changed");
  }
  const invoice = await payload.findByID({
    collection: "official-invoices",
    id: invoiceId,
    depth: 0,
    overrideAccess: true,
  });
  if (relationId(invoice.lead) !== relationId(message.lead)) {
    throw new TypeError("Payment reminder does not match its customer case");
  }
  assertPaymentReminderInvoiceReady(invoice, now);
  const history = await payload.find({
    collection: "messages",
    depth: 0,
    limit: 20,
    overrideAccess: true,
    sort: "-createdAt",
    where: {
      and: [
        { idempotencyKey: { contains: paymentReminderPrefix(invoiceId) } },
        { id: { not_equals: message.id } },
      ],
    },
  });
  assertPaymentReminderCooldown(history.docs, now);
  const analysis = paymentAnalysis(message);
  return payload.update({
    collection: "messages",
    id: message.id,
    overrideAccess: true,
    data: {
      aiAnalysis: {
        ...analysis,
        paymentReminderSendClaimedAt: now.toISOString(),
      },
    },
  });
}

export function assertPaymentReminderCooldown(
  previous: PaymentReminderMessage[],
  now = new Date(),
  environment: Environment = process.env,
) {
  const latest = previous
    .map(reminderTimestamp)
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left)[0];
  if (latest === undefined) return;
  const days = paymentReminderCooldownDays(environment);
  if (now.getTime() - latest < days * 24 * 60 * 60_000) {
    throw new TypeError(`Wait at least ${days} days between payment reminders`);
  }
}
