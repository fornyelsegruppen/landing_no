import type { Payload, PayloadRequest, Where } from "payload";
import {
  adaptCanonicalCaseAuditHistory,
  type CaseAuditHistoryReadResult,
} from "@/lib/audit/case-audit-history-read-adapter";
import {
  loadAdminCaseWorkspace,
  type AdminCaseWorkspace,
} from "@/lib/admin-v2/case-read-model";
import {
  getCaseNextActionPresentation,
  type CaseNextActionCapability,
  type CaseNextActionLocale,
  type LocalizedCaseNextActionPresentation,
} from "@/lib/admin-v2/case-next-action-presentation";
import type {
  AdminNextCaseCommunicationPage,
  AdminNextCaseStageId,
  AdminNextCaseStageState,
  AdminNextCaseWorkspaceAdapter,
  AdminNextCaseWorkspaceView,
  AdminNextTimelineKind,
} from "@/lib/admin-next/case-workspace-contract";
import { loadAdminNextCaseCommunicationPage } from "@/lib/admin-next/case-communication-read";
import { adminNextRoleHasReadCapability } from "@/lib/admin-next/capability-registry";
import {
  projectAdminNextRfCaseEntry,
  unavailableAdminNextRfCaseEntry,
  type AdminNextRfCaseEntryProjection,
} from "@/lib/admin-next/rf-case-entry-projection";
import { projectStoredNextActionBlocker } from "@/lib/admin-next/stored-next-action-blocker";
import {
  customerQuestionDocumentReferences,
  customerQuestionReplyStage,
} from "@/lib/messages/customer-question-state";
import {
  roofFusionCaseIdForLeadV1,
  type AdminRoofFusionPreviewReadAdapterV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";
import type { UserRole } from "@/payload/access/roles";

const auditCorrelationPattern = /^[a-zA-Z0-9._:-]{1,160}$/u;
const auditSeedSelect = {
  entityType: true,
  entityId: true,
  correlationId: true,
} as const;
const auditTimelineSelect = {
  actor: true,
  action: true,
  entityType: true,
  entityId: true,
  correlationId: true,
  changedFields: true,
  beforeHash: true,
  afterHash: true,
  metadata: true,
  createdAt: true,
} as const;
const auditActorPopulate = {
  users: { displayName: true },
} as const;
const auditReadLimit = 200;
const operatorHrefPattern = /^\/(?:admin-v2|admin-next-preview)(?:[/?]|$)/u;
const artifactHrefPattern =
  /^\/api\/admin\/(?:media|quotes|change-agreements)\//u;

const diagnosticBlockerRecovery = {
  nb: "Åpne saken i dagens arbeidsflate og avklar blokkeringen før videre arbeid.",
  lt: "Atverkite bylą dabartinėje darbo vietoje ir išspręskite blokavimą prieš tęsdami.",
  en: "Open the case in the current workspace and resolve the blocker before continuing.",
} as const satisfies Record<CaseNextActionLocale, string>;

function operatorHref(value?: string | null) {
  return value && operatorHrefPattern.test(value) ? value : null;
}

function artifactHref(value?: string | null) {
  return value && artifactHrefPattern.test(value) ? value : null;
}

function caseRecordHref(caseHref: string, value?: string | null) {
  if (value?.startsWith("#")) return `${caseHref}${value}`;
  return operatorHref(value);
}

function newestFirst(left: { at: string }, right: { at: string }) {
  const leftTime = Date.parse(left.at);
  const rightTime = Date.parse(right.at);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
  return rightTime - leftTime;
}

type AuditPayloadPage = {
  docs: readonly unknown[];
  hasNextPage?: boolean | null;
  totalDocs?: number;
  totalPages?: number;
};

/**
 * Audit correlation filtering is only safe over a complete result set. A
 * truncated seed can omit correlation IDs, while a truncated expansion can
 * omit a conflicting case anchor. Missing pagination metadata is tolerated for
 * test/read adapters, but any explicit indication of another page fails closed.
 */
function isCompleteAuditPayloadPage(page: AuditPayloadPage) {
  if (page.hasNextPage === true) return false;
  if (
    typeof page.totalDocs === "number" &&
    Number.isFinite(page.totalDocs) &&
    page.totalDocs > page.docs.length
  ) {
    return false;
  }
  if (
    typeof page.totalPages === "number" &&
    Number.isFinite(page.totalPages) &&
    page.totalPages > 1
  ) {
    return false;
  }
  return true;
}

export type AdminNextCaseAuditHistoryResult =
  | CaseAuditHistoryReadResult
  | {
      status: "denied";
      source: "canonical";
      reason: "audit_read_denied";
    };

export type AdminNextCaseRfReviewRead = {
  reader: Pick<AdminRoofFusionPreviewReadAdapterV1, "readLatestSnapshot">;
  user: PayloadRequest["user"];
};

/**
 * Projects RF discoverability only from canonical Case state and the latest
 * snapshot returned by the authorization-aware Preview reader. No projection
 * may invent a create route or turn blocked/mismatched state into a CTA.
 */
export async function loadAdminNextCaseRfEntry(
  value: AdminCaseWorkspace,
  read: AdminNextCaseRfReviewRead | undefined,
): Promise<AdminNextRfCaseEntryProjection> {
  const measurement = value.measurement;
  const mayCreate = !measurement && value.nextAction.kind === "prepare_package";
  const mayOpen = Boolean(
    measurement &&
    ["approve_measurement", "measurement_required"].includes(
      value.nextAction.kind,
    ) &&
    value.nextAction.targetId === measurement.id,
  );
  if (!mayCreate && !mayOpen) {
    return projectAdminNextRfCaseEntry(value, null);
  }
  if (!read) return unavailableAdminNextRfCaseEntry();

  try {
    const roofFusionCaseId = roofFusionCaseIdForLeadV1(value.lead.id);
    const raw = await read.reader.readLatestSnapshot(
      roofFusionCaseId,
      read.user,
    );
    return projectAdminNextRfCaseEntry(value, raw);
  } catch {
    return unavailableAdminNextRfCaseEntry();
  }
}

/** @deprecated Prefer the stateful RF entry projection above. */
export async function loadAdminNextCaseRfReviewHref(
  value: AdminCaseWorkspace,
  read: AdminNextCaseRfReviewRead | undefined,
) {
  return (await loadAdminNextCaseRfEntry(value, read)).href;
}

type TimelineSourceCollection = NonNullable<
  AdminCaseWorkspace["timeline"][number]["sourceCollection"]
>;

const auditEntityTypeByCollection: Record<TimelineSourceCollection, string> = {
  "change-agreements": "change-agreement",
  contracts: "contract",
  "customer-contract-requests": "customer_contract_request",
  "invoice-records": "invoice-record",
  leads: "lead",
  messages: "message",
  "official-invoices": "official-invoice",
  "price-calculations": "price-calculation",
  "private-media": "private-media",
  quotes: "quote",
  "roof-measurements": "roof-measurement",
  warranties: "warranty",
  "work-orders": "work-order",
};

function auditEntityScope(value: AdminCaseWorkspace) {
  const entities = new Map<string, { entityType: string; entityId: string }>();
  const add = (entityType: string, entityId: string | number) => {
    const normalizedId = String(entityId);
    entities.set(`${entityType}:${normalizedId}`, {
      entityType,
      entityId: normalizedId,
    });
  };
  add("lead", value.lead.id);
  add("case", `lead-${value.lead.id}`);
  for (const item of value.timeline) {
    if (!item.sourceCollection || !item.sourceId) continue;
    add(auditEntityTypeByCollection[item.sourceCollection], item.sourceId);
  }
  return [...entities.values()];
}

/**
 * Reads only audit events anchored to entities already loaded for this case,
 * then expands their exact correlations. The privacy-safe adapter performs the
 * final cross-case filter and projection.
 */
export async function loadAdminNextCaseAuditHistory(
  payload: Pick<Payload, "find">,
  value: AdminCaseWorkspace,
  viewerRole: UserRole,
): Promise<AdminNextCaseAuditHistoryResult> {
  if (!adminNextRoleHasReadCapability(viewerRole, "audit.read")) {
    return {
      status: "denied",
      source: "canonical",
      reason: "audit_read_denied",
    };
  }

  try {
    const entityScope = auditEntityScope(value);
    const entityClauses: Where[] = entityScope.map(
      ({ entityType, entityId }): Where => ({
        and: [
          { entityType: { equals: entityType } },
          { entityId: { equals: entityId } },
        ],
      }),
    );
    const entityWhere: Where = {
      or: entityClauses,
    };
    const seed = await payload.find({
      collection: "audit-events",
      depth: 0,
      limit: auditReadLimit,
      overrideAccess: true,
      select: auditSeedSelect,
      sort: "-createdAt",
      where: entityWhere,
    });
    if (!isCompleteAuditPayloadPage(seed)) {
      return {
        status: "unavailable",
        source: "canonical",
        reason: "canonical_audit_unavailable",
      };
    }
    const correlationIds = [
      ...new Set(
        seed.docs.flatMap((event) =>
          typeof event.correlationId === "string" &&
          auditCorrelationPattern.test(event.correlationId)
            ? [event.correlationId]
            : [],
        ),
      ),
    ];
    if (correlationIds.length === 0) {
      return adaptCanonicalCaseAuditHistory(
        { docs: [] },
        { leadId: value.lead.id },
      );
    }
    const correlated = await payload.find({
      collection: "audit-events",
      depth: 1,
      limit: auditReadLimit,
      overrideAccess: true,
      populate: auditActorPopulate,
      select: auditTimelineSelect,
      sort: "-createdAt",
      where: { correlationId: { in: correlationIds } },
    });
    if (!isCompleteAuditPayloadPage(correlated)) {
      return {
        status: "unavailable",
        source: "canonical",
        reason: "canonical_audit_unavailable",
      };
    }
    return adaptCanonicalCaseAuditHistory(correlated, {
      leadId: value.lead.id,
      correlationIds,
    });
  } catch {
    return {
      status: "unavailable",
      source: "canonical",
      reason: "canonical_audit_unavailable",
    };
  }
}

export function projectAdminNextCaseStages(value: AdminCaseWorkspace) {
  const ids: AdminNextCaseStageId[] = [
    "inquiry",
    "evidence",
    "commercial",
    "agreement",
    "work",
    "completion",
  ];
  const terminal =
    value.nextAction.kind === "none" &&
    (value.lead?.status === "closed" ||
      Boolean(value.workOrder?.completionReviewedAt));
  if (terminal) {
    return ids.map((id) => ({ id, state: "complete" as const }));
  }
  const achievedStageIndex = value.workOrder
    ? value.workOrder.completedAt ||
      value.workOrder.documentationSubmittedAt ||
      value.nextAction.kind === "review_completion"
      ? 5
      : 4
    : value.contract
      ? 3
      : value.quote || value.price
        ? 2
        : value.measurement
          ? 1
          : 0;
  const presentation = getCaseNextActionPresentation(
    value.nextAction.kind,
    "en",
  );
  const actionStageIndex = ids.indexOf(presentation.processStage);
  const currentStageIndex = Math.max(achievedStageIndex, actionStageIndex);
  const storedBlocker = projectStoredNextActionBlocker({
    actionKind: value.nextAction.kind,
    actionTargetId: value.nextAction.targetId,
    storedBlocker: value.lead?.nextActionBlocker,
  });
  const blocked =
    presentation.caseStateHint === "blocked" ||
    storedBlocker.status === "diagnostic";
  return ids.map((id, index) => ({
    id,
    state: (index < currentStageIndex
      ? "complete"
      : index === currentStageIndex
        ? blocked
          ? "blocked"
          : "current"
        : "upcoming") as AdminNextCaseStageState,
  }));
}

function auditTimelineKind(entityType: string): AdminNextTimelineKind {
  if (entityType === "roof-measurement") return "measurement";
  if (entityType === "message") return "message";
  if (entityType === "work-order") return "assignment";
  return "automation";
}

function projectAuditTimeline(result: AdminNextCaseAuditHistoryResult) {
  if (result.status === "denied") {
    return {
      timeline: [],
      timelineState: {
        status: "denied",
        source: "canonical",
        reason: "audit_read_denied",
      } as const,
    };
  }
  if (result.status === "unavailable") {
    return {
      timeline: [],
      timelineState: {
        status: "unavailable",
        source: "canonical",
        reason: "audit_unavailable",
      } as const,
    };
  }
  return {
    timeline: result.value.items.slice(0, 50).map((item) => ({
      id: `audit-${item.id}`,
      kind: auditTimelineKind(item.entity.type),
      title: item.action,
      summary: "",
      at: item.atUtc,
      actor: item.actor.display || item.actor.kind,
      audit: {
        action: item.action,
        actor: {
          kind: item.actor.kind,
          display: item.actor.display,
        },
        atUtc: item.atUtc,
        changedFields: item.changedFields,
        changedFieldsStatus: item.changedFieldsStatus,
        result: item.result,
        reason: item.reason,
        version: item.version,
        source: item.source,
        correlationId: item.correlationId,
        integrity: {
          hashStatus: item.integrity.hashStatus,
          tamperStatus: item.integrity.tamperStatus,
        },
      },
    })),
    timelineState: { status: "ready", source: "canonical" } as const,
  };
}

export function projectAdminCaseWorkspace(
  value: AdminCaseWorkspace,
  now = new Date(),
  locale: CaseNextActionLocale = "nb",
  auditHistory: AdminNextCaseAuditHistoryResult = {
    status: "unavailable",
    source: "canonical",
    reason: "canonical_audit_unavailable",
  },
  options: {
    communicationPage?: AdminNextCaseCommunicationPage;
    grantedCapabilities?: readonly CaseNextActionCapability[];
    rfEntry?: AdminNextRfCaseEntryProjection;
    rfReviewHref?: string | null;
  } = {},
): AdminNextCaseWorkspaceView {
  const deadline = value.lead.nextActionAt;
  const remainingMinutes = deadline
    ? Math.round((new Date(deadline).getTime() - now.getTime()) / 60_000)
    : null;
  const caseHref = `/admin-v2/cases/${value.lead.id}`;
  const presentation = getCaseNextActionPresentation(
    value.nextAction.kind,
    locale,
  );
  const storedBlocker = projectStoredNextActionBlocker({
    actionKind: value.nextAction.kind,
    actionTargetId: value.nextAction.targetId,
    storedBlocker: value.lead.nextActionBlocker,
  });
  const diagnosticBlocker =
    storedBlocker.status === "diagnostic"
      ? {
          code: storedBlocker.code,
          recovery: diagnosticBlockerRecovery[locale],
        }
      : undefined;
  const rfCandidateAction = [
    "approve_measurement",
    "measurement_required",
  ].includes(value.nextAction.kind);
  const rfReviewHref =
    value.nextAction.kind === "approve_measurement"
      ? options.rfEntry?.href || options.rfReviewHref || null
      : null;
  const actionHref = diagnosticBlocker
    ? null
    : options.rfEntry && rfCandidateAction
      ? options.rfEntry.href
      : rfReviewHref || resolveCaseActionHref(value, presentation, caseHref);
  const capabilityGranted = Boolean(
    options.grantedCapabilities?.includes(presentation.requiredCapability),
  );
  const interaction = diagnosticBlocker
    ? ({ mode: "read_only", reason: "diagnostic_blocker" } as const)
    : presentation.reviewMode === "waiting"
      ? ({
          mode: "waiting",
          waitingParty: presentation.owner.party as
            "customer" | "system" | "worker",
        } as const)
      : presentation.reviewMode === "none"
        ? ({ mode: "read_only", reason: "no_action" } as const)
        : !actionHref
          ? ({ mode: "read_only", reason: "target_unavailable" } as const)
          : !capabilityGranted
            ? ({ mode: "read_only", reason: "capability_denied" } as const)
            : ({ mode: "executable", activation: "open_workbench" } as const);
  const measurementEvidence = value.measurement
    ? [
        {
          id: `measurement-${value.measurement.id}`,
          kind: "measurement" as const,
          state:
            value.measurement.status === "approved"
              ? ("verified" as const)
              : ("review" as const),
          title: value.measurement.reference,
          summary:
            value.measurement.summary ||
            value.measurement.confidenceReasoning ||
            "Takmåling",
          metric: value.measurement.actualAreaMaxTenths
            ? `${(value.measurement.actualAreaMaxTenths / 10).toFixed(1)} m²`
            : undefined,
          recordedAt:
            value.measurement.updatedAt || value.measurement.createdAt || "—",
          fallbackHref: operatorHref(value.measurement.href),
          ...(rfReviewHref
            ? {
                previewHref: rfReviewHref,
                previewAction: "review_measurement" as const,
              }
            : {}),
        },
      ]
    : [];
  const documentEvidence = value.documents.slice(0, 4).map((document) => ({
    id: `document-${document.id}`,
    kind: "document" as const,
    state: "verified" as const,
    title: document.filename,
    summary: document.classification || document.mimeType || "Dokument",
    recordedAt: document.createdAt || "—",
    fallbackHref: operatorHref(document.href),
  }));
  const auditTimeline = projectAuditTimeline(auditHistory);
  const messages = value.messages || [];
  const commercial = value.commercial || {
    quoteVersions: [],
    contractVersions: [],
  };
  const customerQuestionContext = value.customerQuestionContext || {
    threads: [],
    unresolved: null,
  };
  const activeQuestionThread = customerQuestionContext.unresolved;
  const activeQuestion = activeQuestionThread?.question;
  const activeReply = activeQuestionThread?.reply;
  const projectedCommunications = messages
    .map((message) => ({
      id: `message-${message.id}`,
      direction:
        message.direction === "inbound"
          ? ("inbound" as const)
          : ("outbound" as const),
      channel: message.channel || "—",
      category: message.category || "—",
      status: message.status || "—",
      subject: message.subject || message.reference,
      bodyText: message.bodyText,
      at:
        message.deliveredAt ||
        message.sentAt ||
        message.updatedAt ||
        message.createdAt ||
        "—",
      ...(message.sentAt ? { sentAt: message.sentAt } : {}),
      ...(message.deliveredAt ? { deliveredAt: message.deliveredAt } : {}),
      ...(message.replyToMessageId
        ? { replyToMessageId: message.replyToMessageId }
        : {}),
      attachments: (message.attachmentIds || []).map((attachmentId) => {
        const document = value.documents.find(
          (candidate) => candidate.id === attachmentId,
        );
        return {
          id: `document-${attachmentId}`,
          filename: document?.filename || `#${attachmentId}`,
          href:
            artifactHref(document?.href) || `/api/admin/media/${attachmentId}`,
        };
      }),
      fallbackHref: `${caseHref}#message-${message.id}`,
    }))
    .sort(newestFirst);
  const communications =
    options.communicationPage?.items || projectedCommunications;
  const commercialVersions = [
    ...(commercial.quoteVersions || []),
    ...(commercial.contractVersions || []),
  ]
    .map((item) => ({
      id: `${item.kind}-${item.id}`,
      kind: item.kind,
      reference: item.reference,
      version: item.version,
      status: item.status,
      role: item.role,
      ...(item.supersedesReference
        ? { supersedesReference: item.supersedesReference }
        : {}),
      createdAt: item.createdAt || "—",
      ...(item.signedAt ? { signedAt: item.signedAt } : {}),
      ...(item.companySignedAt
        ? { companySignedAt: item.companySignedAt }
        : {}),
      ...(item.documentHash ? { documentHash: item.documentHash } : {}),
      pdfHref: artifactHref(item.pdfHref),
      fallbackHref: caseHref,
    }))
    .sort((left, right) =>
      newestFirst({ at: left.createdAt }, { at: right.createdAt }),
    );
  const customerDocuments = value.documents.map((document) => ({
    id: `document-${document.id}`,
    filename: document.filename,
    classification: document.classification || "—",
    mimeType: document.mimeType || "—",
    createdAt: document.createdAt || "—",
    ...(document.ownerType ? { ownerType: document.ownerType } : {}),
    ...(document.ownerId ? { ownerId: document.ownerId } : {}),
    href: artifactHref(document.href) || caseHref,
  }));
  const businessHistory = (value.timeline || []).map((item) => ({
    id: item.id,
    kind: item.type,
    title: item.title,
    status: item.status || "—",
    at: item.at,
    href: caseRecordHref(caseHref, item.href) || caseHref,
  }));

  return {
    reference: `TF-${value.lead.id}`,
    customer: value.lead.name,
    address: [
      value.lead.streetAddress || value.lead.address,
      value.lead.postal,
      value.lead.city,
    ]
      .filter(Boolean)
      .join(", "),
    service:
      value.quote?.serviceDescription ||
      value.lead.inquiryType ||
      "Takfornyelse",
    status:
      diagnosticBlocker ||
      presentation.caseStateHint === "blocked" ||
      value.lead.nextActionOverdue
        ? "attention"
        : presentation.reviewMode === "waiting"
          ? "waiting"
          : "on_track",
    owner: {
      name:
        value.lead.assignedTo || value.lead.nextActionOwner || "Ikke tildelt",
      team: "Takfornyelse",
    },
    sla: {
      deadline: deadline || "—",
      remainingMinutes,
      state:
        remainingMinutes === null
          ? "unknown"
          : remainingMinutes < 0
            ? "overdue"
            : remainingMinutes <= 120
              ? "due_soon"
              : "on_track",
    },
    nextAction: {
      kind: value.nextAction.kind,
      title: presentation.copy.label,
      reason: presentation.copy.reason,
      label: interaction.mode === "executable" ? presentation.copy.cta : null,
      href: interaction.mode === "executable" ? actionHref : null,
      processStage: presentation.processStage,
      requiredCapability: presentation.requiredCapability,
      reviewMode: presentation.reviewMode,
      interaction,
      ...(diagnosticBlocker ? { diagnosticBlocker } : {}),
    },
    stages: projectAdminNextCaseStages(value),
    customerRecord: {
      questions: {
        total: customerQuestionContext.threads.length,
        unresolved: Boolean(customerQuestionContext.unresolved),
        ...(activeQuestion
          ? {
              active: {
                id: `message-${activeQuestion.id}`,
                subject: activeQuestion.subject || `#${activeQuestion.id}`,
                bodyText: activeQuestion.bodyText || "",
                channel: activeQuestion.channel || "—",
                receivedAt:
                  activeQuestion.createdAt || activeQuestion.updatedAt || "—",
                documentReferences:
                  customerQuestionDocumentReferences(activeQuestion),
                replyStage: customerQuestionReplyStage(activeReply),
                ...(activeReply
                  ? {
                      reply: {
                        id: `message-${activeReply.id}`,
                        subject: activeReply.subject || `#${activeReply.id}`,
                        bodyText: activeReply.bodyText || "",
                        status: activeReply.status || "—",
                        at:
                          activeReply.deliveredAt ||
                          activeReply.updatedAt ||
                          activeReply.createdAt ||
                          "—",
                      },
                    }
                  : {}),
                fallbackHref: activeReply
                  ? `${caseHref}#message-${activeReply.id}`
                  : caseHref,
              },
            }
          : {}),
      },
      communications,
      communicationPage: options.communicationPage?.pageInfo || {
        totalCount: communications.length,
        remainingCount: 0,
        nextCursor: null,
        loadMoreHref: null,
      },
      commercialVersions,
      documents: customerDocuments,
      history: businessHistory,
    },
    evidence: [...measurementEvidence, ...documentEvidence],
    ...auditTimeline,
    fallback: {
      caseHref,
      documentsHref: "/admin-v2/documents",
      workHref: "/admin-v2/work",
    },
  };
}

export function createAdminNextCanonicalCaseWorkspaceAdapter(
  payload: Payload,
  locale: CaseNextActionLocale = "nb",
  options: {
    viewerRole: UserRole;
    grantedCapabilities?: readonly CaseNextActionCapability[];
    now?: () => Date;
    rfReview?: AdminNextCaseRfReviewRead;
  },
): AdminNextCaseWorkspaceAdapter {
  return {
    async load(reference) {
      const match = reference.match(/^(?:TF-)?(\d+)$/u);
      if (!match) return { status: "not_found" };
      const leadId = Number(match[1]);
      const [value, communicationPage] = await Promise.all([
        loadAdminCaseWorkspace(payload, leadId),
        loadAdminNextCaseCommunicationPage(payload, leadId),
      ]);
      if (!value) return { status: "not_found" };
      const [auditHistory, rfEntry] = await Promise.all([
        loadAdminNextCaseAuditHistory(payload, value, options.viewerRole),
        loadAdminNextCaseRfEntry(value, options.rfReview),
      ]);
      return {
        status: "ready",
        source: "canonical",
        value: projectAdminCaseWorkspace(
          value,
          options.now?.() || new Date(),
          locale,
          auditHistory,
          {
            communicationPage,
            rfEntry,
            grantedCapabilities: options.grantedCapabilities,
          },
        ),
      };
    },
  };
}

function resolveCaseActionHref(
  value: AdminCaseWorkspace,
  presentation: LocalizedCaseNextActionPresentation,
  caseHref: string,
) {
  const targetId = value.nextAction.targetId;
  const byId = <T extends { id: number; href: string }>(items: readonly T[]) =>
    targetId
      ? operatorHref(items.find(({ id }) => id === targetId)?.href)
      : null;
  const href =
    presentation.target.entity === "case"
      ? caseHref
      : presentation.target.entity === "commercial_package"
        ? targetId && value.quote?.id === targetId
          ? caseHref
          : null
        : presentation.target.entity === "message"
          ? byId(value.messages)
          : presentation.target.entity === "measurement"
            ? byId(value.measurement ? [value.measurement] : [])
            : presentation.target.entity === "price_calculation"
              ? byId(value.priceCalculations)
              : presentation.target.entity === "quote"
                ? byId(value.quote ? [value.quote] : [])
                : presentation.target.entity === "contract"
                  ? byId(value.contract ? [value.contract] : [])
                  : presentation.target.entity === "customer_contract_request"
                    ? byId(
                        value.contractRequests.filter(
                          ({ closedAt }) => !closedAt,
                        ),
                      )
                    : presentation.target.entity === "work_order"
                      ? byId(value.workOrder ? [value.workOrder] : [])
                      : caseHref;
  return href || (presentation.target.required ? null : caseHref);
}
