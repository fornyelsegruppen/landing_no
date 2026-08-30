import type { Payload } from "payload";
import { buildOperatingMode } from "@/lib/platform/operating-mode";

type Environment = Readonly<Record<string, string | undefined>>;

export const messageDeliveryClasses = [
  "automation",
  "admin_approved",
  "customer_initiated",
] as const;

export type MessageDeliveryClass = (typeof messageDeliveryClasses)[number];

type MessageWithAutomationContext = {
  aiAnalysis?: unknown;
  lead?: unknown;
};

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

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  return /^[^\s@]+@[^\s@]+$/.test(normalized) ? normalized : null;
}

export function automationRecipientAllowlist(
  environment: Environment = process.env,
) {
  return new Set(
    (environment.AUTOMATION_RECIPIENT_ALLOWLIST || "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter((value): value is string => Boolean(value)),
  );
}

export class AutomaticRecipientBlockedError extends Error {
  constructor(readonly reason: "allowlist_missing" | "recipient_not_allowed") {
    super(
      "Automatic delivery is blocked by the controlled-pilot recipient policy.",
    );
    this.name = "AutomaticRecipientBlockedError";
  }
}

export class MessageDeliveryClassRequiredError extends Error {
  constructor() {
    super("Message delivery has no recognized authorization class.");
    this.name = "MessageDeliveryClassRequiredError";
  }
}

export class MessageDeliveryClassConflictError extends Error {
  constructor() {
    super("Message delivery authorization conflicts with its durable job.");
    this.name = "MessageDeliveryClassConflictError";
  }
}

export function assertMessageDeliveryClass(
  value: unknown,
): asserts value is MessageDeliveryClass {
  if (!(messageDeliveryClasses as readonly unknown[]).includes(value)) {
    throw new MessageDeliveryClassRequiredError();
  }
}

export function messageDeliveryClass(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>).deliveryClass;
  return typeof candidate === "string" &&
    (messageDeliveryClasses as readonly string[]).includes(candidate)
    ? (candidate as MessageDeliveryClass)
    : null;
}

export function assertControlledPilotAutomationRecipientAllowed(
  recipient: string | null | undefined,
  environment: Environment = process.env,
) {
  if (buildOperatingMode(environment).mode !== "controlled_pilot") return;
  const allowlist = automationRecipientAllowlist(environment);
  if (allowlist.size === 0) {
    throw new AutomaticRecipientBlockedError("allowlist_missing");
  }
  const normalized = normalizeEmail(recipient);
  if (!normalized || !allowlist.has(normalized)) {
    throw new AutomaticRecipientBlockedError("recipient_not_allowed");
  }
}

export function messageRequiresAutomationRecipientPolicy(
  deliveryClass: MessageDeliveryClass,
) {
  return deliveryClass === "automation";
}

export async function assertAutomaticMessageRecipientAllowed(
  payload: Payload,
  message: MessageWithAutomationContext,
  deliveryClass: MessageDeliveryClass,
  environment: Environment = process.env,
) {
  if (!messageRequiresAutomationRecipientPolicy(deliveryClass)) return;
  const leadId = relationId(message.lead);
  if (!leadId) {
    throw new AutomaticRecipientBlockedError("recipient_not_allowed");
  }
  const lead = await payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
  });
  assertControlledPilotAutomationRecipientAllowed(
    lead.communicationEmail || lead.email,
    environment,
  );
}
