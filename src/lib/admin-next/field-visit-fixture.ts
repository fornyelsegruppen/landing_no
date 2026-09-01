import type {
  AdminNextFieldVisitAdapter,
  AdminNextFieldVisitState,
  AdminNextFieldVisitView,
} from "@/lib/admin-next/field-visit-contract";

const stateData: Record<
  AdminNextFieldVisitState,
  Pick<
    AdminNextFieldVisitView,
    | "stateChangedAt"
    | "etaMinutes"
    | "checklist"
    | "evidence"
    | "completionGates"
  >
> = {
  assigned: {
    stateChangedAt: "07:42",
    etaMinutes: null,
    checklist: [
      { id: "address", state: "complete" },
      { id: "scope", state: "complete" },
      { id: "safety", state: "current" },
      { id: "equipment", state: "locked" },
    ],
    evidence: [
      { id: "before", completed: 0, required: 4 },
      { id: "during", completed: 0, required: 3 },
      { id: "after", completed: 0, required: 4 },
    ],
    completionGates: [
      { id: "photos", state: "locked" },
      { id: "checklist", state: "required" },
      { id: "notes", state: "locked" },
      { id: "customer_handover", state: "locked" },
    ],
  },
  on_way: {
    stateChangedAt: "08:06",
    etaMinutes: 18,
    checklist: [
      { id: "address", state: "complete" },
      { id: "scope", state: "complete" },
      { id: "safety", state: "complete" },
      { id: "equipment", state: "complete" },
    ],
    evidence: [
      { id: "before", completed: 0, required: 4 },
      { id: "during", completed: 0, required: 3 },
      { id: "after", completed: 0, required: 4 },
    ],
    completionGates: [
      { id: "photos", state: "locked" },
      { id: "checklist", state: "verified" },
      { id: "notes", state: "locked" },
      { id: "customer_handover", state: "locked" },
    ],
  },
  onsite: {
    stateChangedAt: "08:24",
    etaMinutes: 0,
    checklist: [
      { id: "address", state: "complete" },
      { id: "scope", state: "complete" },
      { id: "safety", state: "current" },
      { id: "equipment", state: "locked" },
    ],
    evidence: [
      { id: "before", completed: 2, required: 4 },
      { id: "during", completed: 0, required: 3 },
      { id: "after", completed: 0, required: 4 },
    ],
    completionGates: [
      { id: "photos", state: "required" },
      { id: "checklist", state: "required" },
      { id: "notes", state: "locked" },
      { id: "customer_handover", state: "locked" },
    ],
  },
  in_progress: {
    stateChangedAt: "08:41",
    etaMinutes: 0,
    checklist: [
      { id: "address", state: "complete" },
      { id: "scope", state: "complete" },
      { id: "safety", state: "complete" },
      { id: "equipment", state: "complete" },
    ],
    evidence: [
      { id: "before", completed: 4, required: 4 },
      { id: "during", completed: 2, required: 3 },
      { id: "after", completed: 0, required: 4 },
    ],
    completionGates: [
      { id: "photos", state: "required" },
      { id: "checklist", state: "verified" },
      { id: "notes", state: "required" },
      { id: "customer_handover", state: "locked" },
    ],
  },
};

export function buildAdminNextFieldVisitFixture(
  state: AdminNextFieldVisitState,
): AdminNextFieldVisitView {
  return {
    reference: "WV-2048",
    caseReference: "TF-1027",
    customer: "Demo · Ola Berg",
    address: "Mønsterveien 5, 1383 Asker",
    service: "Takfornyelse · hovedtak",
    scheduledAt: "I dag · 09:00",
    arrivalWindow: "08:45–09:15",
    worker: { name: "Marius Hansen", initials: "MH" },
    state,
    distanceKilometers: 12.4,
    fallbackHref: "/user/arbeid/2048",
    ...stateData[state],
  };
}

export const adminNextFixtureFieldVisitAdapter: AdminNextFieldVisitAdapter = {
  async load(reference, state) {
    if (reference !== "WV-2048") return { status: "not_found" };
    return {
      status: "ready",
      source: "fixture",
      value: buildAdminNextFieldVisitFixture(state),
    };
  },
};
