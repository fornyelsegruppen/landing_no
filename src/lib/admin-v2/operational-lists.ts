import type { Payload, Where } from "payload";

export type OperationalListKind = "contracts" | "offers" | "work";
export type OperationalListItem = { customer: string; detail?: string; href: string; id: number; reference: string; status?: string; updatedAt?: string };

function record(value: unknown) { return value as Record<string, unknown>; }
function id(value: unknown) { return typeof value === "number" ? value : value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number" ? (value as { id: number }).id : 0; }
function text(value: unknown) { return typeof value === "string" ? value : undefined; }
function relation(value: unknown) { return value && typeof value === "object" ? record(value) : undefined; }

export async function loadOperationalList(payload: Pick<Payload, "find">, kind: OperationalListKind, state = "all"): Promise<OperationalListItem[]> {
  const common = { depth: 2, limit: 300, overrideAccess: true, pagination: false, sort: "-updatedAt" as const };
  let collection: "contracts" | "quotes" | "work-orders";
  let activeFilter: Where;
  if (kind === "offers") { collection = "quotes"; activeFilter = { and: [{ "lead.recordState": { equals: "active" } }, { status: { not_equals: "superseded" } }] }; }
  else if (kind === "contracts") { collection = "contracts"; activeFilter = { and: [{ "quote.lead.recordState": { equals: "active" } }, { status: { not_equals: "superseded" } }] }; }
  else { collection = "work-orders"; activeFilter = { "lead.recordState": { equals: "active" } }; }
  const statusFilter: Where | null = state === "all" ? null : kind === "work" && state === "active"
    ? { status: { in: ["scheduled", "on_way", "arrived", "precheck", "ready", "in_progress", "blocked"] } }
    : kind === "work" && state === "finished" ? { status: { in: ["completed", "documented", "cancelled"] } }
    : { status: { equals: state } };
  const result = await payload.find({ ...common, collection, where: statusFilter ? { and: [activeFilter, statusFilter] } : activeFilter });
  return result.docs.map((raw) => {
    const item = record(raw);
    const quote = relation(item.quote);
    const lead = relation(item.lead) || relation(quote?.lead);
    const leadId = id(lead);
    return {
      customer: text(lead?.name) || "—",
      detail: kind === "work" ? text(item.workSummary) : text(item.serviceDescription),
      href: leadId ? `/admin-v2/cases/${leadId}` : "/admin-v2/cases",
      id: id(item),
      reference: text(item.reference) || `#${id(item)}`,
      status: text(item.status),
      updatedAt: text(item.updatedAt),
    };
  });
}
