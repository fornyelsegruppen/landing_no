import type { CaseNextActionKind } from "./case-read-model";

export type CaseNextActionLocale = "nb" | "lt" | "en";

export type CaseNextActionProcessStage =
  "inquiry" | "evidence" | "commercial" | "agreement" | "work" | "completion";

export type CaseNextActionStateHint =
  "needs_action" | "waiting" | "blocked" | "derive_from_case";

export type CaseNextActionReviewMode =
  "inline" | "guided" | "review_and_commit" | "danger" | "waiting" | "none";

export type CaseNextActionCapability =
  | "case.read"
  | "case.reply.prepare"
  | "case.question.reply.prepare"
  | "message.approve_send"
  | "message.retry_send"
  | "message.closure.approve_send"
  | "commercial.package.prepare"
  | "commercial.package.approve_send"
  | "measurement.review_approve"
  | "measurement.resolve"
  | "price.calculate"
  | "quote.create"
  | "quote.approve"
  | "quote.issue"
  | "quote.read"
  | "quote.decline.resolve"
  | "contract.company_sign"
  | "case.cancellation.review"
  | "work_order.create"
  | "work_order.assign"
  | "work_order.schedule"
  | "work_order.block.resolve"
  | "work_order.read"
  | "work_order.completion.review";

export type CaseNextActionOwnerParty =
  "administrator" | "customer" | "worker" | "system" | "none";

export type CaseNextActionOwnerStrategy =
  | "case_owner"
  | "capability_pool"
  | "customer"
  | "assigned_worker"
  | "system"
  | "none";

export type CaseNextActionTargetEntity =
  | "case"
  | "message"
  | "measurement"
  | "commercial_package"
  | "price_calculation"
  | "quote"
  | "contract"
  | "customer_contract_request"
  | "work_order";

export type CaseNextActionTargetIdSource =
  | "case_id"
  | "next_action_target_id"
  | "commercial_context"
  | "current_quote_id"
  | "active_contract_request_id";

export type CaseNextActionDestination =
  | "case_workspace"
  | "communication"
  | "measurement_workbench"
  | "commercial_review"
  | "quote_workbench"
  | "agreement_workbench"
  | "cancellation_review"
  | "work_planning"
  | "work_order"
  | "completion_review";

export type CaseNextActionDueMode =
  "deadline" | "immediate" | "wake_up" | "none";

export type CaseNextActionDueSource =
  | "lead.nextActionAt"
  | "lead.createdAt"
  | "message.createdAt"
  | "message.updatedAt"
  | "measurement.updatedAt"
  | "price.createdAt"
  | "quote.updatedAt"
  | "quote.validUntil"
  | "quote.declinedAt"
  | "contract.signedAt"
  | "contract.companySignedAt"
  | "contractRequest.receivedAt"
  | "workOrder.createdAt"
  | "workOrder.scheduledAt"
  | "workOrder.completedAt"
  | "workOrder.documentationSubmittedAt";

export type CaseNextActionDuePolicy =
  | "case_response_sla"
  | "message_approval_sla"
  | "message_recovery_sla"
  | "evidence_review_sla"
  | "commercial_review_sla"
  | "agreement_review_sla"
  | "dispatch_sla"
  | "worker_documentation_sla"
  | "completion_review_sla";

export type CaseNextActionBlockerProjection =
  | "none"
  | "communication_failure"
  | "message_preflight"
  | "measurement_preflight"
  | "measurement_blocking_reasons"
  | "commercial_package_preflight"
  | "quote_preflight"
  | "quote_declined"
  | "contract_preflight"
  | "cancellation_request"
  | "work_order_blocking_reasons"
  | "completion_evidence";

export type CaseNextActionReasonCode =
  | "MEASUREMENT_REVIEW_REQUIRED"
  | "COMMERCIAL_PACKAGE_REVIEW_REQUIRED"
  | "MESSAGE_DRAFT_READY"
  | "QUOTE_DRAFT_REVIEW_REQUIRED"
  | "WORK_ORDER_UNASSIGNED"
  | "MEASUREMENT_APPROVED_PRICE_MISSING"
  | "COMPANY_COUNTERSIGNATURE_REQUIRED"
  | "PRICE_READY_QUOTE_MISSING"
  | "SIGNED_CONTRACT_WORK_ORDER_MISSING"
  | "CUSTOMER_REPLY_DRAFT_REQUIRED"
  | "QUOTE_DECLINED"
  | "QUOTE_APPROVED_NOT_ISSUED"
  | "MEASUREMENT_BLOCKED"
  | "COMMERCIAL_PACKAGE_PREPARATION_REQUIRED"
  | "CUSTOMER_QUESTION_RECEIVED"
  | "CUSTOMER_CANCELLATION_REQUEST"
  | "WORK_DOCUMENTATION_REVIEW_REQUIRED"
  | "WORK_ORDER_BLOCKED"
  | "WORK_ORDER_UNSCHEDULED"
  | "CLOSURE_CONFIRMATION_DRAFT_READY"
  | "NO_ACTION_REQUIRED"
  | "MESSAGE_DELIVERY_FAILED"
  | "QUOTE_SENT_AWAITING_CUSTOMER"
  | "WORK_START_SCHEDULED"
  | "WORKER_PRECHECK_IN_PROGRESS"
  | "WORK_IN_PROGRESS"
  | "WORK_DOCUMENTATION_PENDING";

export type CaseNextActionCopy = {
  label: string;
  reason: string;
  /** Null means that the state has no primary command CTA. */
  cta: string | null;
};

export type CaseNextActionPresentation = {
  processStage: CaseNextActionProcessStage;
  /** The achieved case stage is always allowed to move this hint forward. */
  stagePolicy: "furthest_achieved" | "achieved_only";
  caseStateHint: CaseNextActionStateHint;
  reasonCode: CaseNextActionReasonCode;
  reviewMode: CaseNextActionReviewMode;
  requiredCapability: CaseNextActionCapability;
  target: {
    entity: CaseNextActionTargetEntity;
    idSource: CaseNextActionTargetIdSource;
    required: boolean;
    destination: CaseNextActionDestination;
  };
  owner: {
    party: CaseNextActionOwnerParty;
    strategy: CaseNextActionOwnerStrategy;
    capability: CaseNextActionCapability | null;
  };
  due: {
    mode: CaseNextActionDueMode;
    sources: readonly CaseNextActionDueSource[];
    policy: CaseNextActionDuePolicy | null;
  };
  blocker: {
    projection: CaseNextActionBlockerProjection;
    defaultCode: string | null;
  };
  copy: Readonly<Record<CaseNextActionLocale, CaseNextActionCopy>>;
};

type CaseNextActionSemantics = Omit<CaseNextActionPresentation, "copy">;

const semantics = {
  approve_measurement: {
    processStage: "evidence",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "MEASUREMENT_REVIEW_REQUIRED",
    reviewMode: "review_and_commit",
    requiredCapability: "measurement.review_approve",
    target: {
      entity: "measurement",
      idSource: "next_action_target_id",
      required: true,
      destination: "measurement_workbench",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "measurement.review_approve",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "measurement.updatedAt"],
      policy: "evidence_review_sla",
    },
    blocker: {
      projection: "measurement_preflight",
      defaultCode: null,
    },
  },
  approve_package: {
    processStage: "commercial",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "COMMERCIAL_PACKAGE_REVIEW_REQUIRED",
    reviewMode: "review_and_commit",
    requiredCapability: "commercial.package.approve_send",
    target: {
      entity: "commercial_package",
      idSource: "commercial_context",
      required: true,
      destination: "commercial_review",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "commercial.package.approve_send",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "quote.updatedAt"],
      policy: "commercial_review_sla",
    },
    blocker: {
      projection: "commercial_package_preflight",
      defaultCode: null,
    },
  },
  approve_message: {
    processStage: "inquiry",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "MESSAGE_DRAFT_READY",
    reviewMode: "review_and_commit",
    requiredCapability: "message.approve_send",
    target: {
      entity: "message",
      idSource: "next_action_target_id",
      required: true,
      destination: "communication",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "message.approve_send",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "message.updatedAt"],
      policy: "message_approval_sla",
    },
    blocker: { projection: "message_preflight", defaultCode: null },
  },
  approve_quote: {
    processStage: "commercial",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "QUOTE_DRAFT_REVIEW_REQUIRED",
    reviewMode: "review_and_commit",
    requiredCapability: "quote.approve",
    target: {
      entity: "quote",
      idSource: "next_action_target_id",
      required: true,
      destination: "quote_workbench",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "quote.approve",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "quote.updatedAt"],
      policy: "commercial_review_sla",
    },
    blocker: { projection: "quote_preflight", defaultCode: null },
  },
  assign_worker: {
    processStage: "work",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "WORK_ORDER_UNASSIGNED",
    reviewMode: "guided",
    requiredCapability: "work_order.assign",
    target: {
      entity: "work_order",
      idSource: "next_action_target_id",
      required: true,
      destination: "work_planning",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "work_order.assign",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "workOrder.createdAt"],
      policy: "dispatch_sla",
    },
    blocker: { projection: "none", defaultCode: null },
  },
  calculate_price: {
    processStage: "commercial",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "MEASUREMENT_APPROVED_PRICE_MISSING",
    reviewMode: "review_and_commit",
    requiredCapability: "price.calculate",
    target: {
      entity: "measurement",
      idSource: "next_action_target_id",
      required: true,
      destination: "commercial_review",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "price.calculate",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "measurement.updatedAt"],
      policy: "commercial_review_sla",
    },
    blocker: {
      projection: "measurement_preflight",
      defaultCode: null,
    },
  },
  company_sign_contract: {
    processStage: "agreement",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "COMPANY_COUNTERSIGNATURE_REQUIRED",
    reviewMode: "review_and_commit",
    requiredCapability: "contract.company_sign",
    target: {
      entity: "contract",
      idSource: "next_action_target_id",
      required: true,
      destination: "agreement_workbench",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "contract.company_sign",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "contract.signedAt"],
      policy: "agreement_review_sla",
    },
    blocker: { projection: "contract_preflight", defaultCode: null },
  },
  create_quote: {
    processStage: "commercial",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "PRICE_READY_QUOTE_MISSING",
    reviewMode: "review_and_commit",
    requiredCapability: "quote.create",
    target: {
      entity: "price_calculation",
      idSource: "next_action_target_id",
      required: true,
      destination: "quote_workbench",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "quote.create",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "price.createdAt"],
      policy: "commercial_review_sla",
    },
    blocker: {
      projection: "commercial_package_preflight",
      defaultCode: null,
    },
  },
  create_work_order: {
    processStage: "work",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "SIGNED_CONTRACT_WORK_ORDER_MISSING",
    reviewMode: "guided",
    requiredCapability: "work_order.create",
    target: {
      entity: "contract",
      idSource: "next_action_target_id",
      required: true,
      destination: "work_planning",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "work_order.create",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "contract.companySignedAt"],
      policy: "dispatch_sla",
    },
    blocker: { projection: "contract_preflight", defaultCode: null },
  },
  generate_reply: {
    processStage: "inquiry",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "CUSTOMER_REPLY_DRAFT_REQUIRED",
    reviewMode: "inline",
    requiredCapability: "case.reply.prepare",
    target: {
      entity: "case",
      idSource: "case_id",
      required: true,
      destination: "communication",
    },
    owner: {
      party: "administrator",
      strategy: "case_owner",
      capability: "case.reply.prepare",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "message.createdAt", "lead.createdAt"],
      policy: "case_response_sla",
    },
    blocker: { projection: "none", defaultCode: null },
  },
  follow_up_decline: {
    processStage: "commercial",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "QUOTE_DECLINED",
    reviewMode: "danger",
    requiredCapability: "quote.decline.resolve",
    target: {
      entity: "quote",
      idSource: "next_action_target_id",
      required: true,
      destination: "agreement_workbench",
    },
    owner: {
      party: "administrator",
      strategy: "case_owner",
      capability: "quote.decline.resolve",
    },
    due: {
      mode: "immediate",
      sources: ["quote.declinedAt", "lead.nextActionAt"],
      policy: "case_response_sla",
    },
    blocker: { projection: "quote_declined", defaultCode: "QUOTE_DECLINED" },
  },
  issue_quote: {
    processStage: "commercial",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "QUOTE_APPROVED_NOT_ISSUED",
    reviewMode: "review_and_commit",
    requiredCapability: "quote.issue",
    target: {
      entity: "quote",
      idSource: "next_action_target_id",
      required: true,
      destination: "quote_workbench",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "quote.issue",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "quote.updatedAt"],
      policy: "commercial_review_sla",
    },
    blocker: { projection: "quote_preflight", defaultCode: null },
  },
  measurement_required: {
    processStage: "evidence",
    stagePolicy: "furthest_achieved",
    caseStateHint: "blocked",
    reasonCode: "MEASUREMENT_BLOCKED",
    reviewMode: "guided",
    requiredCapability: "measurement.resolve",
    target: {
      entity: "measurement",
      idSource: "next_action_target_id",
      required: true,
      destination: "measurement_workbench",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "measurement.resolve",
    },
    due: {
      mode: "immediate",
      sources: ["lead.nextActionAt", "measurement.updatedAt"],
      policy: "evidence_review_sla",
    },
    blocker: {
      projection: "measurement_blocking_reasons",
      defaultCode: "MEASUREMENT_BLOCK_REASON_MISSING",
    },
  },
  prepare_package: {
    processStage: "evidence",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "COMMERCIAL_PACKAGE_PREPARATION_REQUIRED",
    reviewMode: "inline",
    requiredCapability: "commercial.package.prepare",
    target: {
      entity: "case",
      idSource: "case_id",
      required: true,
      destination: "case_workspace",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "commercial.package.prepare",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "lead.createdAt"],
      policy: "evidence_review_sla",
    },
    blocker: { projection: "none", defaultCode: null },
  },
  prepare_question_reply: {
    processStage: "inquiry",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "CUSTOMER_QUESTION_RECEIVED",
    reviewMode: "inline",
    requiredCapability: "case.question.reply.prepare",
    target: {
      entity: "message",
      idSource: "next_action_target_id",
      required: true,
      destination: "communication",
    },
    owner: {
      party: "administrator",
      strategy: "case_owner",
      capability: "case.question.reply.prepare",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "message.createdAt"],
      policy: "case_response_sla",
    },
    blocker: { projection: "none", defaultCode: null },
  },
  review_cancellation: {
    processStage: "agreement",
    stagePolicy: "furthest_achieved",
    caseStateHint: "blocked",
    reasonCode: "CUSTOMER_CANCELLATION_REQUEST",
    reviewMode: "danger",
    requiredCapability: "case.cancellation.review",
    target: {
      entity: "customer_contract_request",
      idSource: "active_contract_request_id",
      required: true,
      destination: "cancellation_review",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "case.cancellation.review",
    },
    due: {
      mode: "immediate",
      sources: ["contractRequest.receivedAt", "lead.nextActionAt"],
      policy: "agreement_review_sla",
    },
    blocker: {
      projection: "cancellation_request",
      defaultCode: "CUSTOMER_CANCELLATION_REQUEST",
    },
  },
  review_completion: {
    processStage: "completion",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "WORK_DOCUMENTATION_REVIEW_REQUIRED",
    reviewMode: "review_and_commit",
    requiredCapability: "work_order.completion.review",
    target: {
      entity: "work_order",
      idSource: "next_action_target_id",
      required: true,
      destination: "completion_review",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "work_order.completion.review",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "workOrder.documentationSubmittedAt"],
      policy: "completion_review_sla",
    },
    blocker: { projection: "completion_evidence", defaultCode: null },
  },
  resolve_work_block: {
    processStage: "work",
    stagePolicy: "furthest_achieved",
    caseStateHint: "blocked",
    reasonCode: "WORK_ORDER_BLOCKED",
    reviewMode: "danger",
    requiredCapability: "work_order.block.resolve",
    target: {
      entity: "work_order",
      idSource: "next_action_target_id",
      required: true,
      destination: "work_order",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "work_order.block.resolve",
    },
    due: {
      mode: "immediate",
      sources: ["lead.nextActionAt", "workOrder.createdAt"],
      policy: "dispatch_sla",
    },
    blocker: {
      projection: "work_order_blocking_reasons",
      defaultCode: "WORK_ORDER_BLOCKED",
    },
  },
  schedule_work: {
    processStage: "work",
    stagePolicy: "furthest_achieved",
    caseStateHint: "needs_action",
    reasonCode: "WORK_ORDER_UNSCHEDULED",
    reviewMode: "guided",
    requiredCapability: "work_order.schedule",
    target: {
      entity: "work_order",
      idSource: "next_action_target_id",
      required: true,
      destination: "work_planning",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "work_order.schedule",
    },
    due: {
      mode: "deadline",
      sources: ["lead.nextActionAt", "workOrder.createdAt"],
      policy: "dispatch_sla",
    },
    blocker: { projection: "none", defaultCode: null },
  },
  send_closure_confirmation: {
    processStage: "agreement",
    stagePolicy: "furthest_achieved",
    caseStateHint: "blocked",
    reasonCode: "CLOSURE_CONFIRMATION_DRAFT_READY",
    reviewMode: "danger",
    requiredCapability: "message.closure.approve_send",
    target: {
      entity: "message",
      idSource: "next_action_target_id",
      required: true,
      destination: "cancellation_review",
    },
    owner: {
      party: "administrator",
      strategy: "capability_pool",
      capability: "message.closure.approve_send",
    },
    due: {
      mode: "immediate",
      sources: ["message.createdAt", "lead.nextActionAt"],
      policy: "message_approval_sla",
    },
    blocker: {
      projection: "cancellation_request",
      defaultCode: "CUSTOMER_CANCELLATION_REQUEST",
    },
  },
  none: {
    processStage: "inquiry",
    stagePolicy: "achieved_only",
    caseStateHint: "derive_from_case",
    reasonCode: "NO_ACTION_REQUIRED",
    reviewMode: "none",
    requiredCapability: "case.read",
    target: {
      entity: "case",
      idSource: "case_id",
      required: true,
      destination: "case_workspace",
    },
    owner: { party: "none", strategy: "none", capability: null },
    due: { mode: "none", sources: [], policy: null },
    blocker: { projection: "none", defaultCode: null },
  },
  retry_message: {
    processStage: "inquiry",
    stagePolicy: "furthest_achieved",
    caseStateHint: "blocked",
    reasonCode: "MESSAGE_DELIVERY_FAILED",
    reviewMode: "review_and_commit",
    requiredCapability: "message.retry_send",
    target: {
      entity: "message",
      idSource: "next_action_target_id",
      required: true,
      destination: "communication",
    },
    owner: {
      party: "administrator",
      strategy: "case_owner",
      capability: "message.retry_send",
    },
    due: {
      mode: "immediate",
      sources: ["message.updatedAt", "lead.nextActionAt"],
      policy: "message_recovery_sla",
    },
    blocker: {
      projection: "communication_failure",
      defaultCode: "MESSAGE_DELIVERY_FAILED",
    },
  },
  wait_customer: {
    processStage: "commercial",
    stagePolicy: "furthest_achieved",
    caseStateHint: "waiting",
    reasonCode: "QUOTE_SENT_AWAITING_CUSTOMER",
    reviewMode: "waiting",
    requiredCapability: "quote.read",
    target: {
      entity: "quote",
      idSource: "current_quote_id",
      required: true,
      destination: "quote_workbench",
    },
    owner: { party: "customer", strategy: "customer", capability: null },
    due: {
      mode: "wake_up",
      sources: ["lead.nextActionAt", "quote.validUntil"],
      policy: null,
    },
    blocker: { projection: "none", defaultCode: null },
  },
  wait_scheduled_start: {
    processStage: "work",
    stagePolicy: "furthest_achieved",
    caseStateHint: "waiting",
    reasonCode: "WORK_START_SCHEDULED",
    reviewMode: "waiting",
    requiredCapability: "work_order.read",
    target: {
      entity: "work_order",
      idSource: "next_action_target_id",
      required: true,
      destination: "work_order",
    },
    owner: {
      party: "worker",
      strategy: "assigned_worker",
      capability: null,
    },
    due: {
      mode: "wake_up",
      sources: ["workOrder.scheduledAt"],
      policy: null,
    },
    blocker: { projection: "none", defaultCode: null },
  },
  wait_worker_precheck: {
    processStage: "work",
    stagePolicy: "furthest_achieved",
    caseStateHint: "waiting",
    reasonCode: "WORKER_PRECHECK_IN_PROGRESS",
    reviewMode: "waiting",
    requiredCapability: "work_order.read",
    target: {
      entity: "work_order",
      idSource: "next_action_target_id",
      required: true,
      destination: "work_order",
    },
    owner: {
      party: "worker",
      strategy: "assigned_worker",
      capability: null,
    },
    due: {
      mode: "wake_up",
      sources: ["lead.nextActionAt", "workOrder.scheduledAt"],
      policy: null,
    },
    blocker: { projection: "none", defaultCode: null },
  },
  wait_work_completion: {
    processStage: "work",
    stagePolicy: "furthest_achieved",
    caseStateHint: "waiting",
    reasonCode: "WORK_IN_PROGRESS",
    reviewMode: "waiting",
    requiredCapability: "work_order.read",
    target: {
      entity: "work_order",
      idSource: "next_action_target_id",
      required: true,
      destination: "work_order",
    },
    owner: {
      party: "worker",
      strategy: "assigned_worker",
      capability: null,
    },
    due: {
      mode: "wake_up",
      sources: ["lead.nextActionAt", "workOrder.scheduledAt"],
      policy: null,
    },
    blocker: { projection: "none", defaultCode: null },
  },
  wait_worker_documentation: {
    processStage: "completion",
    stagePolicy: "furthest_achieved",
    caseStateHint: "waiting",
    reasonCode: "WORK_DOCUMENTATION_PENDING",
    reviewMode: "waiting",
    requiredCapability: "work_order.read",
    target: {
      entity: "work_order",
      idSource: "next_action_target_id",
      required: true,
      destination: "completion_review",
    },
    owner: {
      party: "worker",
      strategy: "assigned_worker",
      capability: null,
    },
    due: {
      mode: "wake_up",
      sources: ["lead.nextActionAt", "workOrder.completedAt"],
      policy: "worker_documentation_sla",
    },
    blocker: { projection: "none", defaultCode: null },
  },
} as const satisfies Record<CaseNextActionKind, CaseNextActionSemantics>;

const copy = {
  approve_measurement: {
    nb: {
      label: "Takmålingen venter på godkjenning",
      reason: "Målingen er et utkast eller krever faglig kontroll.",
      cta: "Kontroller og godkjenn takmålingen",
    },
    lt: {
      label: "Stogo matavimas laukia patvirtinimo",
      reason: "Matavimas yra juodraštis arba jam reikia specialisto patikros.",
      cta: "Peržiūrėti ir patvirtinti stogo matavimą",
    },
    en: {
      label: "Roof measurement awaits approval",
      reason: "The measurement is a draft or requires expert review.",
      cta: "Review and approve roof measurement",
    },
  },
  approve_package: {
    nb: {
      label: "Tilbudspakken venter på godkjenning",
      reason:
        "Måling, pris, tilbud og kontraktsutkast er klare for samlet kontroll.",
      cta: "Godkjenn og send hele tilbudspakken",
    },
    lt: {
      label: "Pasiūlymo paketas laukia patvirtinimo",
      reason:
        "Matavimas, kaina, pasiūlymas ir sutarties juodraštis parengti bendrai patikrai.",
      cta: "Patvirtinti ir išsiųsti visą pasiūlymo paketą",
    },
    en: {
      label: "Quote package awaits approval",
      reason:
        "The measurement, price, quote and contract draft are ready for one review.",
      cta: "Approve and send the complete quote package",
    },
  },
  approve_message: {
    nb: {
      label: "Meldingsutkastet venter på godkjenning",
      reason: "En utgående melding er lagret som utkast og er ikke sendt.",
      cta: "Godkjenn og send meldingen",
    },
    lt: {
      label: "Žinutės juodraštis laukia patvirtinimo",
      reason: "Išeinanti žinutė išsaugota kaip juodraštis ir dar neišsiųsta.",
      cta: "Patvirtinti ir siųsti žinutę",
    },
    en: {
      label: "Message draft awaits approval",
      reason: "An outbound message is saved as a draft and has not been sent.",
      cta: "Approve and send message",
    },
  },
  approve_quote: {
    nb: {
      label: "Tilbudet venter på godkjenning",
      reason:
        "Tilbudsversjonen er et utkast og må kontrolleres før utstedelse.",
      cta: "Kontroller og godkjenn tilbudet",
    },
    lt: {
      label: "Pasiūlymas laukia patvirtinimo",
      reason:
        "Pasiūlymo versija yra juodraštis ir turi būti patikrinta prieš išdavimą.",
      cta: "Peržiūrėti ir patvirtinti pasiūlymą",
    },
    en: {
      label: "Quote awaits approval",
      reason: "The quote version is a draft and must be reviewed before issue.",
      cta: "Review and approve quote",
    },
  },
  assign_worker: {
    nb: {
      label: "Arbeidsordren mangler medarbeider",
      reason: "Arbeidet er opprettet, men ingen medarbeider er ansvarlig.",
      cta: "Tildel medarbeider",
    },
    lt: {
      label: "Darbo užsakymui nepriskirtas darbuotojas",
      reason: "Darbas sukurtas, tačiau už jį dar neatsako joks darbuotojas.",
      cta: "Priskirti darbuotoją",
    },
    en: {
      label: "Work order has no assigned employee",
      reason: "The work exists, but no employee is responsible for it.",
      cta: "Assign employee",
    },
  },
  calculate_price: {
    nb: {
      label: "Godkjent måling mangler pris",
      reason: "Målingen er godkjent, men ingen gjeldende prisberegning finnes.",
      cta: "Beregn låst pris",
    },
    lt: {
      label: "Patvirtintas matavimas dar neturi kainos",
      reason:
        "Matavimas patvirtintas, tačiau nėra galiojančio kainos skaičiavimo.",
      cta: "Apskaičiuoti fiksuotą kainą",
    },
    en: {
      label: "Approved measurement has no price",
      reason:
        "The measurement is approved, but no current price calculation exists.",
      cta: "Calculate locked price",
    },
  },
  company_sign_contract: {
    nb: {
      label: "Kontrakten venter på selskapets signatur",
      reason: "Kunden har signert, men selskapets kontrasignatur mangler.",
      cta: "Kontroller og signer kontrakten",
    },
    lt: {
      label: "Sutartis laukia įmonės parašo",
      reason: "Klientas pasirašė, tačiau trūksta įmonės kontraparašo.",
      cta: "Patikrinti ir pasirašyti sutartį",
    },
    en: {
      label: "Contract awaits company signature",
      reason:
        "The customer has signed, but the company countersignature is missing.",
      cta: "Review and sign the contract",
    },
  },
  create_quote: {
    nb: {
      label: "Klar pris mangler tilbud",
      reason: "Prisberegningen er klar, men ingen tilbudsversjon er opprettet.",
      cta: "Opprett tilbud og kontraktsutkast",
    },
    lt: {
      label: "Parengta kaina dar neturi pasiūlymo",
      reason:
        "Kainos skaičiavimas parengtas, tačiau pasiūlymo versija nesukurta.",
      cta: "Sukurti pasiūlymą ir sutarties juodraštį",
    },
    en: {
      label: "Ready price has no quote",
      reason: "The price calculation is ready, but no quote version exists.",
      cta: "Create quote and contract draft",
    },
  },
  create_work_order: {
    nb: {
      label: "Signert kontrakt mangler arbeidsordre",
      reason: "Begge parter har signert, men arbeidet er ikke opprettet.",
      cta: "Opprett arbeidsordre",
    },
    lt: {
      label: "Pasirašyta sutartis dar neturi darbo užsakymo",
      reason: "Abi šalys pasirašė, tačiau darbas dar nesukurtas.",
      cta: "Sukurti darbo užsakymą",
    },
    en: {
      label: "Signed contract has no work order",
      reason: "Both parties have signed, but the work has not been created.",
      cta: "Create work order",
    },
  },
  generate_reply: {
    nb: {
      label: "Saken trenger et svarutkast",
      reason: "Ingen utgående svarmelding er klar for kunden.",
      cta: "Lag AI-svarutkast",
    },
    lt: {
      label: "Bylai reikia atsakymo juodraščio",
      reason: "Klientui dar nėra parengta išeinanti atsakymo žinutė.",
      cta: "Sukurti DI atsakymo juodraštį",
    },
    en: {
      label: "Case needs a reply draft",
      reason: "No outbound reply is ready for the customer.",
      cta: "Create AI reply draft",
    },
  },
  follow_up_decline: {
    nb: {
      label: "Kunden har avslått tilbudet",
      reason:
        "Avslaget må følges opp eller saken avsluttes med en begrunnelse.",
      cta: "Følg opp avslaget eller lukk saken",
    },
    lt: {
      label: "Klientas atsisakė pasiūlymo",
      reason: "Reikia susisiekti dėl atsisakymo arba pagrįstai uždaryti bylą.",
      cta: "Susisiekti dėl atsisakymo arba uždaryti bylą",
    },
    en: {
      label: "Customer declined the quote",
      reason:
        "The decline must be followed up or the case closed with a reason.",
      cta: "Follow up the decline or close the case",
    },
  },
  issue_quote: {
    nb: {
      label: "Godkjent tilbud mangler kundelenke",
      reason:
        "Tilbudet er godkjent, men kundelenke og meldingsutkast er ikke opprettet.",
      cta: "Opprett kundelenke og meldingsutkast",
    },
    lt: {
      label: "Patvirtintam pasiūlymui trūksta kliento nuorodos",
      reason:
        "Pasiūlymas patvirtintas, tačiau kliento nuoroda ir žinutės juodraštis nesukurti.",
      cta: "Sukurti kliento nuorodą ir žinutės juodraštį",
    },
    en: {
      label: "Approved quote has no customer link",
      reason:
        "The quote is approved, but its customer link and message draft do not exist.",
      cta: "Create customer link and message draft",
    },
  },
  measurement_required: {
    nb: {
      label: "Takmålingen trenger en manuell avklaring",
      reason: "Målingen er blokkert av manglende eller usikkert grunnlag.",
      cta: "Åpne eller fortsett takmålingen",
    },
    lt: {
      label: "Stogo matavimui reikia rankinio sprendimo",
      reason: "Matavimą blokuoja trūkstami arba nepatikimi duomenys.",
      cta: "Atverti arba tęsti stogo matavimą",
    },
    en: {
      label: "Roof measurement needs manual resolution",
      reason: "Missing or uncertain evidence is blocking the measurement.",
      cta: "Open or continue roof measurement",
    },
  },
  prepare_package: {
    nb: {
      label: "Grunnlaget må kontrolleres før tilbudspakken",
      reason:
        "Bekreft adresse og målegrunnlag først. Pris, tilbud og kontrakt kan bare forberedes når forutsetningene er kontrollert.",
      cta: "Kontroller grunnlaget og fortsett",
    },
    lt: {
      label: "Prieš pasiūlymo paketą būtina patikrinti pagrindą",
      reason:
        "Pirmiausia patvirtinkite adresą ir matavimo pagrindą. Kainą, pasiūlymą ir sutartį galima rengti tik patikrinus prielaidas.",
      cta: "Patikrinti pagrindą ir tęsti",
    },
    en: {
      label: "Verify the basis before preparing the quote package",
      reason:
        "Confirm the address and measurement basis first. Price, quote and contract may only be prepared after the prerequisites are verified.",
      cta: "Review prerequisites and continue",
    },
  },
  prepare_question_reply: {
    nb: {
      label: "Kundens spørsmål venter på svar",
      reason: "Et innkommende kundespørsmål har ikke et svarutkast.",
      cta: "Forbered svar på kundens spørsmål",
    },
    lt: {
      label: "Kliento klausimas laukia atsakymo",
      reason: "Gautas kliento klausimas dar neturi atsakymo juodraščio.",
      cta: "Parengti atsakymą į kliento klausimą",
    },
    en: {
      label: "Customer question awaits a reply",
      reason: "An inbound customer question has no reply draft.",
      cta: "Prepare a reply to the customer's question",
    },
  },
  review_cancellation: {
    nb: {
      label: "Kunden har bedt om endring eller kansellering",
      reason:
        "Forespørselen må vurderes før saken kan fortsette eller avsluttes.",
      cta: "Vurder endrings- eller kanselleringsforespørselen",
    },
    lt: {
      label: "Klientas paprašė pakeisti arba atšaukti",
      reason: "Prašymą būtina įvertinti prieš tęsiant arba uždarant bylą.",
      cta: "Peržiūrėti pakeitimo arba atšaukimo prašymą",
    },
    en: {
      label: "Customer requested a change or cancellation",
      reason:
        "The request must be reviewed before the case can continue or close.",
      cta: "Review change or cancellation request",
    },
  },
  review_completion: {
    nb: {
      label: "Ferdigdokumentasjonen venter på kontroll",
      reason:
        "Arbeidet er fullført og dokumentasjonen er levert for sluttkontroll.",
      cta: "Sluttkontroller arbeid og dokumentasjon",
    },
    lt: {
      label: "Užbaigimo dokumentai laukia patikros",
      reason: "Darbas baigtas, o dokumentai pateikti galutinei patikrai.",
      cta: "Atlikti galutinę darbo ir dokumentų patikrą",
    },
    en: {
      label: "Completion documentation awaits review",
      reason:
        "The work is complete and its documentation was submitted for final review.",
      cta: "Final-review work and documentation",
    },
  },
  resolve_work_block: {
    nb: {
      label: "Arbeidet er blokkert",
      reason: "Minst ett åpent hinder må løses før arbeidet kan fortsette.",
      cta: "Kontroller arbeidsblokkeringen",
    },
    lt: {
      label: "Darbas užblokuotas",
      reason: "Prieš tęsiant darbą reikia pašalinti bent vieną atvirą kliūtį.",
      cta: "Peržiūrėti darbo blokavimą",
    },
    en: {
      label: "Work is blocked",
      reason:
        "At least one open impediment must be resolved before work can continue.",
      cta: "Review the work block",
    },
  },
  schedule_work: {
    nb: {
      label: "Tildelt arbeid mangler tidspunkt",
      reason: "En medarbeider er valgt, men arbeidet er ikke planlagt.",
      cta: "Planlegg arbeidet",
    },
    lt: {
      label: "Priskirtas darbas dar nesuplanuotas",
      reason: "Darbuotojas parinktas, tačiau darbo laikas nenustatytas.",
      cta: "Suplanuoti darbą",
    },
    en: {
      label: "Assigned work has no schedule",
      reason: "An employee is assigned, but the work has not been scheduled.",
      cta: "Schedule the work",
    },
  },
  send_closure_confirmation: {
    nb: {
      label: "Avslutningsbekreftelsen venter på sending",
      reason:
        "Kanselleringsutfallet er klart, men kunden har ikke fått bekreftelsen.",
      cta: "Send avslutningsbekreftelsen til kunden",
    },
    lt: {
      label: "Uždarymo patvirtinimas laukia išsiuntimo",
      reason:
        "Atšaukimo sprendimas parengtas, tačiau klientas dar negavo patvirtinimo.",
      cta: "Išsiųsti uždarymo patvirtinimą klientui",
    },
    en: {
      label: "Closure confirmation awaits delivery",
      reason:
        "The cancellation outcome is ready, but the customer has not received confirmation.",
      cta: "Send the closure confirmation to the customer",
    },
  },
  none: {
    nb: {
      label: "Ingen handling nødvendig nå",
      reason: "Den avledede saksstatusen krever ingen primær handling.",
      cta: null,
    },
    lt: {
      label: "Dabar veiksmų nereikia",
      reason: "Išvestinė bylos būsena nereikalauja pirminio veiksmo.",
      cta: null,
    },
    en: {
      label: "No action required now",
      reason: "The derived case state requires no primary action.",
      cta: null,
    },
  },
  retry_message: {
    nb: {
      label: "Meldingsleveringen mislyktes",
      reason: "En utgående melding har feilet eller krever manuell oppfølging.",
      cta: "Prøv sendingen igjen",
    },
    lt: {
      label: "Žinutės pristatyti nepavyko",
      reason:
        "Išeinančios žinutės siuntimas nepavyko arba jam reikia rankinio dėmesio.",
      cta: "Pakartoti siuntimą",
    },
    en: {
      label: "Message delivery failed",
      reason: "An outbound message failed or requires manual attention.",
      cta: "Retry delivery",
    },
  },
  wait_customer: {
    nb: {
      label: "Venter på kundens beslutning",
      reason: "Tilbudet er sendt eller åpnet, og kunden eier neste steg.",
      cta: null,
    },
    lt: {
      label: "Laukiama kliento sprendimo",
      reason:
        "Pasiūlymas išsiųstas arba peržiūrėtas, o kitas žingsnis priklauso klientui.",
      cta: null,
    },
    en: {
      label: "Waiting for customer decision",
      reason:
        "The quote was sent or viewed, and the customer owns the next step.",
      cta: null,
    },
  },
  wait_scheduled_start: {
    nb: {
      label: "Venter på planlagt oppstart",
      reason: "Arbeidet er planlagt og starter på det avtalte tidspunktet.",
      cta: null,
    },
    lt: {
      label: "Laukiama suplanuotos darbo pradžios",
      reason: "Darbas suplanuotas ir prasidės sutartu laiku.",
      cta: null,
    },
    en: {
      label: "Waiting for scheduled start",
      reason: "The work is scheduled and will start at the agreed time.",
      cta: null,
    },
  },
  wait_worker_precheck: {
    nb: {
      label: "Medarbeideren gjennomfører stedskontroll",
      reason: "Den tildelte medarbeideren eier neste steg i feltprosessen.",
      cta: null,
    },
    lt: {
      label: "Darbuotojas atlieka objekto patikrą",
      reason: "Kitas lauko proceso žingsnis priklauso paskirtam darbuotojui.",
      cta: null,
    },
    en: {
      label: "Employee is completing the onsite check",
      reason: "The assigned employee owns the next step in the field process.",
      cta: null,
    },
  },
  wait_work_completion: {
    nb: {
      label: "Arbeidet pågår",
      reason: "Den tildelte medarbeideren utfører det avtalte arbeidet.",
      cta: null,
    },
    lt: {
      label: "Darbas vykdomas",
      reason: "Paskirtas darbuotojas vykdo sutartą darbą.",
      cta: null,
    },
    en: {
      label: "Work is in progress",
      reason: "The assigned employee is performing the agreed work.",
      cta: null,
    },
  },
  wait_worker_documentation: {
    nb: {
      label: "Venter på dokumentasjon fra medarbeider",
      reason:
        "Arbeidet er fullført, men nødvendig dokumentasjon er ikke levert.",
      cta: null,
    },
    lt: {
      label: "Laukiama darbuotojo dokumentų",
      reason: "Darbas baigtas, tačiau privalomi dokumentai dar nepateikti.",
      cta: null,
    },
    en: {
      label: "Waiting for employee documentation",
      reason:
        "The work is complete, but the required documentation has not been submitted.",
      cta: null,
    },
  },
} as const satisfies Record<
  CaseNextActionKind,
  Readonly<Record<CaseNextActionLocale, CaseNextActionCopy>>
>;

/**
 * The two exhaustive records above intentionally fail TypeScript compilation
 * when a resolver kind is added without semantics or localized copy.
 */
function combinePresentations(
  semanticRecords: Readonly<
    Record<CaseNextActionKind, CaseNextActionSemantics>
  >,
  copyRecords: Readonly<
    Record<
      CaseNextActionKind,
      Readonly<Record<CaseNextActionLocale, CaseNextActionCopy>>
    >
  >,
): Readonly<Record<CaseNextActionKind, CaseNextActionPresentation>> {
  const result = {} as Record<CaseNextActionKind, CaseNextActionPresentation>;
  for (const kind of Object.keys(semanticRecords) as CaseNextActionKind[]) {
    result[kind] = Object.freeze({
      ...semanticRecords[kind],
      copy: Object.freeze(copyRecords[kind]),
    });
  }
  return Object.freeze(result);
}

export const caseNextActionPresentations = combinePresentations(
  semantics,
  copy,
);

export const caseNextActionPresentationKinds = Object.freeze(
  Object.keys(caseNextActionPresentations) as CaseNextActionKind[],
);

export type LocalizedCaseNextActionPresentation = Omit<
  CaseNextActionPresentation,
  "copy"
> & { copy: CaseNextActionCopy };

export function getCaseNextActionPresentation(
  kind: CaseNextActionKind,
  locale: CaseNextActionLocale = "nb",
): LocalizedCaseNextActionPresentation {
  const presentation = caseNextActionPresentations[kind];
  const { copy: localizedCopy, ...semanticPresentation } = presentation;
  return { ...semanticPresentation, copy: localizedCopy[locale] };
}
