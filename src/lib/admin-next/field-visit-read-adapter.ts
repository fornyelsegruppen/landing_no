import type { Payload, Where } from "payload";
import type { UserRole } from "@/payload/access/roles";
import type {
  AdminNextFieldVisitAdapter,
  AdminNextFieldVisitState,
  AdminNextFieldVisitView,
} from "@/lib/admin-next/field-visit-contract";

type Viewer = { id: number; role: UserRole; displayName?: string | null };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function count(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}
function initials(name: string) {
  return name.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—";
}

export function projectWorkOrderState(status: unknown): AdminNextFieldVisitState {
  if (status === "on_way") return "on_way";
  if (["arrived", "precheck", "ready", "blocked"].includes(String(status))) return "onsite";
  if (["in_progress", "completed", "documented"].includes(String(status))) return "in_progress";
  return "assigned";
}

function progressFor(order: Record<string, unknown>) {
  const before = count(order.beforePhotos);
  const after = count(order.afterPhotos);
  const precheckComplete = Boolean(order.precheckCompletedAt) || ["ready", "in_progress", "completed", "documented"].includes(String(order.status));
  const started = Boolean(order.startedAt) || ["in_progress", "completed", "documented"].includes(String(order.status));
  return {
    checklist: [
      { id: "address" as const, state: "complete" as const },
      { id: "scope" as const, state: "complete" as const },
      { id: "safety" as const, state: precheckComplete ? "complete" as const : "current" as const },
      { id: "equipment" as const, state: precheckComplete ? "complete" as const : "locked" as const },
    ],
    evidence: [
      { id: "before" as const, completed: before, required: 2 },
      { id: "during" as const, completed: 0, required: 0 },
      { id: "after" as const, completed: after, required: 2 },
    ],
    completionGates: [
      { id: "photos" as const, state: before >= 2 && after >= 2 ? "verified" as const : started ? "required" as const : "locked" as const },
      { id: "checklist" as const, state: precheckComplete ? "verified" as const : "required" as const },
      { id: "notes" as const, state: order.completionNotes ? "verified" as const : started ? "required" as const : "locked" as const },
      { id: "customer_handover" as const, state: order.documentationSubmittedAt ? "verified" as const : "locked" as const },
    ],
  };
}

export function createAdminNextCanonicalFieldVisitAdapter(
  payload: Pick<Payload, "find">,
  viewer: Viewer,
): AdminNextFieldVisitAdapter {
  return {
    async load(reference) {
      const numericId = /^\d+$/u.test(reference) ? Number(reference) : null;
      const identity: Where = numericId
        ? { or: [{ id: { equals: numericId } }, { reference: { equals: reference } }] }
        : { reference: { equals: reference } };
      const where: Where = {
        and: [
          identity,
          ...(viewer.role === "admin" ? [] : [{ assignedWorker: { equals: viewer.id } }]),
        ],
      };
      const result = await payload.find({
        collection: "work-orders",
        depth: 2,
        limit: 1,
        overrideAccess: true,
        where,
      });
      const raw = result.docs[0];
      if (!raw) return { status: "not_found" };
      const order = record(raw);
      const lead = record(order.lead);
      const worker = record(order.assignedWorker);
      const workerName = text(worker.displayName, text(worker.name, viewer.displayName || "Medarbeider"));
      const state = projectWorkOrderState(order.status);
      const value: AdminNextFieldVisitView = {
        reference: text(order.reference, String(order.id)),
        caseReference: `TF-${String(lead.id ?? "—")}`,
        customer: text(lead.name, "—"),
        address: [text(lead.address), text(lead.houseNumber), text(lead.postal), text(lead.city)].filter(Boolean).join(" "),
        service: text(order.workSummary, "Takfornyelse"),
        scheduledAt: text(order.scheduledAt, "Ikke planlagt"),
        arrivalWindow: text(order.arrivalWindow, "—"),
        worker: { name: workerName, initials: initials(workerName) },
        state,
        stateChangedAt: text(order.updatedAt, text(order.createdAt, "—")),
        etaMinutes: state === "on_way" ? null : state === "onsite" || state === "in_progress" ? 0 : null,
        distanceKilometers: 0,
        fallbackHref: `/user/arbeid/${String(order.id)}`,
        ...progressFor(order),
      };
      return { status: "ready", source: "canonical", value };
    },
  };
}
