import { evaluateCaseInvariants } from "@/lib/cases/case-invariants";
import { getPayload } from "@/lib/payload";

const payload = await getPayload();
type Raw = Record<string, unknown> & { id: number; status?: string };
const relationId = (value: unknown) => typeof value === "number" ? value : value && typeof value === "object" && typeof (value as { id?: unknown }).id === "number" ? Number((value as { id: number }).id) : undefined;
const latest = (items: Raw[], skip: string[] = []) => items.filter((item) => !skip.includes(item.status || "")).sort((a, b) => b.id - a.id)[0];
const [leadsResult, quotesResult, contractsResult, workOrdersResult, messagesResult, jobsResult] = await Promise.all([
  payload.find({ collection: "leads", depth: 0, limit: 1000, pagination: false, overrideAccess: true, where: { recordState: { equals: "active" } } }),
  payload.find({ collection: "quotes", depth: 0, limit: 1000, pagination: false, overrideAccess: true }),
  payload.find({ collection: "contracts", depth: 0, limit: 1000, pagination: false, overrideAccess: true }),
  payload.find({ collection: "work-orders", depth: 0, limit: 1000, pagination: false, overrideAccess: true }),
  payload.find({ collection: "messages", depth: 0, limit: 2000, pagination: false, overrideAccess: true }),
  payload.find({ collection: "operational-jobs", depth: 0, limit: 2000, pagination: false, overrideAccess: true, where: { type: { equals: "message.delivery" } } }),
]);
const quotes = quotesResult.docs as unknown as Raw[];
const contracts = contractsResult.docs as unknown as Raw[];
const workOrders = workOrdersResult.docs as unknown as Raw[];
const messages = messagesResult.docs as unknown as Raw[];
const jobs = jobsResult.docs as unknown as Raw[];
const details = (leadsResult.docs as unknown as Raw[]).map((lead) => {
  const leadQuotes = quotes.filter((item) => relationId(item.lead) === lead.id);
  const quote = latest(leadQuotes, ["superseded"]);
  const contract = latest(contracts.filter((item) => leadQuotes.some((candidate) => candidate.id === relationId(item.quote))), ["superseded"]);
  const workOrder = latest(workOrders.filter((item) => relationId(item.lead) === lead.id), ["cancelled"]);
  const leadMessages = messages.filter((item) => relationId(item.lead) === lead.id);
  const messageIds = new Set(leadMessages.map((item) => item.id));
  const deliveryJobs = jobs.filter((item) => messageIds.has(Number((item.payload as Record<string, unknown> | undefined)?.messageId)));
  const issues = evaluateCaseInvariants({ lead, quote, contract, workOrder, messages: leadMessages, deliveryJobs });
  return { leadId: lead.id, status: lead.status, issueCodes: issues.map((item) => item.code), critical: issues.some((item) => item.severity === "critical") };
}).filter((item) => item.issueCodes.length > 0);
const byCode: Record<string, number> = {};
for (const detail of details) for (const code of detail.issueCodes) byCode[code] = (byCode[code] || 0) + 1;
const issueCount = details.reduce((total, item) => total + item.issueCodes.length, 0);
const result = { pass: issueCount === 0, cases: leadsResult.docs.length, issues: issueCount, criticalCases: details.filter((item) => item.critical).length, byCode, details };
console.log(JSON.stringify(result, null, 2));
process.exit(issueCount === 0 ? 0 : 2);
