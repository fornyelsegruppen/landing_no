import type { Payload } from "payload";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { sanitizeJobError } from "@/lib/jobs/job-policy";
import { deliverMessage, enqueueMessageJob } from "@/lib/messages/message-engine";
import { featureReadiness } from "@/lib/platform/features";
import type { EmailProvider } from "@/lib/providers/contracts";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { relationId } from "./access";

export type WorkOrderCommunicationKind = "schedule_confirmation" | "reminder_48h" | "same_day" | "completion";

export class CommunicationCancelledError extends Error {
  constructor(message: string) { super(message); this.name = "CommunicationCancelledError"; }
}

export class ChannelUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "ChannelUnavailableError"; }
}

type JobPayload = { workOrderId: number; kind: WorkOrderCommunicationKind; scheduleVersion: string };

function parseJobPayload(value: unknown): JobPayload | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.workOrderId !== "number" || typeof data.scheduleVersion !== "string" || !["schedule_confirmation", "reminder_48h", "same_day", "completion"].includes(String(data.kind))) return null;
  return data as JobPayload;
}

async function pendingCommunicationJobs(payload: Payload, workOrderId: number) {
  const result = await payload.find({ collection: "operational-jobs", depth: 0, limit: 500, overrideAccess: true, where: { and: [{ type: { equals: "work-order.communication" } }, { status: { in: ["pending", "retry"] } }] } });
  return result.docs.filter((job) => parseJobPayload(job.payload)?.workOrderId === workOrderId);
}

async function createJob(payload: Payload, input: JobPayload, availableAt: Date, correlationId: string) {
  const idempotencyKey = makeIdempotencyKey("work-order.communication", input);
  const existing = await payload.find({ collection: "operational-jobs", depth: 0, limit: 1, overrideAccess: true, where: { idempotencyKey: { equals: idempotencyKey } } });
  if (existing.docs[0]) return existing.docs[0];
  return payload.create({ collection: "operational-jobs", overrideAccess: true, data: { type: "work-order.communication", status: "pending", idempotencyKey, correlationId, attempts: 0, maxAttempts: 3, availableAt: availableAt.toISOString(), payload: input } });
}

export async function syncWorkOrderCommunicationJobs(payload: Payload, order: { id: number; status: string; scheduledAt?: string | null }, correlationId: string, now = new Date()) {
  if (!featureReadiness("automatedReminders").ready) return { created: 0, cancelled: 0, skipped: true as const };
  const scheduleVersion = order.scheduledAt || "unscheduled";
  const pending = await pendingCommunicationJobs(payload, order.id);
  let cancelled = 0;
  for (const job of pending) {
    const data = parseJobPayload(job.payload);
    const obsolete = order.status === "cancelled" || order.status === "documented" || !order.scheduledAt || (data?.kind !== "completion" && data?.scheduleVersion !== scheduleVersion);
    if (obsolete) {
      await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "cancelled", completedAt: now.toISOString(), lastErrorCode: "SCHEDULE_REPLACED", lastErrorMessage: "Planlagt kundemelding ble avbrutt fordi oppdraget ble endret." } });
      cancelled += 1;
    }
  }
  if (!order.scheduledAt || order.status === "cancelled" || order.status === "documented") return { created: 0, cancelled, skipped: false as const };
  const scheduledAt = new Date(order.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new TypeError("Work order schedule is invalid");
  const plans: Array<[WorkOrderCommunicationKind, Date]> = [["schedule_confirmation", now]];
  const reminder48 = new Date(scheduledAt.getTime() - 48 * 60 * 60_000);
  if (reminder48 > now) plans.push(["reminder_48h", reminder48]);
  const sameDay = new Date(scheduledAt.getTime() - 2 * 60 * 60_000);
  if (process.env.WORK_ORDER_SAME_DAY_MESSAGE !== "false" && sameDay > now) plans.push(["same_day", sameDay]);
  for (const [kind, availableAt] of plans) await createJob(payload, { workOrderId: order.id, kind, scheduleVersion }, availableAt, correlationId);
  return { created: plans.length, cancelled, skipped: false as const };
}

export async function enqueueCompletionCommunication(payload: Payload, order: { id: number; status: string; documentationSubmittedAt?: string | null }, correlationId: string, now = new Date()) {
  if (!featureReadiness("automatedReminders").ready) return { skipped: true as const };
  if (order.status !== "documented" || !order.documentationSubmittedAt) throw new CommunicationCancelledError("Completion communication requires documented work");
  return { skipped: false as const, job: await createJob(payload, { workOrderId: order.id, kind: "completion", scheduleVersion: `documented:${order.documentationSubmittedAt}` }, now, correlationId) };
}

export async function dispatchCompletionCommunicationNow(
  payload: Payload,
  order: {
    id: number;
    status: string;
    documentationSubmittedAt?: string | null;
  },
  correlationId: string,
  provider: EmailProvider = createEmailProvider(),
) {
  const queued = await enqueueCompletionCommunication(
    payload,
    order,
    correlationId,
  );
  if (queued.skipped) return queued;

  const job = queued.job;
  const attempts = (job.attempts || 0) + 1;
  await payload.update({
    collection: "operational-jobs",
    id: job.id,
    overrideAccess: true,
    data: {
      status: "running",
      attempts,
      startedAt: new Date().toISOString(),
    },
  });

  try {
    const communication = await processWorkOrderCommunicationJob(
      payload,
      job.payload,
      correlationId,
    );
    if (provider.health().status !== "ready") {
      throw new Error("Email provider requires configuration");
    }
    await deliverMessage(
      payload,
      provider,
      communication.message.id,
      correlationId,
    );
    const deliveryJob = await enqueueMessageJob(
      payload,
      communication.message.id,
      correlationId,
    );
    const completedAt = new Date().toISOString();
    await payload.update({
      collection: "operational-jobs",
      id: deliveryJob.id,
      overrideAccess: true,
      data: {
        status: "completed",
        completedAt,
        result: { processed: true, immediate: true },
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    await payload.update({
      collection: "operational-jobs",
      id: job.id,
      overrideAccess: true,
      data: {
        status: "completed",
        completedAt,
        result: { processed: true, immediate: true },
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    return {
      skipped: false as const,
      delivered: true as const,
      message: communication.message,
      job,
    };
  } catch (error) {
    const sanitized = sanitizeJobError(error);
    await payload.update({
      collection: "operational-jobs",
      id: job.id,
      overrideAccess: true,
      data: {
        status: "retry",
        availableAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        lastErrorCode: sanitized.code,
        lastErrorMessage: sanitized.message,
      },
    });
    return {
      skipped: false as const,
      delivered: false as const,
      queued: true as const,
      job,
    };
  }
}

function copyFor(kind: WorkOrderCommunicationKind, leadName: string, scheduledAt?: string | null) {
  const when = scheduledAt ? new Date(scheduledAt).toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Oslo" }) : "avtalt tid";
  if (kind === "schedule_confirmation") return { category: "schedule_confirmation" as const, subject: "Bekreftelse på planlagt takarbeid", body: `Hei ${leadName},\n\nOppdraget ditt er planlagt til ${when}. Gi oss beskjed så snart som mulig dersom tidspunktet ikke passer.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88` };
  if (kind === "reminder_48h") return { category: "reminder" as const, subject: "Påminnelse om takarbeid om 48 timer", body: `Hei ${leadName},\n\nDette er en påminnelse om at vi kommer ${when}. Sørg for at vi har nødvendig tilgang til eiendommen, og kontakt oss dersom noe har endret seg.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88` };
  if (kind === "same_day") return { category: "reminder" as const, subject: "Vi kommer i dag", body: `Hei ${leadName},\n\nVi minner om at oppdraget er planlagt i dag, ${when}. Vår medarbeider oppdaterer status før ankomst.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88` };
  return { category: "completion" as const, subject: "Takarbeidet er dokumentert", body: `Hei ${leadName},\n\nArbeidet er fullført og dokumentert. Relevant kontraktsdokumentasjon og etterbilder følger vedlagt. Ta kontakt dersom du har spørsmål.\n\nTakk for oppdraget!\nTakfornyelse\n47 73 58 88` };
}

export async function processWorkOrderCommunicationJob(payload: Payload, value: unknown, correlationId: string) {
  const input = parseJobPayload(value);
  if (!input) throw new TypeError("Communication job has no valid work-order reference");
  const order = await payload.findByID({ collection: "work-orders", id: input.workOrderId, depth: 0, overrideAccess: true });
  if (input.kind === "completion") {
    if (order.status !== "documented" || input.scheduleVersion !== `documented:${order.documentationSubmittedAt}`) throw new CommunicationCancelledError("Completion state changed");
  } else if (!order.scheduledAt || order.status === "cancelled" || order.status === "documented" || input.scheduleVersion !== order.scheduledAt) {
    throw new CommunicationCancelledError("Schedule changed before communication was sent");
  }
  const leadId = relationId(order.lead);
  if (!leadId) throw new TypeError("Work order has no lead");
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  const channel = lead.preferredChannel || (lead.email ? "email" : "sms");
  if (channel !== "email") throw new ChannelUnavailableError("Kunden har valgt SMS, men SMS-levering er ikke konfigurert. Send meldingen manuelt.");
  if (!lead.email) throw new ChannelUnavailableError("Kunden mangler e-postadresse. Velg en tilgjengelig kanal før meldingen sendes.");
  const idempotencyKey = makeIdempotencyKey("work-order.message", input);
  const existing = await payload.find({ collection: "messages", depth: 0, limit: 1, overrideAccess: true, where: { idempotencyKey: { equals: idempotencyKey } } });
  if (existing.docs[0]) return { duplicate: true as const, message: existing.docs[0] };
  const copy = copyFor(input.kind, lead.name, order.scheduledAt);
  const attachments: number[] = [];
  if (input.kind === "completion") {
    const contractId = relationId(order.contract);
    if (contractId) {
      const contract = await payload.findByID({ collection: "contracts", id: contractId, depth: 0, overrideAccess: true });
      const signedDocumentId = relationId(contract.companySignedDocument) || relationId(contract.signedDocument);
      if (signedDocumentId) attachments.push(signedDocumentId);
    }
    for (const photo of (order.afterPhotos || []).slice(0, 4)) { const id = relationId(photo); if (id) attachments.push(id); }
  }
  const now = new Date().toISOString();
  const message = await payload.create({ collection: "messages", overrideAccess: true, data: { lead: lead.id, direction: "outbound", category: copy.category, channel: "email", subject: copy.subject, bodyText: copy.body, attachments, status: "queued", idempotencyKey, aiAssisted: false, approvedAt: now, queuedAt: now, aiAnalysis: { workOrderId: order.id, communicationKind: input.kind, scheduleVersion: input.scheduleVersion } } });
  await enqueueMessageJob(payload, message.id, correlationId);
  return { duplicate: false as const, message };
}
