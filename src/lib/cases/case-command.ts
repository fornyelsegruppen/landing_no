import { createHash } from "node:crypto";
import type { Payload } from "payload";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";

export class CaseCommandConflictError extends Error {
  constructor(readonly expected: number, readonly actual: number) {
    super(`Case revision conflict: expected ${expected}, actual ${actual}`);
    this.name = "CaseCommandConflictError";
  }
}

export type CaseStatePatch = {
  assignedTo?: number | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  nextActionBlocker?: string | null;
  nextActionOwner?: "administrator" | "customer" | "system" | "worker";
  recordState?: "active" | "archived" | "trashed";
  status?: "new" | "draft_ready" | "customer_waiting" | "waiting_customer" | "qualified" | "measuring" | "quoted" | "converted" | "closed" | "contacted";
  [key: string]: unknown;
};

export type ExecuteCaseCommandInput = {
  actorId?: number;
  command: string;
  expectedRevision?: number;
  idempotencyKey: string;
  leadId: number;
  now?: Date;
  patch: CaseStatePatch;
};

function commandIdentifier(input: ExecuteCaseCommandInput) {
  if (!/^[a-z0-9._-]{1,80}$/i.test(input.command)) throw new TypeError("Invalid case command name");
  if (input.idempotencyKey.length < 8 || input.idempotencyKey.length > 300) throw new TypeError("Invalid idempotency key");
  return `casecmd:${createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 40)}`;
}

export async function executeCaseCommand(payload: Payload, input: ExecuteCaseCommandInput) {
  const correlationId = commandIdentifier(input);
  const action = `case.${input.command}`;
  const previousAudit = await payload.find({
    collection: "audit-events", depth: 0, limit: 1, overrideAccess: true,
    where: { and: [
      { action: { equals: action } },
      { entityType: { equals: "lead" } },
      { entityId: { equals: String(input.leadId) } },
      { correlationId: { equals: correlationId } },
    ] },
  });
  if (previousAudit.docs[0]) {
    const lead = await payload.findByID({ collection: "leads", id: input.leadId, depth: 0, overrideAccess: true });
    return { duplicate: true as const, lead, revision: Number(lead.caseRevision || 1) };
  }

  const before = await payload.findByID({ collection: "leads", id: input.leadId, depth: 0, overrideAccess: true });
  const revision = Number(before.caseRevision || 1);
  if (input.expectedRevision !== undefined && input.expectedRevision !== revision) {
    throw new CaseCommandConflictError(input.expectedRevision, revision);
  }
  const nextRevision = revision + 1;
  const commandContext = {
    trustedCaseCommand: true,
    expectedCaseRevision: revision,
  } as const;
  let after;
  try {
    after = await payload.update({
      collection: "leads", id: input.leadId, depth: 0, overrideAccess: true,
      context: commandContext,
      data: { ...input.patch, caseRevision: nextRevision },
    });
  } catch (error) {
    const match = error instanceof Error && error.message.match(/^CASE_REVISION_CONFLICT:(\d+):(\d+)$/);
    if (match) throw new CaseCommandConflictError(Number(match[1]), Number(match[2]));
    throw error;
  }
  await recordAuditEvent(createPayloadAuditWriter(payload), {
    ...(input.actorId ? { actorId: input.actorId } : {}), action, entityType: "lead", entityId: input.leadId,
    correlationId, before, after, changedFields: [...Object.keys(input.patch), "caseRevision"],
    metadata: { revision: nextRevision },
  });
  return { duplicate: false as const, lead: after, revision: nextRevision };
}

export async function updateCaseState(payload: Payload, input: Omit<ExecuteCaseCommandInput, "idempotencyKey"> & { idempotencyKey?: string }) {
  if (process.env.FEATURE_CASE_STATE_ENGINE_V2 !== "true") {
    return payload.update({ collection: "leads", id: input.leadId, depth: 0, overrideAccess: true, data: input.patch });
  }
  return executeCaseCommand(payload, {
    ...input,
    idempotencyKey: input.idempotencyKey || `${input.command}:${input.leadId}:${input.now?.toISOString() || new Date().toISOString()}`,
  });
}
