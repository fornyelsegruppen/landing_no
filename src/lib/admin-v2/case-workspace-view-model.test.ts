import { describe, expect, it } from "vitest";
import type { CaseNextActionKind, AdminCase } from "./case-read-model";
import {
  caseWorkspaceActionPresentation,
  caseWorkspacePriorityRank,
  deriveCaseWorkspacePrimaryState,
  deriveCaseWorkspaceProcessStage,
  toCaseWorkspaceQuestionContext,
  type CaseWorkspaceQuestionContext,
} from "./case-workspace-view-model";

const allActionKinds = [
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

function makeCase(
  kind: CaseNextActionKind,
  overrides: Partial<AdminCase> = {},
): AdminCase {
  const base: AdminCase = {
    changes: [],
    commercial: {} as AdminCase["commercial"],
    contractRequests: [],
    documents: [],
    lead: {
      address: "Testveien 1",
      id: 17,
      name: "Test customer",
      nextActionOverdue: false,
      recordState: "active",
      revision: 1,
    },
    messages: [],
    nextAction: { kind },
    officialInvoices: [],
    quoteOptions: [],
    timeline: [],
  };
  return {
    ...base,
    ...overrides,
    lead: { ...base.lead, ...overrides.lead },
  };
}

function question(
  stage: CaseWorkspaceQuestionContext["stage"],
  recovery?: CaseWorkspaceQuestionContext["recovery"],
): CaseWorkspaceQuestionContext {
  return {
    documentReferences: ["T-17-V1", "K-17-V1"],
    question: {
      createdAt: "2026-08-29T12:00:00.000Z",
      id: 101,
      reference: "Question #101",
      subject: "Question about the quote",
    },
    recovery,
    reply: stage === "prepare" ? null : { id: 102 },
    stage,
  };
}

function failedMessage(id = 301) {
  return {
    bodyText: "Failed body",
    category: "customer_reply",
    channel: "email",
    direction: "outbound",
    failureCode: "provider_rejected",
    href: `#message-${id}`,
    id,
    reference: `Message #${id}`,
    status: "failed",
    subject: "Failed reply",
  };
}

describe("deriveCaseWorkspacePrimaryState", () => {
  it("adapts the exact uncapped question thread with existing stage helpers", () => {
    const context = toCaseWorkspaceQuestionContext({
      question: {
        aiAnalysis: {
          quoteReference: "T-17-V1",
          contractReference: "K-17-V1",
        },
        aiAssisted: false,
        bodyText: "Question",
        id: 101,
        subject: "Question about the quote",
      },
      reply: {
        aiAssisted: true,
        bodyText: "Reply",
        id: 102,
        status: "sent",
        subject: "Reply",
      },
    });

    expect(context).toMatchObject({
      documentReferences: ["T-17-V1", "K-17-V1"],
      stage: "sent",
    });
  });

  it("has one presentation result for every CaseNextActionKind", () => {
    expect(Object.keys(caseWorkspaceActionPresentation).sort()).toEqual(
      [...allActionKinds].sort(),
    );

    for (const kind of allActionKinds) {
      const result = deriveCaseWorkspacePrimaryState(makeCase(kind));
      expect(result.key).toBeTruthy();
      expect(result.titleKey).toBe(`actions.${kind}`);
      expect(result.processStage).toBe(
        caseWorkspaceActionPresentation[kind].processStage,
      );
      expect(result.priorityRank).toBe(
        caseWorkspacePriorityRank[result.priority],
      );
    }
  });

  it("gives archived and trashed lifecycle states the highest priority", () => {
    for (const recordState of ["archived", "trashed"] as const) {
      const result = deriveCaseWorkspacePrimaryState(
        makeCase("approve_message", {
          lead: {
            ...makeCase("none").lead,
            recordState,
          },
        }),
        question("review"),
      );
      expect(result.key).toBe(`lifecycle.${recordState}`);
      expect(result.priority).toBe("lifecycle");
      expect(result.action).toEqual({
        mode: "panel",
        panel: "lifecycle",
      });
    }
  });

  it("makes cancellation outrank an unresolved customer question", () => {
    const result = deriveCaseWorkspacePrimaryState(
      makeCase("approve_quote", {
        lead: {
          ...makeCase("none").lead,
          nextActionBlocker: "CUSTOMER_CANCELLATION_REQUEST",
        },
      }),
      question("review"),
    );

    expect(result.key).toBe("stop.review_cancellation");
    expect(result.priority).toBe("stop");
    expect(result.tone).toBe("critical");
    expect(result.blocker?.code).toBe("CUSTOMER_CANCELLATION_REQUEST");
  });

  it("selects the structured cancellation panel without fragment navigation", () => {
    const result = deriveCaseWorkspacePrimaryState(
      makeCase("review_cancellation", {
        contractRequests: [
          {
            followUpConsent: false,
            href: "/admin/collections/customer-contract-requests/9",
            id: 9,
            kind: "withdrawal",
            reasonCode: "prefer_not_to_say",
            receivedAt: "2026-08-29T12:00:00.000Z",
            recoveryPotential: "yellow",
            reference: "ANG-17-V1",
            status: "admin_review",
          },
        ],
      }),
    );

    expect(result.action).toEqual({
      mode: "panel",
      panel: "cancellation",
    });
  });

  it("never moves achieved process milestones backwards for late blockers", () => {
    const caseData = makeCase("retry_message", {
      contract: {
        href: "/admin/collections/contracts/4",
        id: 4,
        reference: "K-17-V1",
        status: "signed",
      },
      workOrder: {
        afterPhotoCount: 0,
        beforePhotoCount: 0,
        blockingReasons: [],
        href: "/admin/collections/work-orders/5",
        id: 5,
        reference: "W-17-V1",
        status: "in_progress",
        workSummary: "Takvask",
      },
    });

    expect(deriveCaseWorkspaceProcessStage(caseData, "contact")).toBe("work");
  });

  it("makes a declined quote outrank an old unresolved question", () => {
    const result = deriveCaseWorkspacePrimaryState(
      makeCase("follow_up_decline"),
      question("prepare"),
    );

    expect(result.key).toBe("stop.follow_up_decline");
    expect(result.statusLabelKey).toBe("statuses.declined");
    expect(result.tone).toBe("critical");
    expect(result.blocker?.labelKey).toBe("blockers.declined");
  });

  it("makes an unresolved question outrank an unrelated failed message", () => {
    const result = deriveCaseWorkspacePrimaryState(
      makeCase("approve_quote", { messages: [failedMessage()] }),
      question("prepare"),
    );

    expect(result.key).toBe("question.prepare");
    expect(result.priority).toBe("question");
  });

  it.each([
    ["prepare", "warning", "question"],
    ["review", "warning", "question"],
    ["queued", "waiting", "question"],
    ["sent", "waiting", "question"],
    ["delivery_failed", "critical", "question"],
  ] as const)(
    "maps question stage %s to tone %s without another primary action",
    (stage, tone, priority) => {
      const result = deriveCaseWorkspacePrimaryState(
        makeCase("approve_quote"),
        question(stage),
      );
      expect(result.key).toBe(`question.${stage}`);
      expect(result.tone).toBe(tone);
      expect(result.priority).toBe(priority);
      expect(result.action.mode).toBe(
        stage === "queued" || stage === "sent" ? "wait" : "question",
      );
    },
  );

  it("lets a delivered question release the normal business action", () => {
    const result = deriveCaseWorkspacePrimaryState(
      makeCase("approve_quote"),
      question("delivered"),
    );

    expect(result.key).toBe("action.approve_quote");
    expect(result.action).toMatchObject({
      kind: "approve_quote",
      mode: "mutation",
    });
    expect(result.tone).toBe("action");
  });

  it("uses delivered success as evidence only when there is no business action", () => {
    const result = deriveCaseWorkspacePrimaryState(
      makeCase("none"),
      question("delivered"),
    );

    expect(result.key).toBe("question.delivered");
    expect(result.tone).toBe("success");
    expect(result.blocker).toBeUndefined();
    expect(result.action).toEqual({ mode: "wait" });
  });

  it("promotes an unrelated delivery failure above a normal action", () => {
    const result = deriveCaseWorkspacePrimaryState(
      makeCase("approve_quote", { messages: [failedMessage()] }),
    );

    expect(result.key).toBe("communication.delivery_failed");
    expect(result.priority).toBe("communication");
    expect(result.tone).toBe("critical");
    expect(result.action).toEqual({
      kind: "retry_message",
      mode: "mutation",
      targetId: 301,
    });
  });

  it.each([
    ["source_changed", "critical"],
    ["safety_rejected", "critical"],
    ["stale_revision", "critical"],
    ["ai_unavailable", "warning"],
  ] as const)("maps typed recovery %s to a safe tone", (recovery, tone) => {
    const result = deriveCaseWorkspacePrimaryState(
      makeCase("approve_quote"),
      question("review", recovery),
    );
    expect(result.key).toBe(`question.${recovery}`);
    expect(result.tone).toBe(tone);
    expect(result.action.mode).toBe("question");
  });

  it("keeps blocked, waiting, successful and actionable meanings distinct", () => {
    const blocked = deriveCaseWorkspacePrimaryState(
      makeCase("resolve_work_block"),
    );
    const waiting = deriveCaseWorkspacePrimaryState(makeCase("wait_customer"));
    const success = deriveCaseWorkspacePrimaryState(
      makeCase("none"),
      question("delivered"),
    );
    const actionable = deriveCaseWorkspacePrimaryState(
      makeCase("calculate_price"),
    );

    expect([blocked.tone, waiting.tone, success.tone, actionable.tone]).toEqual(
      ["critical", "waiting", "success", "action"],
    );
  });
});
