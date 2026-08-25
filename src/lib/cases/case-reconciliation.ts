import type { Payload } from "payload";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { executeCaseCommand, type CaseStatePatch } from "./case-command";

type RecordLike = { id: number; status?: string; [key: string]: unknown };

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return undefined;
}

function afterDays(now: Date, days: number) {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

export function deriveLegacyNextAction(input: {
  contract?: RecordLike;
  lead: RecordLike;
  now: Date;
  workOrder?: RecordLike;
}): CaseStatePatch | null {
  const { contract, lead, now, workOrder } = input;
  if ((lead.recordState || "active") !== "active" || lead.status === "closed") return null;
  const immediate = now.toISOString();
  if (lead.status === "waiting_customer") return { nextAction: "Vent på kundens svar og følg opp hvis fristen utløper.", nextActionAt: afterDays(now, 3), nextActionOwner: "customer" };
  if (lead.status === "quoted") return { nextAction: "Kunden vurderer tilbudet. Følg opp før tilbudet utløper.", nextActionAt: afterDays(now, 7), nextActionOwner: "customer" };
  if (lead.status === "converted") {
    if (workOrder && (contract?.status !== "signed" || !contract.companySignedAt)) return { nextAction: "Kontroller manglende kontraktssignatur før kundesaken kan fortsette.", nextActionAt: immediate, nextActionOwner: "administrator", nextActionBlocker: "WORK_WITHOUT_FULLY_SIGNED_CONTRACT" };
    if (workOrder?.status === "documented" && !workOrder.completionReviewedAt) return { nextAction: "Utfør administratorens sluttkontroll og kontroller dokumentene.", nextActionAt: immediate, nextActionOwner: "administrator", nextActionBlocker: "DOCUMENTED_WITHOUT_COMPLETION_REVIEW" };
    if (workOrder?.status === "documented") return { nextAction: "Kontroller dokumentene og arkiver den fullførte kundesaken.", nextActionAt: immediate, nextActionOwner: "administrator" };
    if (workOrder?.status === "completed") return { nextAction: "Sluttkontroller utført arbeid, pris og dokumentasjon.", nextActionAt: immediate, nextActionOwner: "administrator" };
    if (workOrder?.status === "scheduled") return { nextAction: "Følg opp planlagte påminnelser og oppdragets start.", nextActionAt: String(workOrder.scheduledAt || immediate), nextActionOwner: "system" };
    if (workOrder && ["on_way", "arrived", "precheck", "ready", "in_progress"].includes(workOrder.status || "")) return { nextAction: "Oppdraget håndteres i ansattportalen.", nextActionAt: immediate, nextActionOwner: "worker" };
    if (contract?.status === "signed" && contract.companySignedAt) return { nextAction: "Opprett arbeidsordre og tildel en ansatt.", nextActionAt: immediate, nextActionOwner: "administrator" };
    return { nextAction: "Kontroller kontrakt, signaturer og neste steg.", nextActionAt: immediate, nextActionOwner: "administrator" };
  }
  const labels: Record<string, string> = {
    draft_ready: "Kontroller AI-utkast, måling, pris og dokumenter.",
    measuring: "Kontroller og godkjenn takmålingen.",
    qualified: "Start eller kontroller takmålingen.",
    contacted: "Kontroller henvendelsen og velg neste steg.",
    new: "Kontroller den nye henvendelsen.",
  };
  return { nextAction: labels[lead.status || ""] || "Kontroller kundesaken og velg neste steg.", nextActionAt: immediate, nextActionOwner: "administrator" };
}

export type CaseReconciliationAction = {
  idempotencyKey: string;
  leadId: number;
  patch: CaseStatePatch;
  revision: number;
};

export async function previewSafeCaseReconciliation(payload: Payload, now = new Date()): Promise<CaseReconciliationAction[]> {
  const [leadsResult, contractsResult, workOrdersResult] = await Promise.all([
    payload.find({ collection: "leads", depth: 0, limit: 1000, pagination: false, overrideAccess: true, where: { recordState: { equals: "active" } } }),
    payload.find({ collection: "contracts", depth: 1, limit: 1000, pagination: false, overrideAccess: true }),
    payload.find({ collection: "work-orders", depth: 0, limit: 1000, pagination: false, overrideAccess: true }),
  ]);
  const contracts = contractsResult.docs as unknown as RecordLike[];
  const workOrders = workOrdersResult.docs as unknown as RecordLike[];
  const actions: CaseReconciliationAction[] = [];
  for (const lead of leadsResult.docs as unknown as RecordLike[]) {
    const workOrder = workOrders.filter((item) => relationId(item.lead) === lead.id && item.status !== "cancelled").sort((a, b) => b.id - a.id)[0];
    const contract = contracts.filter((item) => {
      const quote = item.quote;
      if (!quote || typeof quote !== "object") return false;
      return relationId((quote as Record<string, unknown>).lead) === lead.id;
    }).sort((a, b) => b.id - a.id)[0];
    const criticalState = Boolean(workOrder && (contract?.status !== "signed" || !contract.companySignedAt))
      || Boolean(workOrder?.status === "documented" && !workOrder.completionReviewedAt);
    if (lead.nextAction && lead.nextActionOwner && lead.nextActionAt && !criticalState) continue;
    const derived = deriveLegacyNextAction({ contract, lead, now, workOrder });
    if (!derived) continue;
    const patch: CaseStatePatch = derived;
    const revision = Number(lead.caseRevision || 1);
    actions.push({ leadId: lead.id, patch, revision, idempotencyKey: `f1-reconcile:${lead.id}:${revision}` });
  }
  return actions;
}

export function isStaleDeliveryJob(messageStatus: unknown, jobStatus: unknown) {
  return ["sent", "delivered"].includes(String(messageStatus || "")) && ["pending", "retry", "running"].includes(String(jobStatus || ""));
}

async function previewStaleDeliveryJobs(payload: Payload) {
  const [messagesResult, jobsResult] = await Promise.all([
    payload.find({ collection: "messages", depth: 0, limit: 2000, pagination: false, overrideAccess: true }),
    payload.find({ collection: "operational-jobs", depth: 0, limit: 2000, pagination: false, overrideAccess: true, where: { type: { equals: "message.delivery" } } }),
  ]);
  const messages = new Map((messagesResult.docs as unknown as RecordLike[]).map((message) => [message.id, message]));
  return (jobsResult.docs as unknown as RecordLike[]).filter((job) => {
    const messageId = Number((job.payload as Record<string, unknown> | undefined)?.messageId);
    return isStaleDeliveryJob(messages.get(messageId)?.status, job.status);
  });
}

export async function applySafeCaseReconciliation(payload: Payload, input: { actorId: number; now?: Date }) {
  const actions = await previewSafeCaseReconciliation(payload, input.now);
  const results = [];
  for (const action of actions) {
    results.push(await executeCaseCommand(payload, {
      actorId: input.actorId,
      command: "reconcile_legacy_next_action",
      expectedRevision: action.revision,
      idempotencyKey: action.idempotencyKey,
      leadId: action.leadId,
      now: input.now,
      patch: action.patch,
    }));
  }
  const staleJobs = await previewStaleDeliveryJobs(payload);
  const now = (input.now || new Date()).toISOString();
  for (const job of staleJobs) {
    const after = await payload.update({ collection: "operational-jobs", id: job.id, depth: 0, overrideAccess: true, data: { status: "cancelled", completedAt: now, result: { reconciled: true, reason: "message_already_finished" } } });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: input.actorId,
      action: "operational_job.cancel_stale_delivery",
      correlationId: `f1-reconcile-delivery:${job.id}`,
      entityType: "operational-job",
      entityId: job.id,
      before: job,
      after,
      changedFields: ["status", "completedAt", "result"],
      metadata: { reason: "message_already_finished" },
    });
  }
  return { leadActions: actions.length, staleDeliveryJobs: staleJobs.length, results };
}
