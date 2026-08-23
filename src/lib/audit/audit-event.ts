import { createHash } from "node:crypto";

const identifierPattern = /^[a-zA-Z0-9._:-]{1,160}$/;
const forbiddenMetadataKey =
  /address|authorization|cookie|email|name|password|phone|secret|signature|token/i;

export type SafeAuditMetadata = Record<
  string,
  string | number | boolean | null
>;

export type AuditEventInput = {
  actorId?: string | number;
  action: string;
  entityType: string;
  entityId: string | number;
  correlationId: string;
  changedFields?: string[];
  before?: unknown;
  after?: unknown;
  metadata?: SafeAuditMetadata;
};

export type AuditEventData = {
  actor?: string | number;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  changedFields?: string[];
  beforeHash?: string;
  afterHash?: string;
  metadata?: SafeAuditMetadata;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

function snapshotHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function assertIdentifier(label: string, value: string) {
  if (!identifierPattern.test(value)) {
    throw new TypeError(`${label} contains unsupported characters`);
  }
}

function validateMetadata(metadata: SafeAuditMetadata | undefined) {
  if (!metadata) return;
  for (const [key, value] of Object.entries(metadata)) {
    if (forbiddenMetadataKey.test(key)) {
      throw new TypeError(`Sensitive audit metadata key is forbidden: ${key}`);
    }
    if (typeof value === "string" && value.length > 200) {
      throw new TypeError(`Audit metadata value is too long: ${key}`);
    }
  }
}

export function prepareAuditEvent(input: AuditEventInput): AuditEventData {
  assertIdentifier("Action", input.action);
  assertIdentifier("Entity type", input.entityType);
  assertIdentifier("Correlation ID", input.correlationId);
  validateMetadata(input.metadata);

  const changedFields = input.changedFields
    ? [...new Set(input.changedFields)].sort()
    : undefined;
  changedFields?.forEach((field) => assertIdentifier("Changed field", field));

  return {
    ...(input.actorId !== undefined ? { actor: input.actorId } : {}),
    action: input.action,
    entityType: input.entityType,
    entityId: String(input.entityId),
    correlationId: input.correlationId,
    ...(changedFields?.length ? { changedFields } : {}),
    ...(input.before !== undefined
      ? { beforeHash: snapshotHash(input.before) }
      : {}),
    ...(input.after !== undefined ? { afterHash: snapshotHash(input.after) } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export type AuditEventWriter = (event: AuditEventData) => Promise<void>;

export async function recordAuditEvent(
  writer: AuditEventWriter,
  input: AuditEventInput,
) {
  await writer(prepareAuditEvent(input));
}
