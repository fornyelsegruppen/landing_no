import {
  customerQuestionDocumentReferences,
  customerQuestionReplyStage,
  type CustomerQuestionContextThread,
  type CustomerQuestionReplyStage,
} from "@/lib/messages/customer-question-state";
import type {
  AdminCase,
  CaseMessage,
  CaseNextAction,
  CaseNextActionKind,
} from "./case-read-model";
import type {
  CaseWorkspaceBlockerKey,
  CaseWorkspaceEvidenceKey,
  CaseWorkspaceHelpKey,
  CaseWorkspaceI18nKey,
  CaseWorkspaceProcessStage,
  CaseWorkspaceQuestionPresentation,
  CaseWorkspaceQuestionRecovery,
  CaseWorkspaceStatusKey,
} from "./case-workspace-i18n";

export type CaseWorkspaceTone =
  "critical" | "warning" | "action" | "waiting" | "success" | "neutral";

export type CaseWorkspacePriority =
  "lifecycle" | "stop" | "question" | "communication" | "business" | "idle";

export const caseWorkspacePriorityRank = {
  lifecycle: 600,
  stop: 500,
  question: 400,
  communication: 300,
  business: 200,
  idle: 100,
} as const satisfies Record<CaseWorkspacePriority, number>;

export type CaseWorkspaceEvidence = {
  href?: string;
  labelKey: `evidence.${CaseWorkspaceEvidenceKey}`;
  value: string;
};

export type CaseWorkspacePrimaryAction =
  | {
      kind: CaseNextActionKind;
      mode: "mutation";
      targetId?: number;
    }
  | {
      mode: "question";
      questionId: number;
      replyId?: number;
    }
  | { href: string; mode: "navigate" }
  | { mode: "wait" };

export type CaseWorkspacePrimaryState = {
  action: CaseWorkspacePrimaryAction;
  blocker?: {
    code: string;
    labelKey: `blockers.${CaseWorkspaceBlockerKey}`;
  };
  evidence: CaseWorkspaceEvidence[];
  helpKey?: CaseWorkspaceI18nKey;
  key: string;
  priority: CaseWorkspacePriority;
  priorityRank: number;
  processStage: CaseWorkspaceProcessStage;
  statusLabelKey: CaseWorkspaceI18nKey;
  targetReference?: string;
  titleKey: CaseWorkspaceI18nKey;
  tone: CaseWorkspaceTone;
};

export type CaseWorkspaceQuestionContext = {
  documentReferences?: readonly string[];
  question: Pick<CaseMessage, "createdAt" | "id" | "subject"> & {
    reference?: string;
  };
  recovery?: CaseWorkspaceQuestionRecovery;
  reply?: Pick<CaseMessage, "id"> | null;
  stage: CustomerQuestionReplyStage;
};

export function toCaseWorkspaceQuestionContext(
  thread: CustomerQuestionContextThread | null | undefined,
  recovery?: CaseWorkspaceQuestionRecovery,
): CaseWorkspaceQuestionContext | null {
  if (!thread) return null;
  return {
    documentReferences: customerQuestionDocumentReferences(thread.question),
    question: thread.question,
    recovery,
    reply: thread.reply,
    stage: customerQuestionReplyStage(thread.reply),
  };
}

type ActionPresentation = {
  help: CaseWorkspaceHelpKey;
  processStage: CaseWorkspaceProcessStage;
  status: CaseWorkspaceStatusKey;
  tone: CaseWorkspaceTone;
};

/** Exhaustive by design: adding a read-model action breaks compilation here. */
export const caseWorkspaceActionPresentation = {
  approve_measurement: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "measurement",
  },
  approve_package: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "commercial",
  },
  approve_message: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "contact",
  },
  approve_quote: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "commercial",
  },
  assign_worker: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "work",
  },
  calculate_price: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "commercial",
  },
  company_sign_contract: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "agreement",
  },
  create_quote: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "commercial",
  },
  create_work_order: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "work",
  },
  generate_reply: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "contact",
  },
  follow_up_decline: {
    tone: "critical",
    status: "declined",
    help: "declined",
    processStage: "agreement",
  },
  issue_quote: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "commercial",
  },
  measurement_required: {
    tone: "warning",
    status: "attention",
    help: "attention",
    processStage: "measurement",
  },
  prepare_package: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "measurement",
  },
  prepare_question_reply: {
    tone: "warning",
    status: "attention",
    help: "attention",
    processStage: "agreement",
  },
  review_cancellation: {
    tone: "critical",
    status: "cancellation",
    help: "cancellation",
    processStage: "agreement",
  },
  review_completion: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "completion",
  },
  resolve_work_block: {
    tone: "critical",
    status: "blocked",
    help: "blocked",
    processStage: "work",
  },
  schedule_work: {
    tone: "action",
    status: "action",
    help: "action",
    processStage: "work",
  },
  send_closure_confirmation: {
    tone: "critical",
    status: "cancellation",
    help: "cancellation",
    processStage: "agreement",
  },
  none: {
    tone: "neutral",
    status: "idle",
    help: "idle",
    processStage: "contact",
  },
  retry_message: {
    tone: "critical",
    status: "attention",
    help: "attention",
    processStage: "contact",
  },
  wait_customer: {
    tone: "waiting",
    status: "waiting",
    help: "waiting",
    processStage: "agreement",
  },
  wait_scheduled_start: {
    tone: "waiting",
    status: "waiting",
    help: "waiting",
    processStage: "work",
  },
  wait_worker_precheck: {
    tone: "waiting",
    status: "waiting",
    help: "waiting",
    processStage: "work",
  },
  wait_work_completion: {
    tone: "waiting",
    status: "waiting",
    help: "waiting",
    processStage: "work",
  },
  wait_worker_documentation: {
    tone: "waiting",
    status: "waiting",
    help: "waiting",
    processStage: "completion",
  },
} as const satisfies Record<CaseNextActionKind, ActionPresentation>;

const waitingActions = new Set<CaseNextActionKind>([
  "none",
  "wait_customer",
  "wait_scheduled_start",
  "wait_worker_precheck",
  "wait_work_completion",
  "wait_worker_documentation",
]);

const stopActions = new Set<CaseNextActionKind>([
  "follow_up_decline",
  "review_cancellation",
  "resolve_work_block",
  "send_closure_confirmation",
]);

const navigationTargets: Partial<Record<CaseNextActionKind, string>> = {
  assign_worker: "#work-planning",
  create_work_order: "#work-planning",
  follow_up_decline: "#case-lifecycle-title",
  measurement_required: "#measurement-section",
  review_completion: "#completion-review",
  resolve_work_block: "#change-agreement-workbench",
  schedule_work: "#work-planning",
};

const activeContractRequestStatuses = new Set([
  "received",
  "admin_review",
  "alternative_requested",
  "follow_up_scheduled",
]);

function navigationTarget(
  caseData: AdminCase,
  action: CaseNextAction,
): string | undefined {
  if (action.kind === "review_cancellation") {
    return caseData.contractRequests.some((request) =>
      activeContractRequestStatuses.has(request.status || ""),
    )
      ? "#contract-request-section"
      : "#cancellation-review";
  }
  return navigationTargets[action.kind];
}

function priorityState<
  T extends Omit<CaseWorkspacePrimaryState, "priorityRank">,
>(state: T): T & Pick<CaseWorkspacePrimaryState, "priorityRank"> {
  return {
    ...state,
    priorityRank: caseWorkspacePriorityRank[state.priority],
  };
}

function processStageForIdle(caseData: AdminCase) {
  if (
    caseData.invoice ||
    caseData.warranty ||
    caseData.workOrder?.status === "completed" ||
    caseData.workOrder?.status === "documented"
  ) {
    return "completion" as const;
  }
  if (caseData.workOrder) return "work" as const;
  if (caseData.contract || caseData.quote?.status === "accepted") {
    return "agreement" as const;
  }
  if (caseData.quote || caseData.price) return "commercial" as const;
  if (caseData.measurement) return "measurement" as const;
  return "contact" as const;
}

const processStageRank = {
  contact: 0,
  measurement: 1,
  commercial: 2,
  agreement: 3,
  work: 4,
  completion: 5,
} as const satisfies Record<CaseWorkspaceProcessStage, number>;

/**
 * A blocker can change what needs attention, but it must never erase achieved
 * process milestones. Use the furthest of the action stage and persisted case
 * evidence for the six-stage progress view.
 */
export function deriveCaseWorkspaceProcessStage(
  caseData: AdminCase,
  actionStage: CaseWorkspaceProcessStage,
): CaseWorkspaceProcessStage {
  const achievedStage = processStageForIdle(caseData);
  return processStageRank[achievedStage] > processStageRank[actionStage]
    ? achievedStage
    : actionStage;
}

function entityForTarget(caseData: AdminCase, targetId?: number) {
  if (!targetId) return undefined;
  const entities = [
    ...caseData.messages,
    caseData.measurement,
    caseData.price,
    caseData.quote,
    caseData.contract,
    caseData.workOrder,
    caseData.invoice,
    caseData.warranty,
    ...caseData.changes,
  ];
  return entities.find((entity) => entity?.id === targetId);
}

function evidenceForTarget(
  caseData: AdminCase,
  targetId?: number,
): Pick<CaseWorkspacePrimaryState, "evidence" | "targetReference"> {
  const entity = entityForTarget(caseData, targetId);
  if (!entity) return { evidence: [] };
  return {
    evidence: [
      {
        href: entity.href,
        labelKey: "evidence.target",
        value: entity.reference,
      },
    ],
    targetReference: entity.reference,
  };
}

function normalAction(
  caseData: AdminCase,
  nextAction: CaseNextAction,
): CaseWorkspacePrimaryState {
  const config = caseWorkspaceActionPresentation[nextAction.kind];
  const target = evidenceForTarget(caseData, nextAction.targetId);
  const href = navigationTarget(caseData, nextAction);
  const priority = waitingActions.has(nextAction.kind) ? "idle" : "business";
  const processStage =
    nextAction.kind === "none"
      ? processStageForIdle(caseData)
      : config.processStage;

  return priorityState({
    action: waitingActions.has(nextAction.kind)
      ? { mode: "wait" }
      : href
        ? { href, mode: "navigate" }
        : {
            kind: nextAction.kind,
            mode: "mutation",
            targetId: nextAction.targetId,
          },
    evidence: target.evidence,
    helpKey: `help.${config.help}`,
    key: `action.${nextAction.kind}`,
    priority,
    processStage,
    statusLabelKey: `statuses.${config.status}`,
    targetReference: target.targetReference,
    titleKey: `actions.${nextAction.kind}`,
    tone: config.tone,
  });
}

function stopState(
  caseData: AdminCase,
  action: CaseNextAction,
): CaseWorkspacePrimaryState {
  const config = caseWorkspaceActionPresentation[action.kind];
  const target = evidenceForTarget(caseData, action.targetId);
  const blocker: {
    code: string;
    labelKey: `blockers.${CaseWorkspaceBlockerKey}`;
  } =
    action.kind === "follow_up_decline"
      ? { code: "QUOTE_DECLINED", labelKey: "blockers.declined" }
      : action.kind === "resolve_work_block"
        ? { code: "WORK_BLOCKED", labelKey: "blockers.work" }
        : {
            code: "CUSTOMER_CANCELLATION_REQUEST",
            labelKey: "blockers.customerCancellation",
          };
  const href = navigationTarget(caseData, action);

  return priorityState({
    action: href
      ? { href, mode: "navigate" }
      : { kind: action.kind, mode: "mutation", targetId: action.targetId },
    blocker,
    evidence: target.evidence,
    helpKey: `help.${config.help}`,
    key: `stop.${action.kind}`,
    priority: "stop",
    processStage: config.processStage,
    statusLabelKey: `statuses.${config.status}`,
    targetReference: target.targetReference,
    titleKey: `actions.${action.kind}`,
    tone: config.tone,
  });
}

function questionState(
  context: CaseWorkspaceQuestionContext,
): CaseWorkspacePrimaryState {
  const presentation: CaseWorkspaceQuestionPresentation =
    context.recovery || context.stage;
  const isWaiting = context.stage === "queued" || context.stage === "sent";
  const tone: CaseWorkspaceTone =
    context.stage === "delivery_failed" || context.recovery
      ? context.recovery === "ai_unavailable"
        ? "warning"
        : "critical"
      : isWaiting
        ? "waiting"
        : context.stage === "delivered"
          ? "success"
          : "warning";
  const evidence: CaseWorkspaceEvidence[] = [];
  if (context.question.createdAt) {
    evidence.push({
      labelKey: "evidence.receivedAt",
      value: context.question.createdAt,
    });
  }
  for (const reference of context.documentReferences || []) {
    evidence.push({ labelKey: "evidence.document", value: reference });
  }

  return priorityState({
    action:
      isWaiting || context.stage === "delivered"
        ? { mode: "wait" }
        : {
            mode: "question",
            questionId: context.question.id,
            replyId: context.reply?.id,
          },
    blocker:
      context.stage === "delivered"
        ? undefined
        : {
            code: `CUSTOMER_QUESTION_${presentation.toUpperCase()}`,
            labelKey: "blockers.customerQuestion",
          },
    evidence,
    helpKey: `questions.${presentation}.help`,
    key: `question.${presentation}`,
    priority: context.stage === "delivered" ? "idle" : "question",
    processStage: "agreement",
    statusLabelKey: `questions.${presentation}.status`,
    targetReference:
      context.question.reference || context.question.subject || undefined,
    titleKey: `questions.${presentation}.title`,
    tone,
  });
}

function lifecycleState(caseData: AdminCase): CaseWorkspacePrimaryState {
  const trashed = caseData.lead.recordState === "trashed";
  const state = trashed ? "trashed" : "archived";
  return priorityState({
    action: { href: "#case-lifecycle-title", mode: "navigate" },
    blocker: {
      code: trashed ? "CASE_TRASHED" : "CASE_ARCHIVED",
      labelKey: `blockers.${state}`,
    },
    evidence: [],
    helpKey: `help.${state}`,
    key: `lifecycle.${state}`,
    priority: "lifecycle",
    processStage: processStageForIdle(caseData),
    statusLabelKey: `statuses.${state}`,
    titleKey: `blockers.${state}`,
    tone: "neutral",
  });
}

function latestAttentionMessage(
  caseData: AdminCase,
  questionContext?: CaseWorkspaceQuestionContext | null,
) {
  return caseData.messages.find(
    (message) =>
      ["failed", "attention"].includes(message.status || "") &&
      message.id !== questionContext?.reply?.id,
  );
}

function communicationFailureState(
  caseData: AdminCase,
  message: CaseMessage,
): CaseWorkspacePrimaryState {
  const target = evidenceForTarget(caseData, message.id);
  return priorityState({
    action: {
      kind: "retry_message",
      mode: "mutation",
      targetId: message.id,
    },
    blocker: {
      code: message.failureCode || "MESSAGE_DELIVERY_FAILED",
      labelKey: "blockers.communication",
    },
    evidence: target.evidence,
    helpKey: "help.attention",
    key: "communication.delivery_failed",
    priority: "communication",
    processStage: "contact",
    statusLabelKey: "statuses.attention",
    targetReference: target.targetReference,
    titleKey: "actions.retry_message",
    tone: "critical",
  });
}

/**
 * Canonical V3 primary-state resolver. It is pure and intentionally owns the
 * complete priority decision so UI components cannot override each other.
 */
export function deriveCaseWorkspacePrimaryState(
  caseData: AdminCase,
  customerQuestionContext?: CaseWorkspaceQuestionContext | null,
): CaseWorkspacePrimaryState {
  if (caseData.lead.recordState !== "active") {
    return lifecycleState(caseData);
  }

  const nextAction =
    caseData.lead.nextActionBlocker === "CUSTOMER_CANCELLATION_REQUEST"
      ? ({ kind: "review_cancellation" } satisfies CaseNextAction)
      : caseData.nextAction;

  if (stopActions.has(nextAction.kind)) {
    return stopState(caseData, nextAction);
  }

  if (
    customerQuestionContext &&
    (customerQuestionContext.stage !== "delivered" ||
      customerQuestionContext.recovery)
  ) {
    return questionState(customerQuestionContext);
  }

  const attentionMessage = latestAttentionMessage(
    caseData,
    customerQuestionContext,
  );
  if (attentionMessage) {
    return communicationFailureState(caseData, attentionMessage);
  }

  const primary = normalAction(caseData, nextAction);
  if (
    customerQuestionContext?.stage === "delivered" &&
    nextAction.kind === "none"
  ) {
    return questionState(customerQuestionContext);
  }
  return primary;
}
