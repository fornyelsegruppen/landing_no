export type AdminNextCaseStageId =
  "inquiry" | "evidence" | "commercial" | "agreement" | "work" | "completion";

export type AdminNextCaseStageState =
  "complete" | "current" | "blocked" | "upcoming";

export type AdminNextCaseStage = {
  id: AdminNextCaseStageId;
  state: AdminNextCaseStageState;
};

export type AdminNextEvidenceKind =
  "measurement" | "photo" | "document" | "communication";

export type AdminNextEvidenceState = "verified" | "review" | "missing";

export type AdminNextTimelineKind =
  "automation" | "measurement" | "message" | "assignment";

export type AdminNextCaseInteraction =
  | { mode: "executable"; activation: "open_workbench" }
  | { mode: "waiting"; waitingParty: "customer" | "system" | "worker" }
  | {
      mode: "read_only";
      reason:
        | "capability_denied"
        | "diagnostic_blocker"
        | "no_action"
        | "target_unavailable";
    };

export type AdminNextAuditTimelineDetails = {
  action: string;
  actor: {
    kind: AuditHistoryActorKind;
    display: string | null;
  };
  atUtc: string;
  changedFields: readonly string[];
  changedFieldsStatus: "absent" | "projected" | "rejected";
  result: AuditHistoryResult | null;
  reason: string | null;
  version: string | number | null;
  source: string | null;
  correlationId: string;
  integrity: {
    hashStatus: AuditHistoryHashStatus;
    tamperStatus: "not_assessable";
  };
};

export type AdminNextTimelineState =
  | { status: "ready"; source: "canonical" | "fixture" }
  | {
      status: "unavailable" | "denied";
      source: "canonical";
      reason: "audit_unavailable" | "audit_read_denied";
    };

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
    remainingMinutes: number | null;
    state: "overdue" | "due_soon" | "on_track" | "unknown";
  };
  nextAction: {
    kind: CaseNextActionKind;
    title: string;
    reason: string;
    label: string | null;
    href: string | null;
    processStage: CaseNextActionProcessStage;
    requiredCapability: CaseNextActionCapability;
    reviewMode: CaseNextActionReviewMode;
    interaction: AdminNextCaseInteraction;
    diagnosticBlocker?: {
      code: string;
      recovery: string;
    };
  };
  stages: readonly AdminNextCaseStage[];
  evidence: readonly {
    id: string;
    kind: AdminNextEvidenceKind;
    state: AdminNextEvidenceState;
    title: string;
    summary: string;
    metric?: string;
    recordedAt: string;
    fallbackHref: string | null;
    previewHref?: string;
    previewAction?: "review_measurement" | "document_preflight";
  }[];
  measurementReview?: {
    reference: string;
    state: "review_required" | "verified";
    areaSquareMeters: number;
    overallPitchDegrees?: number;
    perimeterMeters?: number;
    confidencePercent: number;
    planeCount: number;
    comparedToReference?: string;
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
      pitchDegrees?: number;
      state: "verified" | "review";
    }[];
    reviewEdges: readonly {
      id: string;
      between: string;
      reason: string;
      varianceMeters: number;
    }[];
    diagram?: {
      vertices: readonly {
        id: string;
        xMeters: number;
        yMeters: number;
      }[];
      surfaces: readonly {
        id: string;
        vertexIds: readonly string[];
      }[];
      edges: readonly {
        id: string;
        fromVertexId: string;
        toVertexId: string;
        state: "verified" | "review";
      }[];
    };
    primarySlopes: readonly {
      id: "S1" | "S2" | "S3" | "S4";
      areaSquareMeters: number;
      pitchDegrees?: number;
      perimeterMeters: number;
    }[];
    photos: readonly {
      id: string;
      label: string;
      source: string;
      capturedAt: string;
      previewHref?: string;
    }[];
    sources?: readonly {
      id: string;
      kind: string;
      label: string;
      attribution: string;
      capturedAt: string;
      licenseState: "authorized" | "restricted" | "denied" | "unknown";
      qualityState: "usable" | "limited" | "rejected" | "unknown";
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
      id:
        | "measurement_review"
        | "reload"
        | "verify_artifacts"
        | "owner_gate"
        | "send";
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
    audit?: AdminNextAuditTimelineDetails;
  }[];
  timelineState: AdminNextTimelineState;
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
import type { CaseNextActionKind } from "@/lib/admin-v2/case-read-model";
import type {
  CaseNextActionCapability,
  CaseNextActionProcessStage,
  CaseNextActionReviewMode,
} from "@/lib/admin-v2/case-next-action-presentation";
import type {
  AuditHistoryActorKind,
  AuditHistoryHashStatus,
  AuditHistoryResult,
} from "@/lib/audit/audit-history-projection";
