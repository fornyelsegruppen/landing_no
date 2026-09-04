const identifierPattern = /^[a-zA-Z0-9._:-]{1,160}$/u;
const hashPattern = /^[a-f0-9]{64}$/u;
const emailPattern = /\b[^\s@]+@[^\s@]+\b/u;
const unsafeDisplayPattern = /[\u0000-\u001f\u007f]/u;

export const auditHistoryResultValues = [
  "succeeded",
  "partial",
  "failed",
  "compensated",
] as const;

export const auditHistoryReasonValues = [
  "message_already_finished",
  "stale_revision",
  "authorization_denied",
  "validation_failed",
  "provider_unavailable",
  "retry_exhausted",
] as const;

export const auditHistorySourceValues = [
  "admin",
  "admin-api",
  "worker",
  "worker-api",
  "customer",
  "customer-api",
  "system",
  "cron",
  "operational-job",
  "webhook",
  "payload",
  "canonical",
  "norge-i-bilder-screenshot",
  "search-console",
] as const;

const resultValues = new Set<string>(auditHistoryResultValues);
const reasonValues = new Set<string>(auditHistoryReasonValues);
const sourceValues = new Set<string>(auditHistorySourceValues);
const metadataKeys = new Set(["result", "reason", "version", "source"]);
const systemActions = new Set(["lead.retention_purge"]);

export type AuditHistoryResult = (typeof auditHistoryResultValues)[number];
export type AuditHistoryActorKind =
  "user" | "system" | "job" | "webhook" | "unknown";

export type AuditHistorySourceEvent = {
  id: unknown;
  actor?:
    | number
    | null
    | {
        id: unknown;
        displayName?: unknown;
      };
  action: unknown;
  entityType: unknown;
  entityId: unknown;
  correlationId: unknown;
  changedFields?: unknown;
  beforeHash?: unknown;
  afterHash?: unknown;
  metadata?: unknown;
  createdAt: unknown;
  updatedAt?: unknown;
};

export type AuditHistoryActor = {
  kind: AuditHistoryActorKind;
  id: string | null;
  display: string | null;
};

export type AuditHistoryHashStatus =
  "not_recorded" | "recorded_unverified" | "invalid";

export type AuditHistoryItem = {
  id: number;
  actor: AuditHistoryActor;
  action: string;
  entity: {
    type: string;
    id: string;
  };
  atUtc: string;
  changedFields: readonly string[];
  changedFieldsStatus: "absent" | "projected" | "rejected";
  result: AuditHistoryResult | null;
  reason: string | null;
  version: string | number | null;
  source: string | null;
  metadataStatus: "absent" | "projected" | "rejected";
  correlationId: string;
  integrity: {
    beforeHash: string | null;
    afterHash: string | null;
    hashStatus: AuditHistoryHashStatus;
    tamperStatus: "not_assessable";
  };
};

export type AuditHistoryEventProjection =
  | { ok: true; value: AuditHistoryItem }
  | {
      ok: false;
      reason: "invalid_id" | "invalid_identity" | "invalid_time";
    };

export type AuditHistoryTimeline = {
  order: "newest_first";
  items: readonly AuditHistoryItem[];
  rejectedCount: number;
};

function safeIdentifier(value: unknown): string | null {
  if (typeof value !== "string" || !identifierPattern.test(value)) return null;
  return value;
}

function safeEntityId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const result = String(value);
  return identifierPattern.test(result) ? result : null;
}

function safeActorId(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  return String(value);
}

function safeActorDisplay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  if (
    !result ||
    result.length > 120 ||
    emailPattern.test(result) ||
    unsafeDisplayPattern.test(result)
  ) {
    return null;
  }
  return result;
}

function machineActorKind(action: string, entityType: string) {
  if (
    entityType === "operational-job" ||
    action.startsWith("operational_job.")
  ) {
    return "job" as const;
  }
  if (entityType === "webhook" || action.startsWith("webhook.")) {
    return "webhook" as const;
  }
  if (
    entityType === "system" ||
    action.startsWith("system.") ||
    action.startsWith("cron.") ||
    systemActions.has(action)
  ) {
    return "system" as const;
  }
  return "unknown" as const;
}

function projectActor(
  actor: AuditHistorySourceEvent["actor"],
  action: string,
  entityType: string,
  entityId: string,
): AuditHistoryActor {
  if (typeof actor === "number") {
    const id = safeActorId(actor);
    return id
      ? { kind: "user", id, display: null }
      : { kind: "unknown", id: null, display: null };
  }
  if (actor && typeof actor === "object") {
    const id = safeActorId(actor.id);
    return id
      ? {
          kind: "user",
          id,
          display: safeActorDisplay(actor.displayName),
        }
      : { kind: "unknown", id: null, display: null };
  }

  const kind = machineActorKind(action, entityType);
  return {
    kind,
    id: kind === "job" && entityType === "operational-job" ? entityId : null,
    display: null,
  };
}

function projectChangedFields(value: unknown) {
  if (value === undefined || value === null) {
    return { value: [] as string[], status: "absent" as const };
  }
  if (
    !Array.isArray(value) ||
    value.some((field) => safeIdentifier(field) === null)
  ) {
    return { value: [] as string[], status: "rejected" as const };
  }
  return {
    value: [...new Set(value as string[])].sort((left, right) =>
      left.localeCompare(right),
    ),
    status: "projected" as const,
  };
}

function safeVersion(value: unknown) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  const identifier = safeIdentifier(value);
  return identifier && /\d/u.test(identifier) ? identifier : null;
}

function projectMetadata(value: unknown) {
  const empty = {
    result: null,
    reason: null,
    version: null,
    source: null,
  };
  if (value === undefined || value === null) {
    return { ...empty, status: "absent" as const };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ...empty, status: "rejected" as const };
  }

  const metadata = value as Record<string, unknown>;
  if (Object.keys(metadata).some((key) => !metadataKeys.has(key))) {
    return { ...empty, status: "rejected" as const };
  }
  const result = metadata.result;
  const reason = metadata.reason;
  const version = metadata.version;
  const source = metadata.source;
  if (
    (result !== undefined &&
      (typeof result !== "string" || !resultValues.has(result))) ||
    (reason !== undefined &&
      (typeof reason !== "string" || !reasonValues.has(reason))) ||
    (version !== undefined && safeVersion(version) === null) ||
    (source !== undefined &&
      (typeof source !== "string" || !sourceValues.has(source)))
  ) {
    return { ...empty, status: "rejected" as const };
  }

  return {
    result: (result as AuditHistoryResult | undefined) ?? null,
    reason: (reason as string | undefined) ?? null,
    version: version === undefined ? null : safeVersion(version),
    source: (source as string | undefined) ?? null,
    status: "projected" as const,
  };
}

function projectIntegrity(beforeValue: unknown, afterValue: unknown) {
  const beforeHash =
    beforeValue === undefined || beforeValue === null
      ? null
      : typeof beforeValue === "string" && hashPattern.test(beforeValue)
        ? beforeValue
        : undefined;
  const afterHash =
    afterValue === undefined || afterValue === null
      ? null
      : typeof afterValue === "string" && hashPattern.test(afterValue)
        ? afterValue
        : undefined;

  if (beforeHash === undefined || afterHash === undefined) {
    return {
      beforeHash: null,
      afterHash: null,
      hashStatus: "invalid" as const,
      tamperStatus: "not_assessable" as const,
    };
  }
  return {
    beforeHash,
    afterHash,
    hashStatus:
      beforeHash === null && afterHash === null
        ? ("not_recorded" as const)
        : ("recorded_unverified" as const),
    tamperStatus: "not_assessable" as const,
  };
}

export function projectAuditHistoryEvent(
  event: AuditHistorySourceEvent,
): AuditHistoryEventProjection {
  if (
    typeof event.id !== "number" ||
    !Number.isSafeInteger(event.id) ||
    event.id <= 0
  ) {
    return { ok: false, reason: "invalid_id" };
  }
  const action = safeIdentifier(event.action);
  const entityType = safeIdentifier(event.entityType);
  const entityId = safeEntityId(event.entityId);
  const correlationId = safeIdentifier(event.correlationId);
  if (!action || !entityType || !entityId || !correlationId) {
    return { ok: false, reason: "invalid_identity" };
  }

  if (typeof event.createdAt !== "string") {
    return { ok: false, reason: "invalid_time" };
  }
  const at = new Date(event.createdAt);
  if (Number.isNaN(at.getTime())) {
    return { ok: false, reason: "invalid_time" };
  }

  const changedFields = projectChangedFields(event.changedFields);
  const metadata = projectMetadata(event.metadata);
  return {
    ok: true,
    value: {
      id: event.id,
      actor: projectActor(event.actor, action, entityType, entityId),
      action,
      entity: { type: entityType, id: entityId },
      atUtc: at.toISOString(),
      changedFields: changedFields.value,
      changedFieldsStatus: changedFields.status,
      result: metadata.result,
      reason: metadata.reason,
      version: metadata.version,
      source: metadata.source,
      metadataStatus: metadata.status,
      correlationId,
      integrity: projectIntegrity(event.beforeHash, event.afterHash),
    },
  };
}

export function projectAuditHistory(
  events: readonly AuditHistorySourceEvent[],
): AuditHistoryTimeline {
  const projected = events.map(projectAuditHistoryEvent);
  const items = projected
    .filter(
      (item): item is Extract<AuditHistoryEventProjection, { ok: true }> =>
        item.ok,
    )
    .map((item) => item.value)
    .sort(
      (left, right) =>
        right.atUtc.localeCompare(left.atUtc) || right.id - left.id,
    );
  return {
    order: "newest_first",
    items,
    rejectedCount: projected.length - items.length,
  };
}
