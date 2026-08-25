import type { Payload } from "payload";
import { quoteSnapshotSchema } from "@/lib/quotes/document";

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  throw new TypeError("Required relationship is missing");
}

export async function assertAssignableWorker(payload: Payload, workerId: number) {
  const worker = await payload.findByID({ collection: "users", id: workerId, depth: 0, overrideAccess: true });
  if (worker.role !== "worker" || worker.active !== true) throw new Error("Choose an active employee account");
  if (!worker.displayName || worker.displayName.trim().length < 3) throw new Error("The employee must have a full display name before assignment");
  if (!worker.phone || worker.phone.replace(/\D/g, "").length < 8) throw new Error("The employee must have a valid phone number before customer-facing assignment");
  return worker;
}

export async function createWorkOrderFromContract(payload: Payload, input: {
  contractId: number;
  assignedWorkerId?: number;
  adminNote?: string;
  arrivalWindow?: string;
  scheduledAt?: string;
}) {
  if (input.assignedWorkerId) await assertAssignableWorker(payload, input.assignedWorkerId);
  const contract = await payload.findByID({ collection: "contracts", id: input.contractId, depth: 0, overrideAccess: true });
  if (contract.status !== "signed") throw new Error("Only a signed contract can become a work order");
  if (!contract.companySignedAt) throw new Error("The supplier must counter-sign the contract before a work order can be created");
  const quoteId = relationId(contract.quote);
  const quote = await payload.findByID({ collection: "quotes", id: quoteId, depth: 0, overrideAccess: true });
  if (quote.status !== "accepted") throw new Error("The contract quote is not accepted");
  const leadId = relationId(quote.lead);
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (lead.nextActionBlocker === "CUSTOMER_CANCELLATION_REQUEST") {
    throw new Error("The customer cancellation request must be resolved before a work order can be created");
  }
  const existing = await payload.find({ collection: "work-orders", depth: 0, limit: 1, overrideAccess: true, where: { contract: { equals: contract.id } } });
  if (existing.docs[0]) return { workOrder: existing.docs[0], created: false };
  const snapshot = quoteSnapshotSchema.parse(quote.snapshot);
  const workSummary = [snapshot.serviceDescription, ...snapshot.measurement.assumptions].join("\n");
  const workOrder = await payload.create({ collection: "work-orders", overrideAccess: true, data: {
    reference: `A-${contract.reference}`,
    contract: contract.id,
    quote: quote.id,
    lead: leadId,
    contractDocumentHash: contract.documentHash,
    assignedWorker: input.assignedWorkerId,
    adminNote: input.adminNote,
    arrivalWindow: input.arrivalWindow,
    scheduledAt: input.scheduledAt,
    status: input.assignedWorkerId && input.scheduledAt ? "scheduled" : input.assignedWorkerId ? "assigned" : "unassigned",
    workSummary,
    eventTimeline: [{ action: "created", at: new Date().toISOString() }],
  } });
  return { workOrder, created: true };
}
