import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig } from "payload";
import { assertWorkOrderTransition, type WorkOrderStatus } from "@/lib/work-orders/workflow";
import { enqueueCompletionCommunication, syncWorkOrderCommunicationJobs } from "@/lib/work-orders/communications";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { workOrderPipelineUpdate } from "@/lib/leads/pipeline-state";
import { adminOnly, assignedWorkerOrAdmin, userIsAdmin } from "../access/roles";

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return null;
}

function relationCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export const protectWorkOrder: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req, context }) => {
  if (operation === "create") {
    const contractId = relationId(data.contract);
    if (!contractId) throw new Error("A signed contract is required");
    const contract = await req.payload.findByID({ collection: "contracts", id: contractId, depth: 0, overrideAccess: true, req });
    if (contract.status !== "signed") throw new Error("Only a signed contract can become a work order");
    const quoteId = relationId(contract.quote);
    if (!quoteId) throw new Error("The signed contract has no quote");
    const quote = await req.payload.findByID({ collection: "quotes", id: quoteId, depth: 0, overrideAccess: true, req });
    if (quote.status !== "accepted") throw new Error("The signed contract quote must be accepted");
    data.quote = quote.id;
    data.lead = relationId(quote.lead);
    data.contractDocumentHash = contract.documentHash;
    if (data.assignedWorker && data.scheduledAt) data.status = "scheduled";
    else if (data.assignedWorker) data.status = "assigned";
    else data.status = "unassigned";
  }

  const workerId = relationId(data.assignedWorker ?? originalDoc?.assignedWorker);
  if (workerId && (operation === "create" || "assignedWorker" in data)) {
    const worker = await req.payload.findByID({ collection: "users", id: workerId, depth: 0, overrideAccess: true, req });
    if (worker.role !== "worker" || worker.active !== true) throw new Error("Work orders may only be assigned to an active worker");
  }

  // Payload may provide a pre-create `originalDoc` containing defaults. It is
  // not a persisted work order and must not trigger update-only immutability
  // checks after this hook has derived the locked contract relationships.
  if (operation === "create" || !originalDoc) return data;
  const immutable = ["contract", "quote", "lead", "contractDocumentHash"];
  if (immutable.some((field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]))) {
    throw new Error("The signed contract relationship is immutable");
  }
  if (originalDoc.status === "documented" && Object.keys(data).some((key) => key !== "updatedAt")) {
    throw new Error("A documented work order is immutable");
  }

  if (context?.trustedWorkerAction !== true && ["unassigned", "assigned", "scheduled"].includes(originalDoc.status)) {
    const nextAssigned = "assignedWorker" in data ? data.assignedWorker : originalDoc.assignedWorker;
    const nextScheduled = "scheduledAt" in data ? data.scheduledAt : originalDoc.scheduledAt;
    if (nextAssigned && nextScheduled) data.status = "scheduled";
    else if (nextAssigned) data.status = "assigned";
    else if ("assignedWorker" in data) data.status = "unassigned";
  }
  if (data.status && data.status !== originalDoc.status) {
    assertWorkOrderTransition(originalDoc.status as WorkOrderStatus, data.status as WorkOrderStatus);
  }

  const nextStatus = data.status ?? originalDoc.status;
  if (["ready", "blocked", "in_progress", "completed", "documented"].includes(nextStatus)) {
    const merged = { ...originalDoc, ...data };
    if (relationCount(merged.beforePhotos) < 2) throw new Error("At least two before photos are required");
    if (!merged.roofType || !merged.actualAreaTenths || !merged.measurementMethod || !merged.slopeBasis || !merged.visibleCondition || !merged.safetyStatus) {
      throw new Error("The complete onsite precheck is required");
    }
    if (!merged.precheckDecision || !merged.priceOutcome || !merged.actualTotalIncVatOre) throw new Error("The deterministic precheck result is required");
    if (nextStatus === "in_progress" && merged.precheckDecision !== "ready") throw new Error("Blocked work cannot start");
  }
  if (nextStatus === "documented") {
    const merged = { ...originalDoc, ...data };
    if (relationCount(merged.afterPhotos) < 2 || !merged.completionNotes?.trim() || !merged.completedAt) {
      throw new Error("After photos, completion notes and completion time are required");
    }
    if (context?.trustedCompletionReview !== true || !merged.completionReviewedAt || !relationId(merged.completionReviewedBy)) {
      throw new Error("Administrator completion review is required before documentation is finalized");
    }
  }
  if (nextStatus === "completed" && relationCount(({ ...originalDoc, ...data }).afterPhotos) < 2) {
    throw new Error("At least two after photos are required before work is marked completed");
  }
  return data;
};

export const scheduleWorkOrderCommunications: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  const scheduleChanged = operation === "create" || doc.scheduledAt !== previousDoc?.scheduledAt || doc.status !== previousDoc?.status;
  if (!scheduleChanged) return doc;
  const correlationId = correlationIdFromHeaders(req.headers);
  const leadId = relationId(doc.lead);
  const pipelineUpdate = workOrderPipelineUpdate({
    now: new Date().toISOString(),
    scheduledAt: doc.scheduledAt,
    status: doc.status,
  });
  if (leadId && pipelineUpdate) {
    await req.payload.update({
      collection: "leads",
      id: leadId,
      overrideAccess: true,
      data: pipelineUpdate,
    });
  }
  await syncWorkOrderCommunicationJobs(req.payload, doc, correlationId);
  if (doc.status === "documented" && previousDoc?.status !== "documented") await enqueueCompletionCommunication(req.payload, doc, correlationId);
  return doc;
};

export const WorkOrders: CollectionConfig = {
  slug: "work-orders",
  labels: { singular: "Oppdrag", plural: "Arbeid" },
  admin: {
    group: "Arbeid",
    useAsTitle: "reference",
    defaultColumns: ["reference", "assignedWorker", "scheduledAt", "status", "precheckDecision", "updatedAt"],
    description: "Tildeling, kontrollmåling, HMS, prisbekreftelse og før-/etterdokumentasjon for signerte oppdrag.",
  },
  access: { admin: ({ req }) => userIsAdmin(req.user), create: adminOnly, delete: adminOnly, read: assignedWorkerOrAdmin, update: adminOnly },
  hooks: { beforeChange: [protectWorkOrder], afterChange: [scheduleWorkOrderCommunications] },
  fields: [
    { name: "reference", type: "text", label: "Referanse", required: true, unique: true, index: true },
    { name: "lead", type: "relationship", relationTo: "leads", label: "Henvendelse", required: true, index: true, admin: { readOnly: true } },
    { name: "quote", type: "relationship", relationTo: "quotes", label: "Tilbud", required: true, index: true, admin: { readOnly: true } },
    { name: "contract", type: "relationship", relationTo: "contracts", label: "Signert kontrakt", required: true, unique: true, index: true },
    { name: "contractDocumentHash", type: "text", required: true, index: true, admin: { readOnly: true } },
    { name: "assignedWorker", type: "relationship", relationTo: "users", label: "Tildelt ansatt", index: true, filterOptions: { and: [{ role: { equals: "worker" } }, { active: { equals: true } }] } },
    { name: "scheduledAt", type: "date", label: "Planlagt tidspunkt (norsk tid)", index: true, admin: { components: { Field: "/components/NorwayDateTimeField", Cell: "/components/NorwayDateTimeCell" } } },
    { name: "arrivalWindow", type: "text", label: "Avtalt ankomstvindu", maxLength: 120, admin: { description: "For eksempel 08:00–10:00. Vis nøyaktig avtalt tidsrom, ikke et løfte som ikke kan holdes." } },
    { name: "adminNote", type: "textarea", label: "Intern planleggingsmerknad", maxLength: 1000, admin: { description: "Kun internt. Ikke sendt til kunden." } },
    { name: "status", type: "select", label: "Status", required: true, defaultValue: "unassigned", index: true, options: [
      { label: "Ikke tildelt", value: "unassigned" }, { label: "Tildelt", value: "assigned" }, { label: "Planlagt", value: "scheduled" },
      { label: "På vei", value: "on_way" }, { label: "Ankommet", value: "arrived" }, { label: "Før-kontroll", value: "precheck" },
      { label: "Klar til start", value: "ready" }, { label: "Blokkert", value: "blocked" }, { label: "Startet", value: "in_progress" },
      { label: "Arbeid fullført", value: "completed" }, { label: "Dokumentasjon levert", value: "documented" }, { label: "Avbrutt", value: "cancelled" },
    ] },
    { name: "workSummary", type: "textarea", label: "Arbeidsbeskrivelse", required: true },
    { name: "beforePhotos", type: "relationship", relationTo: "private-media", hasMany: true, label: "Før-bilder", admin: { readOnly: true } },
    { name: "roofType", type: "select", label: "Taktype", options: ["betongstein", "teglstein", "metall", "skifer", "shingel", "annet"] },
    { name: "actualAreaTenths", type: "number", label: "Kontrollmålt areal (0,1 m²)", min: 1 },
    { name: "measurementMethod", type: "select", label: "Målemetode", options: ["laser", "målebånd", "tegning", "kart_kontrollert", "annet"] },
    { name: "slopeBasis", type: "text", label: "Vinkelgrunnlag" },
    { name: "visibleCondition", type: "textarea", label: "Synlig tilstand" },
    { name: "safetyStatus", type: "select", label: "HMS/adkomst", options: [{ label: "Trygt", value: "safe" }, { label: "Blokkert", value: "blocked" }] },
    { name: "safetyNotes", type: "textarea", label: "HMS-/adkomstkommentar" },
    { name: "scopeChanged", type: "checkbox", label: "Arbeidsomfanget er endret", defaultValue: false },
    { name: "scopeChangeDetails", type: "textarea", label: "Beskriv avvik i omfang" },
    { name: "precheckDecision", type: "select", label: "Systembeslutning", admin: { readOnly: true }, options: [{ label: "Klar", value: "ready" }, { label: "Blokkert", value: "blocked" }] },
    { name: "priceOutcome", type: "select", label: "Prisutfall", admin: { readOnly: true }, options: ["lower", "within_contract", "over_tolerance", "over_maximum", "scope_change", "hms_blocked"] },
    { name: "allowedAreaMaxTenths", type: "number", admin: { readOnly: true } },
    { name: "actualSubtotalExVatOre", type: "number", admin: { readOnly: true } },
    { name: "actualVatOre", type: "number", admin: { readOnly: true } },
    { name: "actualTotalIncVatOre", type: "number", admin: { readOnly: true } },
    { name: "blockingReasons", type: "json", admin: { readOnly: true } },
    { name: "approvedChangeAgreement", type: "relationship", relationTo: "change-agreements", label: "Godkjent endringsavtale", admin: { readOnly: true } },
    { name: "precheckCompletedAt", type: "date", admin: { readOnly: true } },
    { name: "startedAt", type: "date", admin: { readOnly: true } },
    { name: "afterPhotos", type: "relationship", relationTo: "private-media", hasMany: true, label: "Etterbilder", admin: { readOnly: true } },
    { name: "completionNotes", type: "textarea", label: "Ferdigmelding" },
    { name: "completedAt", type: "date", admin: { readOnly: true } },
    { name: "documentationSubmittedAt", type: "date", admin: { readOnly: true } },
    { name: "completionReviewedBy", type: "relationship", relationTo: "users", label: "Sluttkontrollert av", admin: { readOnly: true } },
    { name: "completionReviewedAt", type: "date", label: "Sluttkontrollert", admin: { readOnly: true } },
    { name: "completionReviewNote", type: "textarea", label: "Intern sluttkontroll", admin: { readOnly: true } },
    { name: "eventTimeline", type: "json", label: "Tidslinje", admin: { readOnly: true, description: "Systemstyrte hendelser uten kundeopplysninger." } },
    { name: "completionCommunicationAction", type: "ui", admin: { components: { Field: "/components/WorkOrderCompletionAction" } } },
    { name: "changeAgreementAction", type: "ui", admin: { components: { Field: "/components/WorkOrderChangeAction" } } },
  ],
};
