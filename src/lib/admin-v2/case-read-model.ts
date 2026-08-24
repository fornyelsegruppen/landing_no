import type { Payload, Where } from "payload";

export type CaseNextActionKind =
  | "approve_measurement"
  | "approve_message"
  | "approve_quote"
  | "assign_worker"
  | "calculate_price"
  | "create_quote"
  | "create_work_order"
  | "generate_reply"
  | "issue_quote"
  | "measurement_required"
  | "none"
  | "retry_message"
  | "wait_customer";

export type CaseNextAction = {
  kind: CaseNextActionKind;
  targetId?: number;
};

type StatusRecord = {
  createdAt?: string;
  id: number;
  status?: string;
};

export type CaseActionInput = {
  contract?: StatusRecord;
  leadStatus?: string;
  measurement?: StatusRecord;
  message?: StatusRecord & { direction?: string };
  price?: StatusRecord;
  quote?: StatusRecord;
  workOrder?: StatusRecord;
};

export function deriveCaseNextAction(input: CaseActionInput): CaseNextAction {
  if (input.leadStatus === "closed") return { kind: "none" };
  if (input.message && ["failed", "attention"].includes(input.message.status || "")) {
    return { kind: "retry_message", targetId: input.message.id };
  }
  if (input.message?.status === "draft") {
    return { kind: "approve_message", targetId: input.message.id };
  }
  if (!input.message || input.message.direction === "inbound") {
    return { kind: "generate_reply" };
  }
  if (!input.measurement) return { kind: "measurement_required" };
  if (["draft", "review_required"].includes(input.measurement.status || "")) {
    return { kind: "approve_measurement", targetId: input.measurement.id };
  }
  if (input.measurement.status === "blocked") return { kind: "measurement_required", targetId: input.measurement.id };
  if (input.measurement.status === "approved" && !input.price) {
    return { kind: "calculate_price", targetId: input.measurement.id };
  }
  if (input.price?.status === "ready" && !input.quote) {
    return { kind: "create_quote", targetId: input.price.id };
  }
  if (input.quote?.status === "draft") return { kind: "approve_quote", targetId: input.quote.id };
  if (input.quote?.status === "approved") return { kind: "issue_quote", targetId: input.quote.id };
  if (["sent", "viewed"].includes(input.quote?.status || "")) return { kind: "wait_customer" };
  if (input.quote?.status === "accepted" && input.contract?.status === "signed" && !input.workOrder) {
    return { kind: "create_work_order", targetId: input.contract.id };
  }
  if (input.workOrder?.status === "unassigned") return { kind: "assign_worker", targetId: input.workOrder.id };
  return { kind: "none" };
}

export type CaseEntity = {
  createdAt?: string;
  href: string;
  id: number;
  reference: string;
  status?: string;
  summary?: string;
  updatedAt?: string;
};

export type CaseMessage = CaseEntity & {
  bodyText: string;
  category: string;
  channel: string;
  direction: string;
  failureMessage?: string;
  sentAt?: string;
  subject: string;
};

export type CaseDocument = {
  classification?: string;
  filename: string;
  href: string;
  id: number;
  mimeType?: string;
};

export type CaseTimelineItem = {
  at: string;
  href?: string;
  id: string;
  status?: string;
  title: string;
  type: "change" | "contract" | "lead" | "measurement" | "message" | "price" | "quote" | "work";
};

export type AdminCase = {
  changes: CaseEntity[];
  contract?: CaseEntity & { signedAt?: string };
  documents: CaseDocument[];
  lead: {
    address: string;
    assignedTo?: string;
    createdAt?: string;
    email?: string;
    id: number;
    inquiryType?: string;
    message?: string;
    name: string;
    nextAction?: string;
    nextActionAt?: string;
    phone?: string;
    postal?: string;
    status?: string;
  };
  measurement?: CaseEntity & {
    actualAreaMaxTenths?: number;
    actualAreaMinTenths?: number;
    confidence?: string;
    confidenceReasoning?: string;
    horizontalAreaTenths?: number;
    normalizedAddress?: string;
  };
  messages: CaseMessage[];
  nextAction: CaseNextAction;
  price?: CaseEntity & {
    maximumTotalIncVatOre?: number;
    subtotalExVatOre?: number;
    totalIncVatOre?: number;
    vatOre?: number;
  };
  quote?: CaseEntity & {
    maximumTotalIncVatOre?: number;
    totalIncVatOre?: number;
    validUntil?: string;
  };
  timeline: CaseTimelineItem[];
  workOrder?: CaseEntity & {
    assignedWorker?: string;
    scheduledAt?: string;
  };
};

function asRecord(value: unknown) {
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function numericId(value: unknown) {
  return typeof value === "number" ? value : Number.NaN;
}

function relationName(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = asRecord(value);
  return stringValue(record.displayName) || stringValue(record.name) || stringValue(record.email) || stringValue(record.reference);
}

function entity(collection: string, raw: unknown): CaseEntity {
  const record = asRecord(raw);
  const id = numericId(record.id);
  return {
    id,
    reference: stringValue(record.reference) || `#${id}`,
    status: stringValue(record.status) || stringValue(record.editorialStatus),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
    href: `/admin/collections/${collection}/${id}`,
  };
}

function latest<T>(items: T[]) {
  return items[0];
}

function timelineDate(record: Record<string, unknown>) {
  return stringValue(record.updatedAt) || stringValue(record.createdAt) || new Date(0).toISOString();
}

function makeTimeline(type: CaseTimelineItem["type"], collection: string, raw: unknown, title: string): CaseTimelineItem {
  const record = asRecord(raw);
  const id = numericId(record.id);
  return {
    id: `${type}-${id}`,
    type,
    title,
    status: stringValue(record.status),
    at: timelineDate(record),
    href: `/admin/collections/${collection}/${id}`,
  };
}

function currentMessage(messages: Array<Record<string, unknown>>) {
  const priority = messages.find((message) => ["failed", "attention", "draft"].includes(stringValue(message.status) || ""));
  if (priority) return priority;
  const latestMessage = messages[0];
  return latestMessage;
}

export async function loadAdminCase(payload: Payload, leadId: number): Promise<AdminCase | null> {
  let leadRaw: unknown;
  try {
    leadRaw = await payload.findByID({ collection: "leads", id: leadId, depth: 1, overrideAccess: true });
  } catch {
    return null;
  }
  const lead = asRecord(leadRaw);
  const common = { depth: 1, limit: 100, overrideAccess: true, sort: "-createdAt" as const };
  const [measurementsResult, pricesResult, quotesResult, messagesResult, workOrdersResult] = await Promise.all([
    payload.find({ ...common, collection: "roof-measurements", where: { lead: { equals: leadId } } }),
    payload.find({ ...common, collection: "price-calculations", where: { lead: { equals: leadId } } }),
    payload.find({ ...common, collection: "quotes", sort: "-version", where: { lead: { equals: leadId } } }),
    payload.find({ ...common, collection: "messages", where: { lead: { equals: leadId } } }),
    payload.find({ ...common, collection: "work-orders", where: { lead: { equals: leadId } } }),
  ]);

  const measurements = measurementsResult.docs.map(asRecord);
  const prices = pricesResult.docs.map(asRecord);
  const quotes = quotesResult.docs.map(asRecord);
  const messages = messagesResult.docs.map(asRecord);
  const workOrders = workOrdersResult.docs.map(asRecord);
  const quoteIds = quotes.map((quote) => numericId(quote.id)).filter(Number.isFinite);
  const workOrderIds = workOrders.map((work) => numericId(work.id)).filter(Number.isFinite);

  const [contractsResult, changesResult] = await Promise.all([
    quoteIds.length
      ? payload.find({ ...common, collection: "contracts", sort: "-version", where: { quote: { in: quoteIds } } })
      : Promise.resolve({ docs: [] }),
    workOrderIds.length
      ? payload.find({ ...common, collection: "change-agreements", where: { workOrder: { in: workOrderIds } } })
      : Promise.resolve({ docs: [] }),
  ]);
  const contracts = contractsResult.docs.map(asRecord);
  const changes = changesResult.docs.map(asRecord);

  const ownerPairs = [
    { ownerType: "lead", ids: [leadId] },
    { ownerType: "quote", ids: quoteIds },
    { ownerType: "contract", ids: contracts.map((item) => numericId(item.id)).filter(Number.isFinite) },
    { ownerType: "work-order", ids: workOrderIds },
    { ownerType: "work", ids: workOrderIds },
    { ownerType: "change-agreement", ids: changes.map((item) => numericId(item.id)).filter(Number.isFinite) },
  ].filter((pair) => pair.ids.length);
  const mediaResult = ownerPairs.length
    ? await payload.find({
        collection: "private-media",
        depth: 0,
        limit: 100,
        overrideAccess: true,
        sort: "-createdAt",
        where: {
          or: ownerPairs.map((pair) => ({
            and: [
              { ownerType: { equals: pair.ownerType } },
              { ownerId: { in: pair.ids.map(String) } },
            ],
          })),
        } as unknown as Where,
      })
    : { docs: [] };

  const latestMeasurementRaw = latest(measurements.filter((item) => item.status !== "superseded")) || latest(measurements);
  const latestPriceRaw = latest(prices.filter((item) => item.status !== "superseded")) || latest(prices);
  const latestQuoteRaw = latest(quotes.filter((item) => item.status !== "superseded")) || latest(quotes);
  const latestContractRaw = latest(contracts.filter((item) => item.status !== "superseded")) || latest(contracts);
  const latestWorkRaw = latest(workOrders.filter((item) => item.status !== "cancelled")) || latest(workOrders);
  const currentMessageRaw = currentMessage(messages);

  const measurement = latestMeasurementRaw ? {
    ...entity("roof-measurements", latestMeasurementRaw),
    normalizedAddress: stringValue(latestMeasurementRaw.normalizedAddress),
    confidence: stringValue(latestMeasurementRaw.confidence),
    confidenceReasoning: stringValue(latestMeasurementRaw.confidenceReasoning),
    horizontalAreaTenths: numberValue(latestMeasurementRaw.horizontalAreaTenths),
    actualAreaMinTenths: numberValue(latestMeasurementRaw.actualAreaMinTenths),
    actualAreaMaxTenths: numberValue(latestMeasurementRaw.actualAreaMaxTenths),
  } : undefined;
  const price = latestPriceRaw ? {
    ...entity("price-calculations", latestPriceRaw),
    subtotalExVatOre: numberValue(latestPriceRaw.subtotalExVatOre),
    vatOre: numberValue(latestPriceRaw.vatOre),
    totalIncVatOre: numberValue(latestPriceRaw.totalIncVatOre),
    maximumTotalIncVatOre: numberValue(latestPriceRaw.maximumTotalIncVatOre),
  } : undefined;
  const quote = latestQuoteRaw ? {
    ...entity("quotes", latestQuoteRaw),
    totalIncVatOre: numberValue(latestQuoteRaw.totalIncVatOre),
    maximumTotalIncVatOre: numberValue(latestQuoteRaw.maximumTotalIncVatOre),
    validUntil: stringValue(latestQuoteRaw.validUntil),
  } : undefined;
  const contract = latestContractRaw ? {
    ...entity("contracts", latestContractRaw),
    signedAt: stringValue(latestContractRaw.signedAt),
  } : undefined;
  const workOrder = latestWorkRaw ? {
    ...entity("work-orders", latestWorkRaw),
    assignedWorker: relationName(latestWorkRaw.assignedWorker),
    scheduledAt: stringValue(latestWorkRaw.scheduledAt),
  } : undefined;

  const mappedMessages: CaseMessage[] = messages.map((message) => ({
    ...entity("messages", message),
    reference: stringValue(message.subject) || `#${numericId(message.id)}`,
    subject: stringValue(message.subject) || "",
    bodyText: stringValue(message.bodyText) || "",
    direction: stringValue(message.direction) || "outbound",
    category: stringValue(message.category) || "",
    channel: stringValue(message.channel) || "",
    sentAt: stringValue(message.sentAt),
    failureMessage: stringValue(message.failureMessage),
  }));

  const nextAction = deriveCaseNextAction({
    leadStatus: stringValue(lead.status),
    message: currentMessageRaw ? {
      id: numericId(currentMessageRaw.id),
      status: stringValue(currentMessageRaw.status),
      direction: stringValue(currentMessageRaw.direction),
      createdAt: stringValue(currentMessageRaw.createdAt),
    } : undefined,
    measurement,
    price,
    quote,
    contract,
    workOrder,
  });

  const leadTimeline: CaseTimelineItem = {
      id: `lead-${leadId}`,
      type: "lead",
      title: stringValue(lead.name) || `#${leadId}`,
      status: stringValue(lead.status),
      at: stringValue(lead.createdAt) || new Date(0).toISOString(),
      href: `/admin/collections/leads/${leadId}`,
    };
  const timeline: CaseTimelineItem[] = [
    leadTimeline,
    ...messages.map((item) => makeTimeline("message", "messages", item, stringValue(item.subject) || "Melding")),
    ...measurements.map((item) => makeTimeline("measurement", "roof-measurements", item, stringValue(item.reference) || "Takmåling")),
    ...prices.map((item) => makeTimeline("price", "price-calculations", item, stringValue(item.reference) || "Prisberegning")),
    ...quotes.map((item) => makeTimeline("quote", "quotes", item, stringValue(item.reference) || "Tilbud")),
    ...contracts.map((item) => makeTimeline("contract", "contracts", item, stringValue(item.reference) || "Kontrakt")),
    ...workOrders.map((item) => makeTimeline("work", "work-orders", item, stringValue(item.reference) || "Arbeid")),
    ...changes.map((item) => makeTimeline("change", "change-agreements", item, stringValue(item.reference) || "Endringsavtale")),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    lead: {
      id: leadId,
      name: stringValue(lead.name) || `#${leadId}`,
      email: stringValue(lead.email),
      phone: stringValue(lead.phone),
      address: [stringValue(lead.address), stringValue(lead.houseNumber), stringValue(lead.postal), stringValue(lead.city)].filter(Boolean).join(" "),
      postal: stringValue(lead.postal),
      inquiryType: stringValue(lead.inquiryType),
      message: stringValue(lead.message),
      status: stringValue(lead.status),
      assignedTo: relationName(lead.assignedTo),
      nextAction: stringValue(lead.nextAction),
      nextActionAt: stringValue(lead.nextActionAt),
      createdAt: stringValue(lead.createdAt),
    },
    measurement,
    price,
    quote,
    contract,
    workOrder,
    changes: changes.map((item) => ({ ...entity("change-agreements", item), summary: stringValue(item.reasonDescription) })),
    messages: mappedMessages,
    documents: mediaResult.docs.map((raw) => {
      const item = asRecord(raw);
      const id = numericId(item.id);
      const url = stringValue(item.url);
      return {
        id,
        filename: stringValue(item.filename) || `#${id}`,
        classification: stringValue(item.classification),
        mimeType: stringValue(item.mimeType),
        href: url?.includes(".blob.vercel-storage.com")
          ? `/api/admin/blob?url=${encodeURIComponent(url)}`
          : `/admin/collections/private-media/${id}`,
      };
    }),
    timeline,
    nextAction,
  };
}
