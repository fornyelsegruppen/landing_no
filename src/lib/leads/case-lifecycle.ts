import type { Payload } from "payload";
import { updateCaseState } from "@/lib/cases/case-command";

export const archiveClassifications = [
  "completed",
  "declined",
  "lost",
  "invalid",
  "spam",
  "duplicate",
  "other",
] as const;

export type ArchiveClassification = (typeof archiveClassifications)[number];
export type CaseRecordState = "active" | "archived" | "trashed";

type LifecyclePayload = Pick<Payload, "delete" | "find" | "findByID" | "update">;

type LifecycleInput = {
  actorId: number;
  classification?: ArchiveClassification;
  now?: Date;
  reason: string;
  idempotencyKey?: string;
};

type RelationRecord = Record<string, unknown> & { id: number };

const openQuoteStatuses = new Set(["draft", "approved", "sent", "viewed"]);
const openContractStatuses = new Set(["draft", "issued"]);
const openChangeStatuses = new Set(["draft", "approved", "sent", "viewed"]);
const cancellableMessageStatuses = new Set(["draft", "approved", "queued", "failed", "attention"]);
const activeWorkStatuses = new Set(["unassigned", "assigned", "scheduled", "on_way", "arrived", "precheck", "ready", "in_progress", "blocked", "completed"]);

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return undefined;
}

function requiredReason(reason: string) {
  const normalized = reason.replace(/\s+/g, " ").trim();
  if (normalized.length < 5 || normalized.length > 500) throw new TypeError("A clear reason between 5 and 500 characters is required");
  return normalized;
}

async function related(payload: LifecyclePayload, leadId: number) {
  const common = { depth: 0, limit: 500, overrideAccess: true, pagination: false } as const;
  const [quotes, workOrders, invoices, warranties, messages] = await Promise.all([
    payload.find({ ...common, collection: "quotes", where: { lead: { equals: leadId } } }),
    payload.find({ ...common, collection: "work-orders", where: { lead: { equals: leadId } } }),
    payload.find({ ...common, collection: "invoice-records", where: { lead: { equals: leadId } } }),
    payload.find({ ...common, collection: "warranties", where: { lead: { equals: leadId } } }),
    payload.find({ ...common, collection: "messages", where: { lead: { equals: leadId } } }),
  ]);
  const quoteIds = quotes.docs.map((quote) => relationId(quote)).filter((id): id is number => Boolean(id));
  const contracts = quoteIds.length
    ? await payload.find({ ...common, collection: "contracts", where: { quote: { in: quoteIds } } })
    : { docs: [] };
  const contractIds = contracts.docs.map((contract) => relationId(contract)).filter((id): id is number => Boolean(id));
  const changes = contractIds.length
    ? await payload.find({ ...common, collection: "change-agreements", where: { contract: { in: contractIds } } })
    : { docs: [] };
  return {
    changes: changes.docs as unknown as RelationRecord[],
    contracts: contracts.docs as unknown as RelationRecord[],
    invoices: invoices.docs as unknown as RelationRecord[],
    messages: messages.docs as unknown as RelationRecord[],
    quotes: quotes.docs as unknown as RelationRecord[],
    warranties: warranties.docs as unknown as RelationRecord[],
    workOrders: workOrders.docs as unknown as RelationRecord[],
  };
}

function assertCanLeaveActiveState(records: Awaited<ReturnType<typeof related>>) {
  const activeWork = records.workOrders.find((order) => activeWorkStatuses.has(String(order.status || "")));
  if (activeWork) throw new TypeError("An active or unfinished work order must be resolved before the case can be archived or moved to trash");
  const signed = records.contracts.some((contract) => contract.status === "signed");
  const documentedOrCancelled = records.workOrders.some((order) => ["documented", "cancelled"].includes(String(order.status || "")));
  if (signed && !documentedOrCancelled) throw new TypeError("A signed contract must be completed or cancelled through the work workflow before archiving");
  if (records.quotes.some((quote) => quote.status === "accepted") && !documentedOrCancelled) {
    throw new TypeError("An accepted quote must be resolved through the contract and work workflow before archiving");
  }
}

async function cancelOpenActivity(payload: LifecyclePayload, records: Awaited<ReturnType<typeof related>>) {
  const now = new Date().toISOString();
  for (const message of records.messages) {
    if (cancellableMessageStatuses.has(String(message.status || ""))) {
      await payload.update({ collection: "messages", id: message.id, overrideAccess: true, data: { status: "cancelled", failureCode: null, failureMessage: null } });
    }
  }
  for (const change of records.changes) {
    if (openChangeStatuses.has(String(change.status || ""))) await payload.update({ collection: "change-agreements", id: change.id, overrideAccess: true, data: { status: "revoked" } });
  }
  for (const contract of records.contracts) {
    if (openContractStatuses.has(String(contract.status || ""))) await payload.update({ collection: "contracts", id: contract.id, overrideAccess: true, data: { status: "revoked" } });
  }
  for (const quote of records.quotes) {
    if (openQuoteStatuses.has(String(quote.status || ""))) {
      await payload.update({ collection: "quotes", id: quote.id, overrideAccess: true, data: { status: "revoked" } });
      await payload.update({ collection: "access-tokens", overrideAccess: true, where: { and: [{ subjectType: { equals: "quote" } }, { subjectId: { equals: String(quote.id) } }, { revokedAt: { exists: false } }] }, data: { revokedAt: now } });
    }
  }
}

export async function archiveCase(payload: LifecyclePayload, leadId: number, input: LifecycleInput) {
  if (!input.classification) throw new TypeError("Archive classification is required");
  const reason = requiredReason(input.reason);
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (lead.recordState === "trashed") throw new TypeError("Restore the case before archiving it");
  const records = await related(payload, leadId);
  assertCanLeaveActiveState(records);
  await cancelOpenActivity(payload, records);
  const now = (input.now || new Date()).toISOString();
  return updateCaseState(payload as Payload, { leadId, actorId: input.actorId, command: "archive", now: input.now, idempotencyKey: input.idempotencyKey, patch: {
      archiveClassification: input.classification,
      archiveReason: reason,
      archivedAt: now,
      archivedBy: input.actorId,
      closedAt: lead.closedAt || now,
      nextAction: null,
      nextActionAt: null,
      nextActionBlocker: null,
      nextActionOwner: "administrator",
      purgeAfter: null,
      recordState: "archived",
      status: "closed",
      trashedAt: null,
      trashedBy: null,
  } });
}

export async function trashCase(payload: LifecyclePayload, leadId: number, input: LifecycleInput) {
  const reason = requiredReason(input.reason);
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (lead.recordState === "trashed") throw new TypeError("The case is already in trash");
  const records = await related(payload, leadId);
  assertCanLeaveActiveState(records);
  await cancelOpenActivity(payload, records);
  const now = input.now || new Date();
  const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  return updateCaseState(payload as Payload, { leadId, actorId: input.actorId, command: "trash", now, idempotencyKey: input.idempotencyKey, patch: {
      archiveClassification: input.classification || lead.archiveClassification || "other",
      archiveReason: reason,
      archivedAt: lead.archivedAt || now.toISOString(),
      archivedBy: lead.archivedBy || input.actorId,
      closedAt: lead.closedAt || now.toISOString(),
      nextAction: null,
      nextActionAt: null,
      nextActionBlocker: null,
      nextActionOwner: "administrator",
      purgeAfter: purgeAfter.toISOString(),
      recordState: "trashed",
      status: "closed",
      trashedAt: now.toISOString(),
      trashedBy: input.actorId,
  } });
}

export async function restoreCase(payload: LifecyclePayload, leadId: number, input: Pick<LifecycleInput, "actorId" | "idempotencyKey" | "now" | "reason">) {
  requiredReason(input.reason);
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (!lead.recordState || lead.recordState === "active") throw new TypeError("The case is already active");
  return updateCaseState(payload as Payload, { leadId, actorId: input.actorId, command: "restore", now: input.now, idempotencyKey: input.idempotencyKey, patch: {
      archiveClassification: null,
      archiveReason: null,
      archivedAt: null,
      archivedBy: null,
      nextAction: "Review the restored case and choose the next step.",
      nextActionAt: (input.now || new Date()).toISOString(),
      nextActionBlocker: null,
      nextActionOwner: "administrator",
      purgeAfter: null,
      recordState: "active",
      trashedAt: null,
      trashedBy: null,
  } });
}

export async function assertCaseCanBePurged(payload: LifecyclePayload, leadId: number, now = new Date()) {
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (lead.recordState !== "trashed") throw new TypeError("Only a case in trash can be permanently deleted");
  if (!lead.purgeAfter || new Date(lead.purgeAfter).getTime() > now.getTime()) throw new TypeError("The trash retention period has not expired");
  const records = await related(payload, leadId);
  if (records.contracts.some((contract) => contract.status === "signed")) throw new TypeError("A case with a signed contract must be retained");
  if (records.quotes.some((quote) => quote.status === "accepted")) throw new TypeError("A case with an accepted quote must be retained");
  if (records.workOrders.length) throw new TypeError("A case with a work order must be retained");
  if (records.invoices.length) throw new TypeError("A case with an invoice record must be retained");
  if (records.warranties.length) throw new TypeError("A case with a warranty record must be retained");
  return lead;
}

export async function purgeCase(payload: LifecyclePayload, leadId: number, input: Pick<LifecycleInput, "now" | "reason"> & { confirmation: string }) {
  requiredReason(input.reason);
  if (input.confirmation.trim() !== String(leadId)) throw new TypeError("Enter the exact case number to confirm permanent deletion");
  await assertCaseCanBePurged(payload, leadId, input.now);
  await payload.delete({ collection: "leads", id: leadId, overrideAccess: true, context: { trustedLeadPurge: true } });
  return { deleted: true as const, id: leadId };
}
