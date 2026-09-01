export const adminNextFieldVisitStates = [
  "assigned",
  "on_way",
  "onsite",
  "in_progress",
] as const;

export type AdminNextFieldVisitState =
  (typeof adminNextFieldVisitStates)[number];

export type AdminNextFieldVisitView = {
  reference: string;
  caseReference: string;
  customer: string;
  address: string;
  service: string;
  scheduledAt: string;
  arrivalWindow: string;
  worker: { name: string; initials: string };
  state: AdminNextFieldVisitState;
  stateChangedAt: string;
  etaMinutes: number | null;
  distanceKilometers: number;
  checklist: readonly {
    id: "address" | "scope" | "safety" | "equipment";
    state: "complete" | "current" | "locked";
  }[];
  evidence: readonly {
    id: "before" | "during" | "after";
    completed: number;
    required: number;
  }[];
  completionGates: readonly {
    id: "photos" | "checklist" | "notes" | "customer_handover";
    state: "verified" | "required" | "locked";
  }[];
  fallbackHref: string;
};

export function parseAdminNextFieldVisitState(
  value: unknown,
): AdminNextFieldVisitState {
  return adminNextFieldVisitStates.includes(value as AdminNextFieldVisitState)
    ? (value as AdminNextFieldVisitState)
    : "assigned";
}

export type AdminNextFieldVisitLoadResult =
  | { status: "ready"; source: "fixture" | "canonical"; value: AdminNextFieldVisitView }
  | { status: "not_found" };

export interface AdminNextFieldVisitAdapter {
  load(
    reference: string,
    state: AdminNextFieldVisitState,
  ): Promise<AdminNextFieldVisitLoadResult>;
}

export function loadAdminNextFieldVisit(
  adapter: AdminNextFieldVisitAdapter,
  reference: string,
  state: AdminNextFieldVisitState,
) {
  return adapter.load(reference.trim().toUpperCase(), state);
}
