import type { Payload, Where } from "payload";

export type CaseNextActionKind =
  | "approve_measurement"
  | "approve_package"
  | "approve_message"
  | "approve_quote"
  | "assign_worker"
  | "calculate_price"
  | "company_sign_contract"
  | "create_quote"
  | "create_work_order"
  | "generate_reply"
  | "follow_up_decline"
  | "issue_quote"
  | "measurement_required"
  | "prepare_package"
  | "review_completion"
  | "resolve_work_block"
  | "schedule_work"
  | "none"
  | "retry_message"
  | "wait_customer"
  | "wait_worker_documentation";

export type CaseNextAction = {
  kind: CaseNextActionKind;
  targetId?: number;
};

export function caseActionRequiresConfirmation(kind: CaseNextActionKind) {
  return ["approve_package", "calculate_price", "create_quote", "approve_quote", "issue_quote"].includes(kind);
}

type StatusRecord = {
  createdAt?: string;
  companySignedAt?: string;
  id: number;
  status?: string;
};

export type CaseActionInput = {
  aiRecommendedNextAction?: string;
  canPreparePackage?: boolean;
  contract?: StatusRecord;
  leadStatus?: string;
  measurement?: StatusRecord;
  message?: StatusRecord & { category?: string; direction?: string };
  price?: StatusRecord;
  quote?: StatusRecord;
  workOrder?: StatusRecord & { documentationSubmittedAt?: string };
};

export function deriveCaseNextAction(input: CaseActionInput): CaseNextAction {
  if (input.leadStatus === "closed") return { kind: "none" };
  if (input.quote?.status === "declined") return { kind: "follow_up_decline", targetId: input.quote.id };
  if (input.message && ["failed", "attention"].includes(input.message.status || "")) {
    return { kind: "retry_message", targetId: input.message.id };
  }
  if (input.workOrder?.status === "unassigned") return { kind: "assign_worker", targetId: input.workOrder.id };
  if (input.workOrder?.status === "assigned") return { kind: "schedule_work", targetId: input.workOrder.id };
  if (input.workOrder?.status === "blocked") return { kind: "resolve_work_block", targetId: input.workOrder.id };
  if (input.workOrder?.status === "completed" && input.workOrder.documentationSubmittedAt) return { kind: "review_completion", targetId: input.workOrder.id };
  if (input.workOrder?.status === "completed") return { kind: "wait_worker_documentation", targetId: input.workOrder.id };
  if (input.quote?.status === "accepted" && input.contract?.status === "signed" && !input.contract.companySignedAt) {
    return { kind: "company_sign_contract", targetId: input.contract.id };
  }
  if (input.quote?.status === "accepted" && input.contract?.status === "signed" && input.contract.companySignedAt && !input.workOrder) {
    return { kind: "create_work_order", targetId: input.contract.id };
  }
  const measurementAiDraft = input.message?.status === "draft"
    && input.message.category === "ai_reply"
    && input.canPreparePackage === true;
  if (input.message?.status === "draft" && !measurementAiDraft) {
    return { kind: "approve_message", targetId: input.message.id };
  }
  if (!input.message || input.message.direction === "inbound") {
    return { kind: "generate_reply" };
  }
  if (!input.measurement) return { kind: "prepare_package" };
  if (
    ["draft", "review_required"].includes(input.measurement.status || "")
    && input.price
    && input.quote?.status === "draft"
    && input.contract?.status === "draft"
  ) {
    return { kind: "approve_package", targetId: input.quote.id };
  }
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
  type: "change" | "contract" | "invoice" | "lead" | "measurement" | "message" | "price" | "quote" | "warranty" | "work";
};

export type AdminCase = {
  changes: CaseEntity[];
  contract?: CaseEntity & { companySignedAt?: string; documentHash?: string; signedAt?: string };
  documents: CaseDocument[];
  lead: {
    address: string;
    archiveClassification?: string;
    archiveReason?: string;
    archivedAt?: string;
    assignedTo?: string;
    createdAt?: string;
    email?: string;
    id: number;
    inquiryType?: string;
    message?: string;
    name: string;
    nextAction?: string;
    nextActionAt?: string;
    nextActionOverdue: boolean;
    phone?: string;
    postal?: string;
    qualification?: unknown;
    purgeAfter?: string;
    recordState: "active" | "archived" | "trashed";
    status?: string;
    trashedAt?: string;
  };
  measurement?: CaseEntity & {
    actualAreaMaxTenths?: number;
    actualAreaMinTenths?: number;
    confidence?: string;
    confidenceReasoning?: string;
    horizontalAreaTenths?: number;
    manualAreaOverrideTenths?: number;
    manualOverrideReason?: string;
    manualOverriddenAt?: string;
    normalizedAddress?: string;
  };
  messages: CaseMessage[];
  nextAction: CaseNextAction;
  price?: CaseEntity & {
    adjustmentReason?: string;
    discountOre?: number;
    maximumTotalIncVatOre?: number;
    subtotalExVatOre?: number;
    totalIncVatOre?: number;
    unitPriceExVatOre?: number;
    vatOre?: number;
  };
  quote?: CaseEntity & {
    maximumTotalIncVatOre?: number;
    optionGroup?: string;
    optionKind?: string;
    siblingQuoteId?: number;
    serviceDescription?: string;
    totalIncVatOre?: number;
    validUntil?: string;
  };
  quoteOptions: Array<CaseEntity & { maximumTotalIncVatOre?: number; optionKind?: string; serviceDescription?: string; totalIncVatOre?: number }>;
  timeline: CaseTimelineItem[];
  workOrder?: CaseEntity & {
    adminNote?: string;
    arrivalWindow?: string;
    assignedWorker?: string;
    assignedWorkerId?: number;
    scheduledAt?: string;
    actualAreaTenths?: number;
    actualTotalIncVatOre?: number;
    beforePhotoCount: number;
    afterPhotoCount: number;
    completionNotes?: string;
    completedAt?: string;
    documentationSubmittedAt?: string;
    completionReviewedAt?: string;
    workSummary: string;
  };
  invoice?: CaseEntity & { adminNote?: string; documentId?: number; dueAt?: string; externalReference?: string; subtotalExVatOre?: number; totalIncVatOre?: number; vatOre?: number };
  warranty?: CaseEntity & { documentId?: number; endsAt?: string; scope?: string; startsAt?: string; termsVersion?: string };
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

function manualOverride(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = value as Record<string, unknown>;
  if (!snapshot.manualOverride || typeof snapshot.manualOverride !== "object") return undefined;
  return snapshot.manualOverride as Record<string, unknown>;
}

function numericId(value: unknown) {
  return typeof value === "number" ? value : Number.NaN;
}

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return undefined;
}

function relationName(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = asRecord(value);
  return stringValue(record.displayName) || stringValue(record.name) || stringValue(record.email) || stringValue(record.reference);
}

function qualificationForAdmin(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const qualification = value as Record<string, unknown>;
  const preparation = qualification.packagePreparation;
  if (!preparation || typeof preparation !== "object" || (preparation as Record<string, unknown>).status !== "ready_for_admin_review") {
    return value;
  }
  const missing = Array.isArray(qualification.missingInformation)
    ? qualification.missingInformation.filter((item) =>
        typeof item !== "string" || !/(?:approximate.?roof.?area|takareal|roof.?size|customer.?question)/i.test(item))
    : qualification.missingInformation;
  return {
    ...qualification,
    missingInformation: missing,
    recommendedNextAction: "start_measurement",
  };
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

function makeTimeline(type: CaseTimelineItem["type"], _collection: string, raw: unknown, title: string): CaseTimelineItem {
  const record = asRecord(raw);
  const id = numericId(record.id);
  return {
    id: `${type}-${id}`,
    type,
    title,
    status: stringValue(record.status),
    at: timelineDate(record),
    href: type === "lead"
      ? "#customer-section"
      : type === "message"
        ? `#message-${id}`
        : type === "measurement"
          ? "#measurement-section"
          : type === "price" || type === "quote"
            ? "#price-quote-section"
            : type === "contract"
              ? "#contract-section"
              : type === "work"
                ? "#work-section"
                : "#changes-section",
  };
}

function makeTimedEvent(type: CaseTimelineItem["type"], collection: string, raw: Record<string, unknown>, field: string, status: string): CaseTimelineItem | null {
  const at = stringValue(raw[field]);
  if (!at) return null;
  const id = numericId(raw.id);
  return {
    id: `${type}-${id}-${field}`,
    type,
    title: stringValue(raw.reference) || `#${id}`,
    status,
    at,
    href: type === "contract" ? "#contract-section" : `/admin/collections/${collection}/${id}`,
  };
}

function currentMessage(messages: Array<Record<string, unknown>>) {
  const priority = messages.find((message) => {
    if (!["failed", "attention", "draft"].includes(stringValue(message.status) || "")) return false;
    const createdAt = new Date(stringValue(message.createdAt) || 0).getTime();
    const subject = stringValue(message.subject);
    const category = stringValue(message.category);
    const newerEquivalentSucceeded = messages.some((candidate) => {
      if (candidate.id === message.id) return false;
      if (!["approved", "queued", "sent", "delivered"].includes(stringValue(candidate.status) || "")) return false;
      if (stringValue(candidate.subject) !== subject || stringValue(candidate.category) !== category) return false;
      return new Date(stringValue(candidate.createdAt) || 0).getTime() > createdAt;
    });
    return !newerEquivalentSucceeded;
  });
  if (priority) return priority;
  const latestMessage = messages[0];
  return latestMessage;
}

export async function loadAdminCase(payload: Payload, leadId: number): Promise<AdminCase | null> {
  const loadedAt = Date.now();
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

  const [contractsResult, changesResult, invoicesResult, warrantiesResult] = await Promise.all([
    quoteIds.length
      ? payload.find({ ...common, collection: "contracts", sort: "-version", where: { quote: { in: quoteIds } } })
      : Promise.resolve({ docs: [] }),
    workOrderIds.length
      ? payload.find({ ...common, collection: "change-agreements", where: { workOrder: { in: workOrderIds } } })
      : Promise.resolve({ docs: [] }),
    payload.find({ ...common, collection: "invoice-records", where: { lead: { equals: leadId } } }),
    payload.find({ ...common, collection: "warranties", where: { lead: { equals: leadId } } }),
  ]);
  const contracts = contractsResult.docs.map(asRecord);
  const changes = changesResult.docs.map(asRecord);
  const invoices = invoicesResult.docs.map(asRecord);
  const warranties = warrantiesResult.docs.map(asRecord);

  const ownerPairs = [
    { ownerType: "lead", ids: [leadId] },
    { ownerType: "quote", ids: quoteIds },
    { ownerType: "contract", ids: contracts.map((item) => numericId(item.id)).filter(Number.isFinite) },
    { ownerType: "work-order", ids: workOrderIds },
    { ownerType: "work", ids: workOrderIds },
    { ownerType: "change-agreement", ids: changes.map((item) => numericId(item.id)).filter(Number.isFinite) },
    { ownerType: "invoice-record", ids: invoices.map((item) => numericId(item.id)).filter(Number.isFinite) },
    { ownerType: "warranty", ids: warranties.map((item) => numericId(item.id)).filter(Number.isFinite) },
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
  const latestInvoiceRaw = latest(invoices);
  const latestWarrantyRaw = latest(warranties);
  const currentMessageRaw = currentMessage(messages);
  const visibleMessages = messages.filter((message) =>
    !(stringValue(message.category) === "ai_reply" && stringValue(message.status) === "cancelled"),
  );

  const latestManualOverride = latestMeasurementRaw ? manualOverride(latestMeasurementRaw.calculationSnapshot) : undefined;
  const measurement = latestMeasurementRaw ? {
    ...entity("roof-measurements", latestMeasurementRaw),
    normalizedAddress: stringValue(latestMeasurementRaw.normalizedAddress),
    confidence: stringValue(latestMeasurementRaw.confidence),
    confidenceReasoning: stringValue(latestMeasurementRaw.confidenceReasoning),
    horizontalAreaTenths: numberValue(latestMeasurementRaw.horizontalAreaTenths),
    manualAreaOverrideTenths: numberValue(latestManualOverride?.areaTenths),
    manualOverrideReason: stringValue(latestManualOverride?.reason),
    manualOverriddenAt: stringValue(latestManualOverride?.overriddenAt),
    actualAreaMinTenths: numberValue(latestMeasurementRaw.actualAreaMinTenths),
    actualAreaMaxTenths: numberValue(latestMeasurementRaw.actualAreaMaxTenths),
  } : undefined;
  const priceOutput = latestPriceRaw?.outputSnapshot && typeof latestPriceRaw.outputSnapshot === "object" ? asRecord(latestPriceRaw.outputSnapshot) : undefined;
  const priceAdjustment = priceOutput?.adjustment && typeof priceOutput.adjustment === "object" ? asRecord(priceOutput.adjustment) : undefined;
  const priceLineItems = Array.isArray(priceOutput?.lineItems) ? priceOutput.lineItems : [];
  const firstPriceLine = priceLineItems[0] && typeof priceLineItems[0] === "object" ? asRecord(priceLineItems[0]) : undefined;
  const price = latestPriceRaw ? {
    ...entity("price-calculations", latestPriceRaw),
    adjustmentReason: stringValue(priceAdjustment?.reason),
    discountOre: numberValue(priceAdjustment?.discountOre),
    subtotalExVatOre: numberValue(latestPriceRaw.subtotalExVatOre),
    vatOre: numberValue(latestPriceRaw.vatOre),
    totalIncVatOre: numberValue(latestPriceRaw.totalIncVatOre),
    maximumTotalIncVatOre: numberValue(latestPriceRaw.maximumTotalIncVatOre),
    unitPriceExVatOre: numberValue(firstPriceLine?.unitPriceExVatOre),
  } : undefined;
  const quote = latestQuoteRaw ? {
    ...entity("quotes", latestQuoteRaw),
    totalIncVatOre: numberValue(latestQuoteRaw.totalIncVatOre),
    maximumTotalIncVatOre: numberValue(latestQuoteRaw.maximumTotalIncVatOre),
    optionGroup: stringValue(latestQuoteRaw.optionGroup),
    optionKind: stringValue(latestQuoteRaw.optionKind),
    siblingQuoteId: relationId(latestQuoteRaw.siblingQuote),
    serviceDescription: stringValue(latestQuoteRaw.serviceDescription),
    validUntil: stringValue(latestQuoteRaw.validUntil),
  } : undefined;
  const quoteOptions = latestQuoteRaw?.optionGroup ? quotes
    .filter((item) => item.status !== "superseded" && item.optionGroup === latestQuoteRaw.optionGroup)
    .map((item) => ({
      ...entity("quotes", item),
      maximumTotalIncVatOre: numberValue(item.maximumTotalIncVatOre),
      optionKind: stringValue(item.optionKind),
      serviceDescription: stringValue(item.serviceDescription),
      totalIncVatOre: numberValue(item.totalIncVatOre),
    })) : [];
  const contract = latestContractRaw ? {
    ...entity("contracts", latestContractRaw),
    signedAt: stringValue(latestContractRaw.signedAt),
    companySignedAt: stringValue(latestContractRaw.companySignedAt),
    documentHash: stringValue(latestContractRaw.documentHash),
  } : undefined;
  const workOrder = latestWorkRaw ? {
    ...entity("work-orders", latestWorkRaw),
    adminNote: stringValue(latestWorkRaw.adminNote),
    arrivalWindow: stringValue(latestWorkRaw.arrivalWindow),
    assignedWorker: relationName(latestWorkRaw.assignedWorker),
    assignedWorkerId: relationId(latestWorkRaw.assignedWorker) || undefined,
    scheduledAt: stringValue(latestWorkRaw.scheduledAt),
    actualAreaTenths: numberValue(latestWorkRaw.actualAreaTenths),
    actualTotalIncVatOre: numberValue(latestWorkRaw.actualTotalIncVatOre),
    beforePhotoCount: Array.isArray(latestWorkRaw.beforePhotos) ? latestWorkRaw.beforePhotos.length : 0,
    afterPhotoCount: Array.isArray(latestWorkRaw.afterPhotos) ? latestWorkRaw.afterPhotos.length : 0,
    completionNotes: stringValue(latestWorkRaw.completionNotes),
    completedAt: stringValue(latestWorkRaw.completedAt),
    documentationSubmittedAt: stringValue(latestWorkRaw.documentationSubmittedAt),
    completionReviewedAt: stringValue(latestWorkRaw.completionReviewedAt),
    workSummary: stringValue(latestWorkRaw.workSummary) || "",
  } : undefined;
  const invoice = latestInvoiceRaw ? {
    ...entity("invoice-records", latestInvoiceRaw),
    documentId: relationId(latestInvoiceRaw.document) || undefined,
    dueAt: stringValue(latestInvoiceRaw.dueAt),
    externalReference: stringValue(latestInvoiceRaw.externalReference),
    adminNote: stringValue(latestInvoiceRaw.adminNote),
    subtotalExVatOre: numberValue(latestInvoiceRaw.subtotalExVatOre),
    vatOre: numberValue(latestInvoiceRaw.vatOre),
    totalIncVatOre: numberValue(latestInvoiceRaw.totalIncVatOre),
  } : undefined;
  const warranty = latestWarrantyRaw ? {
    ...entity("warranties", latestWarrantyRaw),
    documentId: relationId(latestWarrantyRaw.document) || undefined,
    startsAt: stringValue(latestWarrantyRaw.startsAt),
    endsAt: stringValue(latestWarrantyRaw.endsAt),
    scope: stringValue(latestWarrantyRaw.scope),
    termsVersion: stringValue(latestWarrantyRaw.termsVersion),
  } : undefined;

  const mappedMessages: CaseMessage[] = visibleMessages.map((message) => ({
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
    aiRecommendedNextAction: lead.qualification && typeof lead.qualification === "object"
      ? stringValue((lead.qualification as Record<string, unknown>).recommendedNextAction)
      : undefined,
    canPreparePackage: Boolean(stringValue(lead.address) && !/^ikke oppgitt$/i.test(stringValue(lead.address) || ""))
      && stringValue(lead.inquiryType) !== "usikker",
    leadStatus: stringValue(lead.status),
    message: currentMessageRaw ? {
      id: numericId(currentMessageRaw.id),
      status: stringValue(currentMessageRaw.status),
      category: stringValue(currentMessageRaw.category),
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
      href: "#customer-section",
    };
  const timeline: CaseTimelineItem[] = [
    leadTimeline,
    ...visibleMessages.map((item) => makeTimeline("message", "messages", item, stringValue(item.subject) || "Melding")),
    ...measurements.map((item) => makeTimeline("measurement", "roof-measurements", item, stringValue(item.reference) || "Takmåling")),
    ...prices.map((item) => makeTimeline("price", "price-calculations", item, stringValue(item.reference) || "Prisberegning")),
    ...quotes.map((item) => makeTimeline("quote", "quotes", item, stringValue(item.reference) || "Tilbud")),
    ...contracts.map((item) => makeTimeline("contract", "contracts", item, stringValue(item.reference) || "Kontrakt")),
    ...contracts.flatMap((item) => [
      makeTimedEvent("contract", "contracts", item, "signedAt", "customer_signed"),
      makeTimedEvent("contract", "contracts", item, "companySignedAt", "fully_signed"),
    ].filter((event): event is CaseTimelineItem => Boolean(event))),
    ...workOrders.map((item) => makeTimeline("work", "work-orders", item, stringValue(item.reference) || "Arbeid")),
    ...changes.map((item) => makeTimeline("change", "change-agreements", item, stringValue(item.reference) || "Endringsavtale")),
    ...invoices.map((item) => makeTimeline("invoice", "invoice-records", item, stringValue(item.reference) || "Fakturautkast")),
    ...warranties.map((item) => makeTimeline("warranty", "warranties", item, stringValue(item.reference) || "Garanti")),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    lead: {
      id: leadId,
      name: stringValue(lead.name) || `#${leadId}`,
      email: stringValue(lead.email),
      phone: stringValue(lead.phone),
      address: [stringValue(lead.address), stringValue(lead.houseNumber), stringValue(lead.postal), stringValue(lead.city)].filter(Boolean).join(" "),
      archiveClassification: stringValue(lead.archiveClassification),
      archiveReason: stringValue(lead.archiveReason),
      archivedAt: stringValue(lead.archivedAt),
      postal: stringValue(lead.postal),
      inquiryType: stringValue(lead.inquiryType),
      message: stringValue(lead.message),
      qualification: qualificationForAdmin(lead.qualification),
      purgeAfter: stringValue(lead.purgeAfter),
      recordState: (stringValue(lead.recordState) || "active") as "active" | "archived" | "trashed",
      status: stringValue(lead.status),
      trashedAt: stringValue(lead.trashedAt),
      assignedTo: relationName(lead.assignedTo),
      nextAction: stringValue(lead.nextAction),
      nextActionAt: stringValue(lead.nextActionAt),
      nextActionOverdue: Boolean(stringValue(lead.nextActionAt) && new Date(stringValue(lead.nextActionAt) || 0).getTime() <= loadedAt),
      createdAt: stringValue(lead.createdAt),
    },
    measurement,
    price,
    quote,
    quoteOptions,
    contract,
    workOrder,
    invoice,
    warranty,
    changes: changes.map((item) => ({ ...entity("change-agreements", item), summary: stringValue(item.reasonDescription) })),
    messages: mappedMessages,
    documents: mediaResult.docs.map((raw) => {
      const item = asRecord(raw);
      const id = numericId(item.id);
      return {
        id,
        filename: stringValue(item.filename) || `#${id}`,
        classification: stringValue(item.classification),
        mimeType: stringValue(item.mimeType),
        href: `/api/admin/media/${id}`,
      };
    }),
    timeline,
    nextAction,
  };
}
