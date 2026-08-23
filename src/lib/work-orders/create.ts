import type { Payload } from "payload";
import { quoteSnapshotSchema } from "@/lib/quotes/document";

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  throw new TypeError("Required relationship is missing");
}

export async function createWorkOrderFromContract(payload: Payload, input: {
  contractId: number;
  assignedWorkerId?: number;
  scheduledAt?: string;
}) {
  const contract = await payload.findByID({ collection: "contracts", id: input.contractId, depth: 0, overrideAccess: true });
  if (contract.status !== "signed") throw new Error("Only a signed contract can become a work order");
  const quoteId = relationId(contract.quote);
  const quote = await payload.findByID({ collection: "quotes", id: quoteId, depth: 0, overrideAccess: true });
  if (quote.status !== "accepted") throw new Error("The contract quote is not accepted");
  const existing = await payload.find({ collection: "work-orders", depth: 0, limit: 1, overrideAccess: true, where: { contract: { equals: contract.id } } });
  if (existing.docs[0]) return { workOrder: existing.docs[0], created: false };
  const snapshot = quoteSnapshotSchema.parse(quote.snapshot);
  const workSummary = [snapshot.serviceDescription, ...snapshot.measurement.assumptions].join("\n");
  const workOrder = await payload.create({ collection: "work-orders", overrideAccess: true, data: {
    reference: `A-${contract.reference}`,
    contract: contract.id,
    quote: quote.id,
    lead: relationId(quote.lead),
    contractDocumentHash: contract.documentHash,
    assignedWorker: input.assignedWorkerId,
    scheduledAt: input.scheduledAt,
    status: input.assignedWorkerId && input.scheduledAt ? "scheduled" : input.assignedWorkerId ? "assigned" : "unassigned",
    workSummary,
    eventTimeline: [{ action: "created", at: new Date().toISOString() }],
  } });
  return { workOrder, created: true };
}
