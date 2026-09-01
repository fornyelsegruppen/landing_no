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
    previewHref?: string;
    previewAction?: "review_measurement" | "document_preflight";
  }[];
  measurementReview?: {
    reference: string;
    state: "review_required" | "verified";
    areaSquareMeters: number;
    confidencePercent: number;
    planeCount: number;
    provenance: {
      evidenceId: string;
      source: string;
      capturedAt: string;
      modelVersion: string;
      checksum: string;
    };
    planes: readonly {
      id: string;
      areaSquareMeters: number;
      pitchDegrees: number;
      state: "verified" | "review";
    }[];
    reviewEdges: readonly {
      id: string;
      between: string;
      reason: string;
      varianceMeters: number;
    }[];
    primarySlopes: readonly {
      id: "S1" | "S2" | "S3" | "S4";
      areaSquareMeters: number;
      pitchDegrees: number;
      perimeterMeters: number;
    }[];
    photos: readonly {
      id: string;
      label: string;
      source: string;
      capturedAt: string;
    }[];
    deltaFromR3: {
      areaSquareMeters: number;
      confidencePoints: number;
      planeCount: number;
    };
    verificationGates: readonly {
      id: "source_identity" | "plane_sum" | "review_edges" | "approval";
      state: "verified" | "review_required" | "locked";
      detail: string;
    }[];
    nextAction: string;
    fallbackHref: string;
  };
  documentPreflight?: {
    packageReference: string;
    state: "blocked" | "ready";
    policyCode: "PS-SEND-007";
    recipient: {
      name: string;
      email: string;
    };
    artifacts: readonly {
      id: "measurement" | "price" | "quote" | "contract" | "recipient" | "pdf";
      state: "verified" | "review_required" | "locked";
      reference: string;
      revision: string;
      hash: string;
      summary: string;
    }[];
    sequence: readonly {
      id: "measurement_review" | "reload" | "verify_artifacts" | "owner_gate" | "send";
      state: "current" | "locked" | "ready";
    }[];
    blocker: string;
    nextAction: string;
    fallbackHref: string;
  };
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
