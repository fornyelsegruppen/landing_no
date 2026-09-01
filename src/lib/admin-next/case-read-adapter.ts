import type { Payload } from "payload";
import {
  loadAdminCaseWorkspace,
  type AdminCaseWorkspace,
  type CaseNextActionKind,
} from "@/lib/admin-v2/case-read-model";
import type {
  AdminNextCaseStageId,
  AdminNextCaseStageState,
  AdminNextCaseWorkspaceAdapter,
  AdminNextCaseWorkspaceView,
  AdminNextTimelineKind,
} from "@/lib/admin-next/case-workspace-contract";

const actionTitles: Record<CaseNextActionKind, string> = {
  approve_measurement: "Godkjenn takmålingen",
  approve_package: "Godkjenn dokumentpakken",
  approve_message: "Godkjenn meldingen",
  approve_quote: "Godkjenn tilbudet",
  assign_worker: "Tildel medarbeider",
  calculate_price: "Beregn pris",
  company_sign_contract: "Signer kontrakten",
  create_quote: "Opprett tilbud",
  create_work_order: "Opprett arbeidsordre",
  follow_up_decline: "Følg opp avslaget",
  generate_reply: "Opprett svarutkast",
  issue_quote: "Send tilbudet",
  measurement_required: "Bestill takmåling",
  none: "Ingen handling kreves",
  prepare_package: "Forbered dokumentpakken",
  prepare_question_reply: "Svar på kundespørsmålet",
  retry_message: "Prøv meldingen på nytt",
  review_cancellation: "Kontroller avbestillingen",
  review_completion: "Kontroller ferdigdokumentasjon",
  resolve_work_block: "Løs blokkeringen",
  schedule_work: "Planlegg arbeidet",
  send_closure_confirmation: "Send sluttbekreftelse",
  wait_customer: "Venter på kunden",
  wait_scheduled_start: "Venter på planlagt oppstart",
  wait_worker_documentation: "Venter på dokumentasjon",
  wait_worker_precheck: "Venter på medarbeiderkontroll",
  wait_work_completion: "Venter på ferdig arbeid",
};

function stages(value: AdminCaseWorkspace) {
  const completeThrough = value.workOrder
    ? 4
    : value.contract
      ? 3
      : value.quote
        ? 2
        : value.measurement
          ? 1
          : 0;
  const ids: AdminNextCaseStageId[] = [
    "inquiry",
    "measurement",
    "offer",
    "contract",
    "work",
  ];
  return ids.map((id, index) => ({
    id,
    state: (index < completeThrough
      ? "complete"
      : index === completeThrough
        ? "current"
        : "upcoming") as AdminNextCaseStageState,
  }));
}

function timelineKind(type: AdminCaseWorkspace["timeline"][number]["type"]): AdminNextTimelineKind {
  if (type === "measurement") return "measurement";
  if (type === "message") return "message";
  if (type === "work") return "assignment";
  return "automation";
}

export function projectAdminCaseWorkspace(
  value: AdminCaseWorkspace,
  now = new Date(),
): AdminNextCaseWorkspaceView {
  const deadline = value.lead.nextActionAt;
  const remainingMinutes = deadline
    ? Math.round((new Date(deadline).getTime() - now.getTime()) / 60_000)
    : 24 * 60;
  const caseHref = `/admin-v2/cases/${value.lead.id}`;
  const measurementEvidence = value.measurement
    ? [{
        id: `measurement-${value.measurement.id}`,
        kind: "measurement" as const,
        state: value.measurement.status === "approved" ? "verified" as const : "review" as const,
        title: value.measurement.reference,
        summary: value.measurement.summary || value.measurement.confidenceReasoning || "Takmåling",
        metric: value.measurement.actualAreaMaxTenths
          ? `${(value.measurement.actualAreaMaxTenths / 10).toFixed(1)} m²`
          : undefined,
        recordedAt: value.measurement.updatedAt || value.measurement.createdAt || "—",
        fallbackHref: value.measurement.href,
      }]
    : [];
  const documentEvidence = value.documents.slice(0, 4).map((document) => ({
    id: `document-${document.id}`,
    kind: "document" as const,
    state: "verified" as const,
    title: document.filename,
    summary: document.classification || document.mimeType || "Dokument",
    recordedAt: document.createdAt || "—",
    fallbackHref: document.href,
  }));

  return {
    reference: `TF-${value.lead.id}`,
    customer: value.lead.name,
    address: [value.lead.streetAddress || value.lead.address, value.lead.postal, value.lead.city]
      .filter(Boolean)
      .join(", "),
    service: value.quote?.serviceDescription || value.lead.inquiryType || "Takfornyelse",
    status: value.lead.nextActionOverdue
      ? "attention"
      : value.nextAction.kind === "wait_customer"
        ? "waiting"
        : "on_track",
    owner: {
      name: value.lead.assignedTo || value.lead.nextActionOwner || "Ikke tildelt",
      team: "Takfornyelse",
    },
    sla: {
      deadline: deadline || "—",
      remainingMinutes,
      state: remainingMinutes < 0 ? "overdue" : remainingMinutes <= 120 ? "due_soon" : "on_track",
    },
    nextAction: {
      title: actionTitles[value.nextAction.kind],
      reason: value.lead.nextActionBlocker || value.lead.nextAction || "Canonical case state",
    },
    stages: stages(value),
    evidence: [...measurementEvidence, ...documentEvidence],
    timeline: value.timeline.slice(0, 12).map((item) => ({
      id: item.id,
      kind: timelineKind(item.type),
      title: item.title,
      summary: item.status || item.sourceCollection || "Case event",
      at: item.at,
      actor: "Takfornyelse CRM",
    })),
    fallback: {
      caseHref,
      documentsHref: "/admin-v2/documents",
      workHref: "/admin-v2/work",
    },
  };
}

export function createAdminNextCanonicalCaseWorkspaceAdapter(
  payload: Payload,
  now: () => Date = () => new Date(),
): AdminNextCaseWorkspaceAdapter {
  return {
    async load(reference) {
      const match = reference.match(/^(?:TF-)?(\d+)$/u);
      if (!match) return { status: "not_found" };
      const value = await loadAdminCaseWorkspace(payload, Number(match[1]));
      if (!value) return { status: "not_found" };
      return {
        status: "ready",
        source: "canonical",
        value: projectAdminCaseWorkspace(value, now()),
      };
    },
  };
}
