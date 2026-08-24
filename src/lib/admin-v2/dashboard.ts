import type { Payload, Where } from "payload";

export const adminQueueKeys = [
  "new-leads",
  "reply-drafts",
  "change-agreements",
  "blog-review",
  "quote-review",
  "contract-signing",
  "active-work",
  "attention",
  "unassigned-work",
  "upcoming-work",
] as const;

export type AdminQueueKey = (typeof adminQueueKeys)[number];

export type AdminDashboardCounts = {
  activeWork: number;
  aiDrafts: number;
  attention: number;
  changeAgreements: number;
  newLeads: number;
  pendingContracts: number;
  pendingQuotes: number;
  replyDrafts: number;
  unassignedWork: number;
  upcomingWork: number;
};

export type AdminDashboardSnapshot =
  | { ok: true; counts: AdminDashboardCounts }
  | { ok: false; counts: null };

export type AdminListItem = {
  createdAt?: string;
  customer?: string;
  href: string;
  id: number | string;
  reference: string;
  status?: string;
  subtitle?: string;
};

export type AdminSearchResult = AdminListItem & {
  type: "contract" | "lead" | "quote" | "workOrder";
};

export function normalizeAdminSearchTerm(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function parseAdminQueue(value: unknown): AdminQueueKey | null {
  return typeof value === "string" &&
    (adminQueueKeys as readonly string[]).includes(value)
    ? (value as AdminQueueKey)
    : null;
}

function countTotal(result: { totalDocs: number }) {
  return result.totalDocs;
}

export async function loadAdminDashboard(
  payload: Pick<Payload, "count">,
  now = new Date(),
): Promise<AdminDashboardSnapshot> {
  const next72Hours = new Date(now.getTime() + 72 * 60 * 60_000);
  try {
    const [
      newLeads,
      aiDrafts,
      replyDrafts,
      operationalAttention,
      seoAttention,
      messageAttention,
      blockedWork,
      activeWork,
      unassignedWork,
      pendingQuotes,
      pendingContracts,
      changeAgreements,
      upcomingWork,
    ] = await Promise.all([
      payload.count({ collection: "leads", where: { status: { equals: "new" } } }),
      payload.count({ collection: "posts", where: { editorialStatus: { in: ["ai_qa", "human_review"] } } }),
      payload.count({ collection: "messages", where: { status: { equals: "draft" } } }),
      payload.count({ collection: "operational-jobs", where: { status: { in: ["failed", "attention"] } } }),
      payload.count({ collection: "seo-runs", where: { status: { in: ["failed", "attention"] } } }),
      payload.count({ collection: "messages", where: { status: { in: ["failed", "attention"] } } }),
      payload.count({ collection: "work-orders", where: { status: { equals: "blocked" } } }),
      payload.count({ collection: "work-orders", where: { status: { in: ["assigned", "scheduled", "on_way", "arrived", "precheck", "ready", "in_progress", "completed"] } } }),
      payload.count({ collection: "work-orders", where: { status: { equals: "unassigned" } } }),
      payload.count({ collection: "quotes", where: { status: { equals: "draft" } } }),
      payload.count({ collection: "contracts", where: { status: { equals: "issued" } } }),
      payload.count({ collection: "change-agreements", where: { status: { in: ["draft", "approved", "sent", "viewed"] } } }),
      payload.count({
        collection: "work-orders",
        where: {
          and: [
            { scheduledAt: { greater_than_equal: now.toISOString() } },
            { scheduledAt: { less_than_equal: next72Hours.toISOString() } },
            { status: { not_in: ["cancelled", "documented"] } },
          ],
        },
      }),
    ]);

    return {
      ok: true,
      counts: {
        activeWork: countTotal(activeWork),
        aiDrafts: countTotal(aiDrafts),
        attention:
          countTotal(operationalAttention) +
          countTotal(seoAttention) +
          countTotal(messageAttention) +
          countTotal(blockedWork),
        changeAgreements: countTotal(changeAgreements),
        newLeads: countTotal(newLeads),
        pendingContracts: countTotal(pendingContracts),
        pendingQuotes: countTotal(pendingQuotes),
        replyDrafts: countTotal(replyDrafts),
        unassignedWork: countTotal(unassignedWork),
        upcomingWork: countTotal(upcomingWork),
      },
    };
  } catch {
    return { ok: false, counts: null };
  }
}

function relationLabel(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const relation = value as Record<string, unknown>;
  if (typeof relation.name === "string") return relation.name;
  if (typeof relation.reference === "string") return relation.reference;
  return undefined;
}

function relationIdentifier(value: unknown) {
  if (typeof value === "number") return value;
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>).id;
  return typeof candidate === "number" ? candidate : undefined;
}

function asRecord(value: unknown) {
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function id(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : "";
}

function leadItem(doc: unknown): AdminListItem {
  const item = asRecord(doc);
  const itemId = id(item.id);
  const address = [text(item.address), text(item.houseNumber), text(item.postal), text(item.city)]
    .filter(Boolean)
    .join(" ");
  return {
    id: itemId,
    reference: text(item.name) || `#${itemId}`,
    customer: text(item.name),
    subtitle: address || text(item.email) || text(item.phone),
    status: text(item.status),
    createdAt: text(item.createdAt),
    href: `/admin-v2/cases/${itemId}`,
  };
}

function referenceItem(collection: "contracts" | "quotes" | "work-orders", doc: unknown): AdminListItem {
  const item = asRecord(doc);
  const itemId = id(item.id);
  const quote = item.quote && typeof item.quote === "object" ? item.quote as Record<string, unknown> : null;
  const leadId = relationIdentifier(item.lead) ?? relationIdentifier(quote?.lead);
  return {
    id: itemId,
    reference: text(item.reference) || `#${itemId}`,
    customer: relationLabel(item.lead),
    subtitle: collection === "work-orders" ? text(item.workSummary) : undefined,
    status: text(item.status),
    createdAt: text(item.createdAt),
    href: leadId ? `/admin-v2/cases/${leadId}` : `/admin/collections/${collection}/${itemId}`,
  };
}

function genericItem(collection: string, doc: unknown): AdminListItem {
  const item = asRecord(doc);
  const itemId = id(item.id);
  const workOrder = item.workOrder && typeof item.workOrder === "object" ? item.workOrder as Record<string, unknown> : null;
  const leadId = relationIdentifier(item.lead) ?? relationIdentifier(workOrder?.lead);
  return {
    id: itemId,
    reference: text(item.reference) || text(item.subject) || text(item.titleNo) || `#${itemId}`,
    customer: relationLabel(item.lead),
    status: text(item.status) || text(item.editorialStatus),
    createdAt: text(item.createdAt),
    href: leadId ? `/admin-v2/cases/${leadId}` : `/admin/collections/${collection}/${itemId}`,
  };
}

export async function loadAdminQueue(
  payload: Pick<Payload, "find">,
  queue: AdminQueueKey,
  now = new Date(),
): Promise<AdminListItem[]> {
  const next72Hours = new Date(now.getTime() + 72 * 60 * 60_000);
  const common = { depth: 1, limit: 30, overrideAccess: true, sort: "-createdAt" as const };

  switch (queue) {
    case "new-leads": {
      const result = await payload.find({ ...common, collection: "leads", where: { status: { equals: "new" } } });
      return result.docs.map(leadItem);
    }
    case "reply-drafts": {
      const result = await payload.find({ ...common, collection: "messages", where: { status: { equals: "draft" } } });
      return result.docs.map((doc) => genericItem("messages", doc));
    }
    case "change-agreements": {
      const result = await payload.find({ ...common, collection: "change-agreements", where: { status: { in: ["draft", "approved", "sent", "viewed"] } } });
      return result.docs.map((doc) => genericItem("change-agreements", doc));
    }
    case "blog-review": {
      const result = await payload.find({ ...common, collection: "posts", where: { editorialStatus: { in: ["ai_qa", "human_review"] } } });
      return result.docs.map((doc) => genericItem("posts", doc));
    }
    case "quote-review": {
      const result = await payload.find({ ...common, collection: "quotes", where: { status: { equals: "draft" } } });
      return result.docs.map((doc) => referenceItem("quotes", doc));
    }
    case "contract-signing": {
      const result = await payload.find({ ...common, collection: "contracts", where: { status: { equals: "issued" } } });
      return result.docs.map((doc) => referenceItem("contracts", doc));
    }
    case "active-work": {
      const result = await payload.find({ ...common, collection: "work-orders", where: { status: { in: ["assigned", "scheduled", "on_way", "arrived", "precheck", "ready", "in_progress", "completed"] } } });
      return result.docs.map((doc) => referenceItem("work-orders", doc));
    }
    case "unassigned-work": {
      const result = await payload.find({ ...common, collection: "work-orders", where: { status: { equals: "unassigned" } } });
      return result.docs.map((doc) => referenceItem("work-orders", doc));
    }
    case "upcoming-work": {
      const result = await payload.find({
        ...common,
        collection: "work-orders",
        sort: "scheduledAt",
        where: { and: [
          { scheduledAt: { greater_than_equal: now.toISOString() } },
          { scheduledAt: { less_than_equal: next72Hours.toISOString() } },
          { status: { not_in: ["cancelled", "documented"] } },
        ] },
      });
      return result.docs.map((doc) => referenceItem("work-orders", doc));
    }
    case "attention": {
      const [work, messages, operations] = await Promise.all([
        payload.find({ ...common, collection: "work-orders", where: { status: { equals: "blocked" } } }),
        payload.find({ ...common, collection: "messages", where: { status: { in: ["failed", "attention"] } } }),
        payload.find({ ...common, collection: "operational-jobs", where: { status: { in: ["failed", "attention"] } } }),
      ]);
      return [
        ...work.docs.map((doc) => referenceItem("work-orders", doc)),
        ...messages.docs.map((doc) => genericItem("messages", doc)),
        ...operations.docs.map((doc) => genericItem("operational-jobs", doc)),
      ].slice(0, 30);
    }
  }
}

function containsAny(fields: string[], query: string): Where {
  return { or: fields.map((field) => ({ [field]: { contains: query } })) };
}

export async function searchAdminRecords(
  payload: Pick<Payload, "find">,
  rawQuery: unknown,
): Promise<AdminSearchResult[]> {
  const query = normalizeAdminSearchTerm(rawQuery);
  if (query.length < 2) return [];
  const common = { depth: 1, limit: 8, overrideAccess: true, sort: "-createdAt" as const };
  const [leads, quotes, contracts, workOrders] = await Promise.all([
    payload.find({ ...common, collection: "leads", where: containsAny(["name", "email", "phone", "address", "houseNumber", "postal", "city"], query) }),
    payload.find({ ...common, collection: "quotes", where: { reference: { contains: query } } }),
    payload.find({ ...common, collection: "contracts", where: { reference: { contains: query } } }),
    payload.find({ ...common, collection: "work-orders", where: { reference: { contains: query } } }),
  ]);

  return [
    ...leads.docs.map((doc) => ({ ...leadItem(doc), type: "lead" as const })),
    ...quotes.docs.map((doc) => ({ ...referenceItem("quotes", doc), type: "quote" as const })),
    ...contracts.docs.map((doc) => ({ ...referenceItem("contracts", doc), type: "contract" as const })),
    ...workOrders.docs.map((doc) => ({ ...referenceItem("work-orders", doc), type: "workOrder" as const })),
  ].slice(0, 24);
}
