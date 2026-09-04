import { describe, expect, it } from "vitest";
import type { CaseNextActionKind } from "./case-read-model";
import {
  caseNextActionPresentationKinds,
  caseNextActionPresentations,
  getCaseNextActionPresentation,
  type CaseNextActionCapability,
  type CaseNextActionOwnerParty,
  type CaseNextActionProcessStage,
  type CaseNextActionReasonCode,
  type CaseNextActionReviewMode,
  type CaseNextActionTargetEntity,
} from "./case-next-action-presentation";

const expectedKinds = [
  "approve_measurement",
  "approve_package",
  "approve_message",
  "approve_quote",
  "assign_worker",
  "calculate_price",
  "company_sign_contract",
  "create_quote",
  "create_work_order",
  "generate_reply",
  "follow_up_decline",
  "issue_quote",
  "measurement_required",
  "prepare_package",
  "prepare_question_reply",
  "review_cancellation",
  "review_completion",
  "resolve_work_block",
  "schedule_work",
  "send_closure_confirmation",
  "none",
  "retry_message",
  "wait_customer",
  "wait_scheduled_start",
  "wait_worker_precheck",
  "wait_work_completion",
  "wait_worker_documentation",
] as const satisfies readonly CaseNextActionKind[];

type ExpectedSemantics = {
  stage: CaseNextActionProcessStage;
  reason: CaseNextActionReasonCode;
  review: CaseNextActionReviewMode;
  target: CaseNextActionTargetEntity;
  owner: CaseNextActionOwnerParty;
  capability: CaseNextActionCapability;
  hasCta: boolean;
};

const expectedSemantics = {
  approve_measurement: {
    stage: "evidence",
    reason: "MEASUREMENT_REVIEW_REQUIRED",
    review: "review_and_commit",
    target: "measurement",
    owner: "administrator",
    capability: "measurement.review_approve",
    hasCta: true,
  },
  approve_package: {
    stage: "commercial",
    reason: "COMMERCIAL_PACKAGE_REVIEW_REQUIRED",
    review: "review_and_commit",
    target: "commercial_package",
    owner: "administrator",
    capability: "commercial.package.approve_send",
    hasCta: true,
  },
  approve_message: {
    stage: "inquiry",
    reason: "MESSAGE_DRAFT_READY",
    review: "review_and_commit",
    target: "message",
    owner: "administrator",
    capability: "message.approve_send",
    hasCta: true,
  },
  approve_quote: {
    stage: "commercial",
    reason: "QUOTE_DRAFT_REVIEW_REQUIRED",
    review: "review_and_commit",
    target: "quote",
    owner: "administrator",
    capability: "quote.approve",
    hasCta: true,
  },
  assign_worker: {
    stage: "work",
    reason: "WORK_ORDER_UNASSIGNED",
    review: "guided",
    target: "work_order",
    owner: "administrator",
    capability: "work_order.assign",
    hasCta: true,
  },
  calculate_price: {
    stage: "commercial",
    reason: "MEASUREMENT_APPROVED_PRICE_MISSING",
    review: "review_and_commit",
    target: "measurement",
    owner: "administrator",
    capability: "price.calculate",
    hasCta: true,
  },
  company_sign_contract: {
    stage: "agreement",
    reason: "COMPANY_COUNTERSIGNATURE_REQUIRED",
    review: "review_and_commit",
    target: "contract",
    owner: "administrator",
    capability: "contract.company_sign",
    hasCta: true,
  },
  create_quote: {
    stage: "commercial",
    reason: "PRICE_READY_QUOTE_MISSING",
    review: "review_and_commit",
    target: "price_calculation",
    owner: "administrator",
    capability: "quote.create",
    hasCta: true,
  },
  create_work_order: {
    stage: "work",
    reason: "SIGNED_CONTRACT_WORK_ORDER_MISSING",
    review: "guided",
    target: "contract",
    owner: "administrator",
    capability: "work_order.create",
    hasCta: true,
  },
  generate_reply: {
    stage: "inquiry",
    reason: "CUSTOMER_REPLY_DRAFT_REQUIRED",
    review: "inline",
    target: "case",
    owner: "administrator",
    capability: "case.reply.prepare",
    hasCta: true,
  },
  follow_up_decline: {
    stage: "commercial",
    reason: "QUOTE_DECLINED",
    review: "danger",
    target: "quote",
    owner: "administrator",
    capability: "quote.decline.resolve",
    hasCta: true,
  },
  issue_quote: {
    stage: "commercial",
    reason: "QUOTE_APPROVED_NOT_ISSUED",
    review: "review_and_commit",
    target: "quote",
    owner: "administrator",
    capability: "quote.issue",
    hasCta: true,
  },
  measurement_required: {
    stage: "evidence",
    reason: "MEASUREMENT_BLOCKED",
    review: "guided",
    target: "measurement",
    owner: "administrator",
    capability: "measurement.resolve",
    hasCta: true,
  },
  prepare_package: {
    stage: "evidence",
    reason: "COMMERCIAL_PACKAGE_PREPARATION_REQUIRED",
    review: "inline",
    target: "case",
    owner: "administrator",
    capability: "commercial.package.prepare",
    hasCta: true,
  },
  prepare_question_reply: {
    stage: "inquiry",
    reason: "CUSTOMER_QUESTION_RECEIVED",
    review: "inline",
    target: "message",
    owner: "administrator",
    capability: "case.question.reply.prepare",
    hasCta: true,
  },
  review_cancellation: {
    stage: "agreement",
    reason: "CUSTOMER_CANCELLATION_REQUEST",
    review: "danger",
    target: "customer_contract_request",
    owner: "administrator",
    capability: "case.cancellation.review",
    hasCta: true,
  },
  review_completion: {
    stage: "completion",
    reason: "WORK_DOCUMENTATION_REVIEW_REQUIRED",
    review: "review_and_commit",
    target: "work_order",
    owner: "administrator",
    capability: "work_order.completion.review",
    hasCta: true,
  },
  resolve_work_block: {
    stage: "work",
    reason: "WORK_ORDER_BLOCKED",
    review: "danger",
    target: "work_order",
    owner: "administrator",
    capability: "work_order.block.resolve",
    hasCta: true,
  },
  schedule_work: {
    stage: "work",
    reason: "WORK_ORDER_UNSCHEDULED",
    review: "guided",
    target: "work_order",
    owner: "administrator",
    capability: "work_order.schedule",
    hasCta: true,
  },
  send_closure_confirmation: {
    stage: "agreement",
    reason: "CLOSURE_CONFIRMATION_DRAFT_READY",
    review: "danger",
    target: "message",
    owner: "administrator",
    capability: "message.closure.approve_send",
    hasCta: true,
  },
  none: {
    stage: "inquiry",
    reason: "NO_ACTION_REQUIRED",
    review: "none",
    target: "case",
    owner: "none",
    capability: "case.read",
    hasCta: false,
  },
  retry_message: {
    stage: "inquiry",
    reason: "MESSAGE_DELIVERY_FAILED",
    review: "review_and_commit",
    target: "message",
    owner: "administrator",
    capability: "message.retry_send",
    hasCta: true,
  },
  wait_customer: {
    stage: "commercial",
    reason: "QUOTE_SENT_AWAITING_CUSTOMER",
    review: "waiting",
    target: "quote",
    owner: "customer",
    capability: "quote.read",
    hasCta: false,
  },
  wait_scheduled_start: {
    stage: "work",
    reason: "WORK_START_SCHEDULED",
    review: "waiting",
    target: "work_order",
    owner: "worker",
    capability: "work_order.read",
    hasCta: false,
  },
  wait_worker_precheck: {
    stage: "work",
    reason: "WORKER_PRECHECK_IN_PROGRESS",
    review: "waiting",
    target: "work_order",
    owner: "worker",
    capability: "work_order.read",
    hasCta: false,
  },
  wait_work_completion: {
    stage: "work",
    reason: "WORK_IN_PROGRESS",
    review: "waiting",
    target: "work_order",
    owner: "worker",
    capability: "work_order.read",
    hasCta: false,
  },
  wait_worker_documentation: {
    stage: "completion",
    reason: "WORK_DOCUMENTATION_PENDING",
    review: "waiting",
    target: "work_order",
    owner: "worker",
    capability: "work_order.read",
    hasCta: false,
  },
} as const satisfies Record<CaseNextActionKind, ExpectedSemantics>;

describe("case next-action presentation", () => {
  it("is compile-time and runtime complete for all 27 resolver kinds", () => {
    const expected = [...expectedKinds].sort();
    const actual = [...caseNextActionPresentationKinds].sort();

    expect(expectedKinds).toHaveLength(27);
    expect(new Set(expectedKinds)).toHaveLength(27);
    expect(actual).toEqual(expected);
    expect(Object.keys(caseNextActionPresentations).sort()).toEqual(expected);
  });

  it.each(expectedKinds)("keeps the complete semantics for %s", (kind) => {
    const presentation = caseNextActionPresentations[kind];
    const expected = expectedSemantics[kind];

    expect(presentation).toMatchObject({
      processStage: expected.stage,
      reasonCode: expected.reason,
      reviewMode: expected.review,
      requiredCapability: expected.capability,
      target: { entity: expected.target },
      owner: { party: expected.owner },
    });
    expect(Boolean(presentation.copy.nb.cta)).toBe(expected.hasCta);
    expect(Boolean(presentation.copy.lt.cta)).toBe(expected.hasCta);
    expect(Boolean(presentation.copy.en.cta)).toBe(expected.hasCta);
  });

  it.each(expectedKinds)("has usable NB, LT and EN copy for %s", (kind) => {
    const presentation = caseNextActionPresentations[kind];

    for (const locale of ["nb", "lt", "en"] as const) {
      const localized = getCaseNextActionPresentation(kind, locale);
      expect(localized.copy.label.trim().length).toBeGreaterThan(3);
      expect(localized.copy.reason.trim().length).toBeGreaterThan(3);
      expect(localized.copy).toEqual(presentation.copy[locale]);
    }
  });

  it("does not expose a primary command CTA for waiting or no-action states", () => {
    const passiveKinds = [
      "none",
      "wait_customer",
      "wait_scheduled_start",
      "wait_worker_precheck",
      "wait_work_completion",
      "wait_worker_documentation",
    ] as const satisfies readonly CaseNextActionKind[];

    for (const kind of passiveKinds) {
      const presentation = caseNextActionPresentations[kind];
      expect(presentation.copy.nb.cta).toBeNull();
      expect(presentation.copy.lt.cta).toBeNull();
      expect(presentation.copy.en.cta).toBeNull();
      expect(["waiting", "none"]).toContain(presentation.reviewMode);
    }
  });

  it("keeps waiting ownership and wake-up time separate from blockers", () => {
    const waitingKinds = expectedKinds.filter(
      (kind) => caseNextActionPresentations[kind].reviewMode === "waiting",
    );

    expect(waitingKinds).toHaveLength(5);
    for (const kind of waitingKinds) {
      const presentation = caseNextActionPresentations[kind];
      expect(presentation.caseStateHint).toBe("waiting");
      expect(presentation.due.mode).toBe("wake_up");
      expect(presentation.blocker.projection).toBe("none");
      expect(["customer", "worker", "system"]).toContain(
        presentation.owner.party,
      );
    }
  });

  it("normalizes the four current hard blocker and recovery families", () => {
    expect(caseNextActionPresentations.retry_message.blocker).toEqual({
      projection: "communication_failure",
      defaultCode: "MESSAGE_DELIVERY_FAILED",
    });
    expect(caseNextActionPresentations.measurement_required.blocker).toEqual({
      projection: "measurement_blocking_reasons",
      defaultCode: "MEASUREMENT_BLOCK_REASON_MISSING",
    });
    expect(caseNextActionPresentations.review_cancellation.blocker).toEqual({
      projection: "cancellation_request",
      defaultCode: "CUSTOMER_CANCELLATION_REQUEST",
    });
    expect(caseNextActionPresentations.resolve_work_block.blocker).toEqual({
      projection: "work_order_blocking_reasons",
      defaultCode: "WORK_ORDER_BLOCKED",
    });
  });

  it("makes the current target gaps explicit for later adapters", () => {
    expect(caseNextActionPresentations.approve_package.target).toMatchObject({
      entity: "commercial_package",
      idSource: "commercial_context",
    });
    expect(
      caseNextActionPresentations.review_cancellation.target,
    ).toMatchObject({
      entity: "customer_contract_request",
      idSource: "active_contract_request_id",
    });
    expect(caseNextActionPresentations.wait_customer.target).toMatchObject({
      entity: "quote",
      idSource: "current_quote_id",
    });
  });

  it("describes quote issue as link and draft creation, not message delivery", () => {
    expect(caseNextActionPresentations.issue_quote.copy.nb.cta).toContain(
      "kundelenke",
    );
    expect(caseNextActionPresentations.issue_quote.copy.lt.cta).toContain(
      "nuorodą",
    );
    expect(caseNextActionPresentations.issue_quote.copy.en.cta).toContain(
      "link",
    );
    expect(caseNextActionPresentations.issue_quote.copy.en.cta).not.toMatch(
      /^send\b/iu,
    );
  });

  it("keeps no-action state contextual instead of claiming completion", () => {
    expect(caseNextActionPresentations.none).toMatchObject({
      caseStateHint: "derive_from_case",
      processStage: "inquiry",
      stagePolicy: "achieved_only",
      due: { mode: "none", sources: [], policy: null },
      owner: { party: "none", strategy: "none", capability: null },
    });
  });
});
