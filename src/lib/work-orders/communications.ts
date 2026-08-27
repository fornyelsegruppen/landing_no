import type { Payload } from "payload";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { sanitizeJobError } from "@/lib/jobs/job-policy";
import { deliverMessage, enqueueMessageJob } from "@/lib/messages/message-engine";
import { featureReadiness } from "@/lib/platform/features";
import { automaticCommunicationIsPaused } from "@/lib/platform/operating-mode";
import type { EmailProvider } from "@/lib/providers/contracts";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { buildBrandedEmailHtml } from "@/lib/messages/email-template";
import { siteConfig } from "@/lib/site";
import { relationId } from "./access";

export type WorkOrderCommunicationKind = "schedule_confirmation" | "reschedule_confirmation" | "reminder_48h" | "same_day" | "on_way" | "arrived" | "work_started" | "completion";

type CommunicationOrder = {
  id: number;
  status: string;
  scheduledAt?: string | null;
  arrivalWindow?: string | null;
  assignedWorker?: unknown;
  documentationSubmittedAt?: string | null;
};

const scheduleKinds: WorkOrderCommunicationKind[] = ["schedule_confirmation", "reschedule_confirmation", "reminder_48h", "same_day"];
const statusForKind: Partial<Record<WorkOrderCommunicationKind, string>> = {
  on_way: "on_way",
  arrived: "arrived",
  work_started: "in_progress",
};

export class CommunicationCancelledError extends Error {
  constructor(message: string) { super(message); this.name = "CommunicationCancelledError"; }
}

export class ChannelUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "ChannelUnavailableError"; }
}

type JobPayload = {
  workOrderId: number;
  kind: WorkOrderCommunicationKind;
  scheduleVersion: string;
  previousScheduledAt?: string | null;
  previousArrivalWindow?: string | null;
  planningReason?: string | null;
};

function parseJobPayload(value: unknown): JobPayload | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.workOrderId !== "number" || typeof data.scheduleVersion !== "string" || !["schedule_confirmation", "reschedule_confirmation", "reminder_48h", "same_day", "on_way", "arrived", "work_started", "completion"].includes(String(data.kind))) return null;
  return data as JobPayload;
}

export function workOrderScheduleVersion(order: CommunicationOrder) {
  return `${order.scheduledAt || "unscheduled"}|${relationId(order.assignedWorker) || "unassigned"}|${order.arrivalWindow || "no-window"}`;
}

function communicationIsCurrent(input: JobPayload, order: CommunicationOrder) {
  if (input.kind === "completion") {
    return order.status === "documented" && input.scheduleVersion === `documented:${order.documentationSubmittedAt}`;
  }
  if (input.scheduleVersion !== workOrderScheduleVersion(order) || !order.scheduledAt) return false;
  if (scheduleKinds.includes(input.kind)) return order.status === "scheduled";
  return statusForKind[input.kind] === order.status;
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

export async function syncWorkOrderCommunicationJobs(payload: Payload, order: CommunicationOrder, correlationId: string, now = new Date()) {
  if (automaticCommunicationIsPaused() || !featureReadiness("automatedReminders").ready) return { created: 0, cancelled: 0, skipped: true as const };
  const scheduleVersion = workOrderScheduleVersion(order);
  const pending = await pendingCommunicationJobs(payload, order.id);
  let cancelled = 0;
  for (const job of pending) {
    const data = parseJobPayload(job.payload);
    const obsolete = !data || !communicationIsCurrent(data, order);
    if (obsolete) {
      await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "cancelled", completedAt: now.toISOString(), lastErrorCode: "SCHEDULE_REPLACED", lastErrorMessage: "Planlagt kundemelding ble avbrutt fordi oppdraget ble endret." } });
      cancelled += 1;
    }
  }
  if (!order.scheduledAt || order.status !== "scheduled") return { created: 0, cancelled, skipped: false as const };
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

export async function enqueueWorkOrderStatusCommunication(
  payload: Payload,
  order: CommunicationOrder,
  kind: "on_way" | "arrived" | "work_started",
  correlationId: string,
  now = new Date(),
) {
  if (automaticCommunicationIsPaused() || !featureReadiness("automatedReminders").ready) return { skipped: true as const };
  if (!communicationIsCurrent({ workOrderId: order.id, kind, scheduleVersion: workOrderScheduleVersion(order) }, order)) {
    throw new CommunicationCancelledError("Work status no longer matches the customer notification");
  }
  return { skipped: false as const, job: await createJob(payload, { workOrderId: order.id, kind, scheduleVersion: workOrderScheduleVersion(order) }, now, correlationId) };
}

export async function enqueueCompletionCommunication(payload: Payload, order: { id: number; status: string; documentationSubmittedAt?: string | null }, correlationId: string, now = new Date()) {
  if (automaticCommunicationIsPaused() || !featureReadiness("automatedReminders").ready) return { skipped: true as const };
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
  return dispatchWorkOrderCommunicationNow(payload, order, "completion", correlationId, provider);
}

export async function dispatchWorkOrderCommunicationNow(
  payload: Payload,
  order: CommunicationOrder,
  kind: WorkOrderCommunicationKind,
  correlationId: string,
  provider: EmailProvider = createEmailProvider(),
) {
  if (automaticCommunicationIsPaused() || !featureReadiness("automatedReminders").ready) {
    return { skipped: true as const, delivered: false as const, queued: false as const };
  }
  const queued = kind === "completion"
    ? await enqueueCompletionCommunication(payload, order, correlationId)
    : statusForKind[kind]
      ? await enqueueWorkOrderStatusCommunication(payload, order, kind as "on_way" | "arrived" | "work_started", correlationId)
      : { skipped: false as const, job: await createJob(payload, { workOrderId: order.id, kind, scheduleVersion: workOrderScheduleVersion(order) }, new Date(), correlationId) };
  if (queued.skipped) return { skipped: true as const, delivered: false as const, queued: false as const };

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
      queued: false as const,
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

export async function dispatchWorkOrderRescheduleNow(
  payload: Payload,
  order: CommunicationOrder,
  previous: Pick<CommunicationOrder, "scheduledAt" | "arrivalWindow">,
  planningReason: string,
  correlationId: string,
  provider: EmailProvider = createEmailProvider(),
) {
  if (automaticCommunicationIsPaused()) {
    return { skipped: true as const, delivered: false as const, queued: false as const };
  }
  if (!planningReason.trim()) throw new TypeError("A rescheduling reason is required");
  if (!order.scheduledAt || order.status !== "scheduled") throw new CommunicationCancelledError("A new complete schedule is required");
  const input: JobPayload = {
    workOrderId: order.id,
    kind: "reschedule_confirmation",
    scheduleVersion: workOrderScheduleVersion(order),
    previousScheduledAt: previous.scheduledAt,
    previousArrivalWindow: previous.arrivalWindow,
    planningReason: planningReason.trim(),
  };
  const job = await createJob(payload, input, new Date(), correlationId);
  const attempts = (job.attempts || 0) + 1;
  await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "running", attempts, startedAt: new Date().toISOString() } });
  try {
    const communication = await processWorkOrderCommunicationJob(payload, input, correlationId);
    if (provider.health().status !== "ready") throw new Error("Email provider requires configuration");
    await deliverMessage(payload, provider, communication.message.id, correlationId);
    const deliveryJob = await enqueueMessageJob(payload, communication.message.id, correlationId);
    const completedAt = new Date().toISOString();
    await payload.update({ collection: "operational-jobs", id: deliveryJob.id, overrideAccess: true, data: { status: "completed", completedAt, result: { processed: true, immediate: true }, lastErrorCode: null, lastErrorMessage: null } });
    await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "completed", completedAt, result: { processed: true, immediate: true }, lastErrorCode: null, lastErrorMessage: null } });
    return { skipped: false as const, delivered: true as const, queued: false as const, message: communication.message, job };
  } catch (error) {
    const sanitized = sanitizeJobError(error);
    await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "retry", availableAt: new Date(Date.now() + 5 * 60_000).toISOString(), lastErrorCode: sanitized.code, lastErrorMessage: sanitized.message } });
    return { skipped: false as const, delivered: false as const, queued: true as const, job };
  }
}

export async function notifyAssignedWorkerNow(
  payload: Payload,
  order: CommunicationOrder,
  correlationId: string,
  provider: EmailProvider = createEmailProvider(),
) {
  if (automaticCommunicationIsPaused()) return { skipped: true as const };
  const workerId = relationId(order.assignedWorker);
  if (!workerId || !order.scheduledAt || !order.arrivalWindow) throw new TypeError("Complete assignment is required before notifying the employee");
  const worker = await payload.findByID({ collection: "users", id: workerId, depth: 0, overrideAccess: true });
  if (!worker.active || worker.role !== "worker" || !worker.email) throw new TypeError("The assigned employee account is not ready for notifications");
  const date = new Date(order.scheduledAt).toLocaleDateString("nb-NO", { dateStyle: "long", timeZone: "Europe/Oslo" });
  const text = `Hei ${worker.displayName || worker.email},\n\nDu er tildelt oppdrag ${order.id}.\nDato: ${date}\nAvtalt ankomst: kl. ${order.arrivalWindow}\n\nÅpne medarbeiderportalen for adresse, arbeidsomfang og dokumentasjon. Endringer vises alltid i portalen.\n\nTakfornyelse`;
  return provider.send({
    template: "worker-assignment",
    to: worker.email,
    subject: `Nytt eller oppdatert oppdrag ${order.id}`,
    text,
    html: buildBrandedEmailHtml({ subject: `Oppdrag ${order.id}`, text }),
    replyTo: siteConfig.email,
    idempotencyKey: makeIdempotencyKey("worker.assignment", { workOrderId: order.id, scheduleVersion: workOrderScheduleVersion(order) }),
    correlationId,
  });
}

function copyFor(kind: WorkOrderCommunicationKind, input: { leadName: string; scheduledAt?: string | null; arrivalWindow?: string | null; workerName?: string | null; workerPhone?: string | null; previousScheduledAt?: string | null; previousArrivalWindow?: string | null; planningReason?: string | null }) {
  const when = input.scheduledAt ? new Date(input.scheduledAt).toLocaleDateString("nb-NO", { dateStyle: "long", timeZone: "Europe/Oslo" }) : "avtalt dato";
  const window = input.arrivalWindow ? `kl. ${input.arrivalWindow}` : input.scheduledAt ? `kl. ${new Date(input.scheduledAt).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" })}` : "avtalt tid";
  const workerName = input.workerName || "vår medarbeider";
  const workerPhone = input.workerPhone || siteConfig.phone;
  const contact = `Ansvarlig medarbeider: ${workerName}\nTelefon: ${workerPhone}`;
  if (kind === "schedule_confirmation") return { category: "schedule_confirmation" as const, subject: "Medarbeider og tid er avtalt for takarbeidet", body: `Hei ${input.leadName},\n\nVi har nå tildelt en medarbeider til oppdraget ditt.\n\nDato: ${when}\nAvtalt ankomst: ${window}\n${contact}\n\nMedarbeideren varsler deg når han eller hun er på vei. Gi oss beskjed så snart som mulig dersom tidspunktet ikke passer.\n\nVennlig hilsen\nTakfornyelse\n${siteConfig.phone}` };
  if (kind === "reschedule_confirmation") {
    const previousDate = input.previousScheduledAt ? new Date(input.previousScheduledAt).toLocaleDateString("nb-NO", { dateStyle: "long", timeZone: "Europe/Oslo" }) : "tidligere avtalt dato";
    const previousWindow = input.previousArrivalWindow ? `kl. ${input.previousArrivalWindow}` : "tidligere avtalt tid";
    return { category: "schedule_confirmation" as const, subject: "Ny tid for takarbeidet", body: `Hei ${input.leadName},\n\nVi må dessverre oppdatere tidspunktet for oppdraget ditt.\n\nTidligere plan: ${previousDate}, ${previousWindow}\nNy plan: ${when}, ${window}\nÅrsak: ${input.planningReason || "Planen måtte oppdateres"}\n\n${contact}\n\nBeklager ulempen. Gi oss beskjed så snart som mulig dersom den nye tiden ikke passer.\n\nVennlig hilsen\nTakfornyelse\n${siteConfig.phone}` };
  }
  if (kind === "reminder_48h") return { category: "reminder" as const, subject: "Påminnelse om takarbeid om 48 timer", body: `Hei ${input.leadName},\n\nDette er en påminnelse om at vi kommer ${when}, med avtalt ankomst ${window}.\n\n${contact}\n\nSørg for at vi har nødvendig tilgang til eiendommen, og kontakt oss dersom noe har endret seg.\n\nVennlig hilsen\nTakfornyelse\n${siteConfig.phone}` };
  if (kind === "same_day") return { category: "reminder" as const, subject: "Vi kommer i dag", body: `Hei ${input.leadName},\n\nVi minner om at oppdraget er planlagt i dag med avtalt ankomst ${window}.\n\n${contact}\n\nDu får en ny beskjed når medarbeideren er på vei.\n\nVennlig hilsen\nTakfornyelse\n${siteConfig.phone}` };
  if (kind === "on_way") return { category: "reminder" as const, subject: "Medarbeideren er på vei", body: `Hei ${input.leadName},\n\n${workerName} er nå på vei til eiendommen din. Planlagt ankomst er ${window}.\n\n${contact}\n\nVennlig hilsen\nTakfornyelse\n${siteConfig.phone}` };
  if (kind === "arrived") return { category: "reminder" as const, subject: "Medarbeideren har ankommet", body: `Hei ${input.leadName},\n\n${workerName} har nå ankommet eiendommen og starter den avtalte kontrollen før arbeidet.\n\nVed behov kan du kontakte medarbeideren på ${workerPhone}.\n\nVennlig hilsen\nTakfornyelse\n${siteConfig.phone}` };
  if (kind === "work_started") return { category: "reminder" as const, subject: "Takarbeidet er startet", body: `Hei ${input.leadName},\n\n${workerName} har nå fullført kontrollen på stedet, og det avtalte takarbeidet er startet. Vi gir deg en ny oppdatering når arbeidet er ferdig og sluttkontrollert.\n\nVennlig hilsen\nTakfornyelse\n${siteConfig.phone}` };
  return { category: "completion" as const, subject: "Takarbeidet er fullført og dokumentert", body: `Hei ${input.leadName},\n\nArbeidet er fullført og sluttkontrollert. Arbeids- og ferdigbekreftelse, relevant kontraktsdokumentasjon og etterbilder følger vedlagt. Dokumentet er ikke et kommersielt garantibevis og begrenser ikke rettighetene dine etter håndverkertjenesteloven. Eventuell faktura sendes separat etter godkjent bokføring. Ta kontakt dersom du har spørsmål.\n\nTakk for oppdraget!\nTakfornyelse\n${siteConfig.phone}` };
}

export async function processWorkOrderCommunicationJob(payload: Payload, value: unknown, correlationId: string, clock = new Date()) {
  const input = parseJobPayload(value);
  if (!input) throw new TypeError("Communication job has no valid work-order reference");
  const order = await payload.findByID({ collection: "work-orders", id: input.workOrderId, depth: 0, overrideAccess: true });
  if (!communicationIsCurrent(input, order)) throw new CommunicationCancelledError("Work schedule or status changed before communication was sent");
  if (["reminder_48h", "same_day"].includes(input.kind) && order.scheduledAt && clock >= new Date(order.scheduledAt)) {
    throw new CommunicationCancelledError("A visit reminder cannot be sent after the visit has started");
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
  const workerId = relationId(order.assignedWorker);
  const worker = workerId ? await payload.findByID({ collection: "users", id: workerId, depth: 0, overrideAccess: true }) : null;
  const copy = copyFor(input.kind, { leadName: lead.name, scheduledAt: order.scheduledAt, arrivalWindow: order.arrivalWindow, workerName: worker?.displayName || worker?.email, workerPhone: worker?.phone, previousScheduledAt: input.previousScheduledAt, previousArrivalWindow: input.previousArrivalWindow, planningReason: input.planningReason });
  const attachments: number[] = [];
  if (input.kind === "completion") {
    const contractId = relationId(order.contract);
    if (contractId) {
      const contract = await payload.findByID({ collection: "contracts", id: contractId, depth: 0, overrideAccess: true });
      const signedDocumentId = relationId(contract.companySignedDocument) || relationId(contract.signedDocument);
      if (signedDocumentId) attachments.push(signedDocumentId);
    }
    for (const photo of (order.afterPhotos || []).slice(0, 4)) { const id = relationId(photo); if (id) attachments.push(id); }
    const completionDocuments = await payload.find({ collection: "private-media", depth: 0, limit: 1, overrideAccess: true, where: { and: [{ ownerType: { equals: "completion-certificate" } }, { ownerId: { equals: String(order.id) } }] } });
    const completionDocumentId = relationId(completionDocuments.docs[0]);
    if (completionDocumentId) attachments.push(completionDocumentId);
  }
  const nowIso = clock.toISOString();
  const message = await payload.create({ collection: "messages", overrideAccess: true, data: { lead: lead.id, direction: "outbound", category: copy.category, channel: "email", subject: copy.subject, bodyText: copy.body, bodyHtml: buildBrandedEmailHtml({ subject: copy.subject, text: copy.body }), attachments, status: "queued", idempotencyKey, aiAssisted: false, approvedAt: nowIso, queuedAt: nowIso, aiAnalysis: { workOrderId: order.id, communicationKind: input.kind, scheduleVersion: input.scheduleVersion } } });
  await enqueueMessageJob(payload, message.id, correlationId);
  return { duplicate: false as const, message };
}
