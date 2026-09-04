import type { Payload, Where } from "payload";
import {
  deriveCaseNextAction,
  type CaseNextActionKind,
} from "./case-read-model";

export const caseListStatusKeys = [
  "all",
  "open",
  "customer_waiting",
  "waiting_customer",
  "converted",
  "closed",
] as const;

export type CaseListStatus = (typeof caseListStatusKeys)[number];
export const caseListRecordStateKeys = [
  "active",
  "archived",
  "trashed",
  "all",
] as const;
export type CaseListRecordState = (typeof caseListRecordStateKeys)[number];

export type AdminCaseListFilters = {
  action?: CaseNextActionKind | "all";
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  recordState?: CaseListRecordState;
  status?: CaseListStatus;
  workerId?: number;
};

export type AdminCaseListItem = {
  archiveClassification?: string;
  assignedWorker?: string;
  assignedToId?: number;
  assignedWorkerId?: number;
  activeContractRequestId?: number;
  createdAt?: string;
  currentQuoteId?: number;
  customer: string;
  dueAt?: string;
  email?: string;
  href: string;
  id: number;
  inquiryType?: string;
  nextAction: CaseNextActionKind;
  nextActionBlockers: Array<{
    code: string;
    sourceId: number;
    sourceType:
      | "case"
      | "message"
      | "measurement"
      | "quote"
      | "contract_request"
      | "work_order";
  }>;
  nextActionTargetId?: number;
  overdue: boolean;
  phone?: string;
  postalAddress?: string;
  purgeAfter?: string;
  recordState: string;
  revision: number;
  status?: string;
  storedNextActionBlocker?: string;
  wakeAt?: string;
  workStatus?: string;
};

export type AdminCaseListResult = {
  items: AdminCaseListItem[];
  workers: Array<{ id: number; name: string }>;
};

function asRecord(value: unknown) {
  return value as Record<string, unknown>;
}

function numberId(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  ) {
    return (value as { id: number }).id;
  }
  return undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function relationName(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = asRecord(value);
  return text(record.displayName) || text(record.name) || text(record.email);
}

function messageClosesContract(value: Record<string, unknown> | undefined) {
  if (!value) return false;
  if (value.closesContract === true) return true;
  if (!value.aiAnalysis || typeof value.aiAnalysis !== "object") return false;
  const analysis = asRecord(value.aiAnalysis);
  return Boolean(
    numberId(analysis.customerContractRequestId) &&
    ["close", "do_not_contact"].includes(text(analysis.decision) || ""),
  );
}

function firstByRelation(docs: unknown[], field: string) {
  const result = new Map<number, Record<string, unknown>>();
  for (const raw of docs) {
    const doc = asRecord(raw);
    const relation = numberId(doc[field]);
    if (relation && !result.has(relation)) result.set(relation, doc);
  }
  return result;
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return undefined;
  return value;
}

export function normalizeCaseListFilters(
  input: AdminCaseListFilters,
): AdminCaseListFilters {
  const query =
    typeof input.query === "string"
      ? input.query.replace(/\s+/g, " ").trim().slice(0, 80)
      : undefined;
  const status =
    input.status &&
    (caseListStatusKeys as readonly string[]).includes(input.status)
      ? input.status
      : "all";
  const recordState =
    input.recordState &&
    (caseListRecordStateKeys as readonly string[]).includes(input.recordState)
      ? input.recordState
      : "active";
  return {
    action: input.action || "all",
    dateFrom: validDate(input.dateFrom),
    dateTo: validDate(input.dateTo),
    query: query || undefined,
    recordState,
    status,
    workerId:
      Number.isInteger(input.workerId) && Number(input.workerId) > 0
        ? Number(input.workerId)
        : undefined,
  };
}

function leadWhere(
  filters: AdminCaseListFilters,
  referenceLeadIds: number[],
): Where | undefined {
  const and: Where[] = [];
  if (filters.recordState && filters.recordState !== "all")
    and.push({ recordState: { equals: filters.recordState } });
  if (filters.status === "open") and.push({ status: { not_in: ["closed"] } });
  else if (filters.status && filters.status !== "all")
    and.push({ status: { equals: filters.status } });
  if (filters.dateFrom)
    and.push({
      createdAt: { greater_than_equal: `${filters.dateFrom}T00:00:00.000Z` },
    });
  if (filters.dateTo)
    and.push({
      createdAt: { less_than_equal: `${filters.dateTo}T23:59:59.999Z` },
    });
  if (filters.query) {
    const or: Where[] = [
      { name: { contains: filters.query } },
      { email: { contains: filters.query } },
      { phone: { contains: filters.query } },
      { address: { contains: filters.query } },
      { houseNumber: { contains: filters.query } },
      { postal: { contains: filters.query } },
      { city: { contains: filters.query } },
    ];
    if (/^\d+$/.test(filters.query))
      or.push({ id: { equals: Number(filters.query) } });
    if (referenceLeadIds.length) or.push({ id: { in: referenceLeadIds } });
    and.push({ or });
  }
  return and.length ? { and } : undefined;
}

async function leadIdsFromReferences(
  payload: Pick<Payload, "find">,
  query?: string,
) {
  if (!query || query.length < 2) return [];
  const common = {
    depth: 1,
    limit: 200,
    overrideAccess: true,
    pagination: false,
  } as const;
  const [quotes, contracts, workOrders] = await Promise.all([
    payload.find({
      ...common,
      collection: "quotes",
      where: { reference: { contains: query } },
    }),
    payload.find({
      ...common,
      collection: "contracts",
      where: { reference: { contains: query } },
    }),
    payload.find({
      ...common,
      collection: "work-orders",
      where: { reference: { contains: query } },
    }),
  ]);
  const ids = new Set<number>();
  for (const raw of quotes.docs) {
    const leadId = numberId(asRecord(raw).lead);
    if (leadId) ids.add(leadId);
  }
  for (const raw of contracts.docs) {
    const quote = asRecord(raw).quote;
    if (quote && typeof quote === "object") {
      const leadId = numberId(asRecord(quote).lead);
      if (leadId) ids.add(leadId);
    }
  }
  for (const raw of workOrders.docs) {
    const leadId = numberId(asRecord(raw).lead);
    if (leadId) ids.add(leadId);
  }
  return [...ids];
}

export async function loadAdminCaseList(
  payload: Pick<Payload, "find">,
  rawFilters: AdminCaseListFilters = {},
): Promise<AdminCaseListResult> {
  const filters = normalizeCaseListFilters(rawFilters);
  const loadedAt = Date.now();
  const referenceLeadIds = await leadIdsFromReferences(payload, filters.query);
  const leads = await payload.find({
    collection: "leads",
    depth: 1,
    limit: 300,
    overrideAccess: true,
    pagination: false,
    sort: "-createdAt",
    where: leadWhere(filters, referenceLeadIds),
  });
  const leadIds = leads.docs
    .map((doc) => numberId(doc))
    .filter((value): value is number => Boolean(value));
  const workersPromise = payload.find({
    collection: "users",
    depth: 0,
    limit: 200,
    overrideAccess: true,
    pagination: false,
    sort: "displayName",
    where: {
      and: [{ role: { equals: "worker" } }, { active: { equals: true } }],
    },
  });
  if (!leadIds.length) {
    const workers = await workersPromise;
    return {
      items: [],
      workers: workers.docs
        .map((worker) => ({
          id: numberId(worker) || 0,
          name: relationName(worker) || `#${numberId(worker)}`,
        }))
        .filter((worker) => worker.id > 0),
    };
  }

  const relatedWhere = { lead: { in: leadIds } };
  const common = {
    depth: 1,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    sort: "-createdAt" as const,
  };
  const [
    measurements,
    prices,
    quotes,
    messages,
    workOrders,
    contractRequests,
    workers,
  ] = await Promise.all([
    payload.find({
      ...common,
      collection: "roof-measurements",
      where: relatedWhere,
    }),
    payload.find({
      ...common,
      collection: "price-calculations",
      where: relatedWhere,
    }),
    payload.find({ ...common, collection: "quotes", where: relatedWhere }),
    payload.find({
      ...common,
      collection: "messages",
      where: { and: [relatedWhere, { status: { not_equals: "cancelled" } }] },
    }),
    payload.find({ ...common, collection: "work-orders", where: relatedWhere }),
    payload.find({
      ...common,
      collection: "customer-contract-requests",
      where: relatedWhere,
    }),
    workersPromise,
  ]);
  const quoteIds = quotes.docs
    .map((doc) => numberId(doc))
    .filter((value): value is number => Boolean(value));
  const contracts = quoteIds.length
    ? await payload.find({
        ...common,
        collection: "contracts",
        where: { quote: { in: quoteIds } },
      })
    : { docs: [] };

  const measurementByLead = firstByRelation(measurements.docs, "lead");
  const priceByLead = firstByRelation(prices.docs, "lead");
  const quoteByLead = firstByRelation(quotes.docs, "lead");
  const messageByLead = firstByRelation(messages.docs, "lead");
  const workByLead = firstByRelation(workOrders.docs, "lead");
  const contractRequestByLead = firstByRelation(contractRequests.docs, "lead");
  const contractByQuote = firstByRelation(contracts.docs, "quote");

  const items = leads.docs
    .map((raw) => {
      const lead = asRecord(raw);
      const id = numberId(lead) || 0;
      const measurement = measurementByLead.get(id);
      const price = priceByLead.get(id);
      const quote = quoteByLead.get(id);
      const message = messageByLead.get(id);
      const workOrder = workByLead.get(id);
      const contractRequest = contractRequestByLead.get(id);
      const contract = quote
        ? contractByQuote.get(numberId(quote) || 0)
        : undefined;
      const nextAction = deriveCaseNextAction({
        canPreparePackage:
          Boolean(
            text(lead.address) &&
            !/^ikke oppgitt$/i.test(text(lead.address) || ""),
          ) && text(lead.inquiryType) !== "usikker",
        contract: contract
          ? {
              id: numberId(contract) || 0,
              status: text(contract.status),
              companySignedAt: text(contract.companySignedAt),
            }
          : undefined,
        leadStatus: text(lead.status),
        nextActionBlocker: text(lead.nextActionBlocker),
        measurement: measurement
          ? { id: numberId(measurement) || 0, status: text(measurement.status) }
          : undefined,
        message: message
          ? {
              id: numberId(message) || 0,
              status: text(message.status),
              category: text(message.category),
              closesContract: messageClosesContract(message),
              direction: text(message.direction),
            }
          : undefined,
        price: price
          ? { id: numberId(price) || 0, status: text(price.status) }
          : undefined,
        quote: quote
          ? { id: numberId(quote) || 0, status: text(quote.status) }
          : undefined,
        workOrder: workOrder
          ? {
              id: numberId(workOrder) || 0,
              status: text(workOrder.status),
              documentationSubmittedAt: text(
                workOrder.documentationSubmittedAt,
              ),
            }
          : undefined,
      });
      const measurementBlockingReasons = Array.isArray(
        measurement?.blockingReasons,
      )
        ? measurement.blockingReasons.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const workBlockingReasons = Array.isArray(workOrder?.blockingReasons)
        ? workOrder.blockingReasons.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const nextActionBlockers: AdminCaseListItem["nextActionBlockers"] =
        nextAction.kind === "retry_message"
          ? [
              {
                code: text(message?.failureCode) || "MESSAGE_DELIVERY_FAILED",
                sourceId: numberId(message) || id,
                sourceType: "message",
              },
            ]
          : nextAction.kind === "measurement_required"
            ? (measurementBlockingReasons.length
                ? measurementBlockingReasons
                : ["MEASUREMENT_BLOCK_REASON_MISSING"]
              ).map((code) => ({
                code,
                sourceId: numberId(measurement) || id,
                sourceType: "measurement" as const,
              }))
            : nextAction.kind === "resolve_work_block"
              ? (workBlockingReasons.length
                  ? workBlockingReasons
                  : ["WORK_ORDER_BLOCKED"]
                ).map((code) => ({
                  code,
                  sourceId: numberId(workOrder) || id,
                  sourceType: "work_order" as const,
                }))
              : nextAction.kind === "review_cancellation" ||
                  nextAction.kind === "send_closure_confirmation"
                ? [
                    {
                      code:
                        text(lead.nextActionBlocker) ||
                        "CUSTOMER_CANCELLATION_REQUEST",
                      sourceId: numberId(contractRequest) || id,
                      sourceType: contractRequest ? "contract_request" : "case",
                    },
                  ]
                : nextAction.kind === "follow_up_decline"
                  ? [
                      {
                        code: "QUOTE_DECLINED",
                        sourceId: numberId(quote) || id,
                        sourceType: "quote",
                      },
                    ]
                  : [];
      const postalAddress = [
        text(lead.address),
        text(lead.houseNumber),
        text(lead.postal),
        text(lead.city),
      ]
        .filter(Boolean)
        .join(" ");
      return {
        archiveClassification: text(lead.archiveClassification),
        assignedWorker:
          relationName(workOrder?.assignedWorker) ||
          relationName(lead.assignedTo),
        assignedToId: numberId(lead.assignedTo),
        assignedWorkerId:
          numberId(workOrder?.assignedWorker) || numberId(lead.assignedTo),
        activeContractRequestId: numberId(contractRequest),
        createdAt: text(lead.createdAt),
        currentQuoteId: numberId(quote),
        customer: text(lead.name) || `#${id}`,
        dueAt: text(lead.nextActionAt),
        email: text(lead.email),
        href: `/admin-v2/cases/${id}`,
        id,
        inquiryType: text(lead.inquiryType),
        nextAction: nextAction.kind,
        nextActionBlockers,
        nextActionTargetId: nextAction.targetId,
        overdue: Boolean(
          text(lead.nextActionAt) &&
          new Date(text(lead.nextActionAt) || 0).getTime() <= loadedAt,
        ),
        phone: text(lead.phone),
        postalAddress,
        purgeAfter: text(lead.purgeAfter),
        recordState: text(lead.recordState) || "active",
        revision: typeof lead.caseRevision === "number" ? lead.caseRevision : 1,
        status: text(lead.status),
        storedNextActionBlocker: text(lead.nextActionBlocker),
        wakeAt:
          nextAction.kind === "wait_scheduled_start" ||
          nextAction.kind === "wait_worker_precheck" ||
          nextAction.kind === "wait_work_completion" ||
          nextAction.kind === "wait_worker_documentation"
            ? text(workOrder?.scheduledAt) || text(lead.nextActionAt)
            : nextAction.kind === "wait_customer"
              ? text(lead.nextActionAt)
              : undefined,
        workStatus: text(workOrder?.status),
      };
    })
    .filter((item) => {
      if (
        filters.action &&
        filters.action !== "all" &&
        item.nextAction !== filters.action
      )
        return false;
      if (filters.workerId && item.assignedWorkerId !== filters.workerId)
        return false;
      return true;
    });

  return {
    items: items.map((item) => ({
      archiveClassification: item.archiveClassification,
      assignedToId: item.assignedToId,
      assignedWorker: item.assignedWorker,
      assignedWorkerId: item.assignedWorkerId,
      activeContractRequestId: item.activeContractRequestId,
      createdAt: item.createdAt,
      currentQuoteId: item.currentQuoteId,
      customer: item.customer,
      dueAt: item.dueAt,
      email: item.email,
      href: item.href,
      id: item.id,
      inquiryType: item.inquiryType,
      nextAction: item.nextAction,
      nextActionBlockers: item.nextActionBlockers,
      nextActionTargetId: item.nextActionTargetId,
      overdue: item.overdue,
      phone: item.phone,
      postalAddress: item.postalAddress,
      purgeAfter: item.purgeAfter,
      recordState: item.recordState,
      revision: item.revision,
      status: item.status,
      storedNextActionBlocker: item.storedNextActionBlocker,
      wakeAt: item.wakeAt,
      workStatus: item.workStatus,
    })),
    workers: workers.docs
      .map((worker) => ({
        id: numberId(worker) || 0,
        name: relationName(worker) || `#${numberId(worker)}`,
      }))
      .filter((worker) => worker.id > 0),
  };
}
