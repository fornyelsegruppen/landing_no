import type { Payload } from "payload";
import { evaluateCaseInvariants, type CaseInvariantIssue } from "./case-invariants";

type Raw = Record<string, unknown> & { id: number; status?: string };

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return undefined;
}

function latest(records: Raw[], statusesToSkip: string[] = []) {
  return records.filter((item) => !statusesToSkip.includes(item.status || "")).sort((a, b) => Number(b.id) - Number(a.id))[0];
}

export type CaseInvariantScanResult = { cases: number; created: number; issues: number; resolved: number; byCode: Record<string, number> };

async function persistLeadIssues(payload: Payload, leadId: number, issues: CaseInvariantIssue[], now: Date) {
  const existing = await payload.find({ collection: "operational-jobs", depth: 0, limit: 100, pagination: false, overrideAccess: true, where: { type: { equals: "case.invariant" } } });
  const leadJobs = (existing.docs as unknown as Raw[]).filter((job) => Number((job.payload as Record<string, unknown> | undefined)?.leadId) === leadId);
  const currentCodes = new Set(issues.map((item) => item.code));
  let created = 0;
  let resolved = 0;
  for (const invariant of issues) {
    const found = leadJobs.find((job) => (job.payload as Record<string, unknown> | undefined)?.code === invariant.code);
    const data = {
      status: "attention" as const, availableAt: now.toISOString(), completedAt: null,
      lastErrorCode: invariant.code, lastErrorMessage: invariant.action,
      payload: { leadId, code: invariant.code, entityType: invariant.entityType, entityId: invariant.entityId, owner: invariant.owner, blocksAutomation: invariant.blocksAutomation },
    };
    if (found) await payload.update({ collection: "operational-jobs", id: found.id, overrideAccess: true, data });
    else {
      await payload.create({ collection: "operational-jobs", overrideAccess: true, data: {
        type: "case.invariant", idempotencyKey: `case.invariant:${leadId}:${invariant.code}`, correlationId: `case-invariant:${leadId}`,
        attempts: 0, maxAttempts: 0, ...data,
      } });
      created += 1;
    }
  }
  for (const job of leadJobs) {
    const code = String((job.payload as Record<string, unknown> | undefined)?.code || "");
    if (!currentCodes.has(code) && job.status !== "completed") {
      await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "completed", completedAt: now.toISOString(), result: { resolved: true } } });
      resolved += 1;
    }
  }
  return { created, resolved };
}

export async function scanCaseInvariants(payload: Payload, options: { now?: Date; persist?: boolean } = {}): Promise<CaseInvariantScanResult> {
  const now = options.now || new Date();
  const [leads, quotes, contracts, workOrders, messages, jobs] = await Promise.all([
    payload.find({ collection: "leads", depth: 0, limit: 1000, pagination: false, overrideAccess: true, where: { recordState: { equals: "active" } } }),
    payload.find({ collection: "quotes", depth: 0, limit: 1000, pagination: false, overrideAccess: true }),
    payload.find({ collection: "contracts", depth: 0, limit: 1000, pagination: false, overrideAccess: true }),
    payload.find({ collection: "work-orders", depth: 0, limit: 1000, pagination: false, overrideAccess: true }),
    payload.find({ collection: "messages", depth: 0, limit: 2000, pagination: false, overrideAccess: true }),
    payload.find({ collection: "operational-jobs", depth: 0, limit: 2000, pagination: false, overrideAccess: true, where: { type: { equals: "message.delivery" } } }),
  ]);
  const allQuotes = quotes.docs as unknown as Raw[];
  const allContracts = contracts.docs as unknown as Raw[];
  const allMessages = messages.docs as unknown as Raw[];
  const allJobs = jobs.docs as unknown as Raw[];
  const byCode: Record<string, number> = {};
  let issueCount = 0;
  let created = 0;
  let resolved = 0;
  for (const lead of leads.docs as unknown as Raw[]) {
    const leadQuotes = allQuotes.filter((item) => relationId(item.lead) === lead.id);
    const quote = latest(leadQuotes, ["superseded"]);
    const leadContracts = allContracts.filter((item) => relationId(item.quote) && leadQuotes.some((candidate) => candidate.id === relationId(item.quote)));
    const contract = latest(leadContracts, ["superseded"]);
    const workOrder = latest((workOrders.docs as unknown as Raw[]).filter((item) => relationId(item.lead) === lead.id), ["cancelled"]);
    const leadMessages = allMessages.filter((item) => relationId(item.lead) === lead.id);
    const messageIds = new Set(leadMessages.map((item) => item.id));
    const deliveryJobs = allJobs.filter((item) => messageIds.has(Number((item.payload as Record<string, unknown> | undefined)?.messageId)));
    const issues = evaluateCaseInvariants({ lead, quote, contract, workOrder, messages: leadMessages, deliveryJobs });
    issueCount += issues.length;
    for (const invariant of issues) byCode[invariant.code] = (byCode[invariant.code] || 0) + 1;
    if (options.persist) {
      const persistence = await persistLeadIssues(payload, lead.id, issues, now);
      created += persistence.created;
      resolved += persistence.resolved;
    }
  }
  return { cases: leads.docs.length, created, issues: issueCount, resolved, byCode };
}
