export type AdminNextCaseStageId =
  | "inquiry"
  | "measurement"
  | "offer"
  | "contract"
  | "work";

export type AdminNextCaseStageState =
  | "complete"
  | "current"
  | "blocked"
  | "upcoming";

export type AdminNextEvidenceKind =
  | "measurement"
  | "photo"
  | "document"
  | "communication";

export type AdminNextEvidenceState = "verified" | "review" | "missing";

export type AdminNextTimelineKind =
  | "automation"
  | "measurement"
  | "message"
  | "assignment";

export type AdminNextCaseWorkspaceView = {
  reference: string;
  customer: string;
  address: string;
  service: string;
  status: "attention" | "on_track" | "waiting";
  owner: {
    name: string;
    team: string;
  };
  sla: {
    deadline: string;
    remainingMinutes: number;
    state: "overdue" | "due_soon" | "on_track";
  };
  nextAction: {
    title: string;
    reason: string;
  };
  stages: readonly {
    id: AdminNextCaseStageId;
    state: AdminNextCaseStageState;
  }[];
  evidence: readonly {
    id: string;
    kind: AdminNextEvidenceKind;
    state: AdminNextEvidenceState;
    title: string;
    summary: string;
    metric?: string;
    recordedAt: string;
    fallbackHref: string;
  }[];
  timeline: readonly {
    id: string;
    kind: AdminNextTimelineKind;
    title: string;
    summary: string;
    at: string;
    actor: string;
  }[];
  fallback: {
    caseHref: string;
    documentsHref: string;
    workHref: string;
  };
};

export type AdminNextCaseWorkspaceLoadResult =
  | {
      status: "ready";
      source: "fixture" | "canonical";
      value: AdminNextCaseWorkspaceView;
    }
  | { status: "not_found" };

export interface AdminNextCaseWorkspaceAdapter {
  load(reference: string): Promise<AdminNextCaseWorkspaceLoadResult>;
}

export function loadAdminNextCaseWorkspace(
  adapter: AdminNextCaseWorkspaceAdapter,
  reference: string,
) {
  return adapter.load(reference.trim().toUpperCase());
}

