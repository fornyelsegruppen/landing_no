import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  customerQuestionState,
  customerQuestionDocumentReferences,
  customerQuestionReplyStage,
  loadCustomerQuestionState,
  loadUnresolvedCustomerQuestion,
  selectLatestCustomerQuestion,
  selectUnresolvedCustomerQuestion,
} from "./customer-question-state";

describe("customer question state", () => {
  const question = {
    id: 10,
    category: "customer_question",
    direction: "inbound",
    status: "delivered",
    createdAt: "2026-08-28T08:00:00.000Z",
  };

  it("keeps a question unresolved while its reply is only a draft", () => {
    const result = selectUnresolvedCustomerQuestion([
      question,
      {
        id: 11,
        category: "ai_reply",
        direction: "outbound",
        status: "draft",
        replyToMessage: 10,
        createdAt: "2026-08-28T08:01:00.000Z",
      },
    ]);

    expect(result?.question.id).toBe(10);
    expect(result?.reply?.id).toBe(11);
  });

  it("connects a draft from the admin case read model to its question", () => {
    const result = selectUnresolvedCustomerQuestion([
      question,
      {
        id: 11,
        category: "ai_reply",
        direction: "outbound",
        status: "draft",
        replyToMessageId: 10,
        createdAt: "2026-08-28T08:01:00.000Z",
      },
    ]);

    expect(result?.question.id).toBe(10);
    expect(result?.reply?.id).toBe(11);
  });

  it("keeps a question unresolved while its direct reply is only accepted for sending", () => {
    const result = selectUnresolvedCustomerQuestion([
      question,
      {
        id: 12,
        category: "ai_reply",
        direction: "outbound",
        status: "sent",
        replyToMessage: { id: 10 },
        createdAt: "2026-08-28T08:02:00.000Z",
      },
    ]);

    expect(result?.question.id).toBe(10);
  });

  it("resolves a question only after its direct reply is confirmed delivered", () => {
    const result = selectUnresolvedCustomerQuestion([
      question,
      {
        id: 12,
        category: "ai_reply",
        direction: "outbound",
        status: "delivered",
        replyToMessage: { id: 10 },
        createdAt: "2026-08-28T08:02:00.000Z",
      },
    ]);

    expect(result).toBeNull();
  });

  it("exposes persistent none, pending and resolved customer states", () => {
    const draftReply = {
      id: 11,
      category: "ai_reply",
      direction: "outbound",
      status: "draft",
      replyToMessage: 10,
      createdAt: "2026-08-28T08:01:00.000Z",
    };
    const deliveredReply = {
      ...draftReply,
      id: 12,
      status: "delivered",
      createdAt: "2026-08-28T08:02:00.000Z",
    };

    expect(customerQuestionState([]).status).toBe("none");
    expect(customerQuestionState([question, draftReply]).status).toBe(
      "pending",
    );
    expect(customerQuestionState([question, deliveredReply]).status).toBe(
      "resolved",
    );
  });

  it("does not resolve one question with a reply to another question", () => {
    const result = selectUnresolvedCustomerQuestion([
      question,
      {
        id: 13,
        category: "ai_reply",
        direction: "outbound",
        status: "sent",
        replyToMessage: 9,
        createdAt: "2026-08-28T08:02:00.000Z",
      },
    ]);

    expect(result?.question.id).toBe(10);
  });

  it("keeps a bounced direct reply unresolved", () => {
    const result = selectUnresolvedCustomerQuestion([
      question,
      {
        id: 14,
        category: "ai_reply",
        direction: "outbound",
        status: "attention",
        replyToMessage: 10,
        createdAt: "2026-08-28T08:02:00.000Z",
      },
    ]);

    expect(result?.question.id).toBe(10);
  });

  it("queries exact question and direct-reply sets instead of capped case history", async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [question] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 12,
            category: "ai_reply",
            direction: "outbound",
            status: "delivered",
            replyToMessage: 10,
            createdAt: "2026-08-28T08:02:00.000Z",
          },
        ],
      });

    const result = await loadUnresolvedCustomerQuestion(
      { find } as unknown as Payload,
      7,
    );

    expect(result).toBeNull();
    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pagination: false,
        where: {
          and: expect.arrayContaining([
            { lead: { equals: 7 } },
            { category: { equals: "customer_question" } },
          ]),
        },
      }),
    );
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pagination: false,
        where: {
          and: expect.arrayContaining([
            { replyToMessage: { in: [10] } },
            { status: { not_equals: "cancelled" } },
          ]),
        },
      }),
    );
    expect(find.mock.calls.every(([query]) => query.limit === undefined)).toBe(
      true,
    );
  });

  it("loads the delivered state needed after a customer page reload", async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [question] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 12,
            category: "ai_reply",
            direction: "outbound",
            status: "delivered",
            replyToMessage: 10,
            createdAt: "2026-08-28T08:02:00.000Z",
          },
        ],
      });

    const state = await loadCustomerQuestionState(
      { find } as unknown as Payload,
      7,
    );

    expect(state.status).toBe("resolved");
    expect(state.unresolved).toBeNull();
    expect(state.latest?.question.id).toBe(10);
    expect(state.latest?.reply?.status).toBe("delivered");
  });

  it.each([
    [undefined, "prepare"],
    ["draft", "review"],
    ["queued", "queued"],
    ["sent", "sent"],
    ["delivered", "delivered"],
    ["failed", "delivery_failed"],
    ["attention", "delivery_failed"],
    ["cancelled", "prepare"],
  ])("maps reply status %s to the admin stage %s", (status, expected) => {
    expect(customerQuestionReplyStage(status ? { status } : null)).toBe(
      expected,
    );
  });

  it("uses the immutable references captured on the customer question", () => {
    expect(
      customerQuestionDocumentReferences({
        aiAnalysis: {
          quoteReference: "T-16-V2",
          contractReference: "K-16-V2",
        },
      }),
    ).toEqual(["T-16-V2", "K-16-V2"]);
  });

  it("keeps the latest completed question available for delivered-state feedback", () => {
    const deliveredReply = {
      id: 13,
      category: "ai_reply",
      direction: "outbound",
      status: "delivered",
      replyToMessage: 10,
      createdAt: "2026-08-28T10:05:00.000Z",
    };

    expect(
      selectUnresolvedCustomerQuestion([question, deliveredReply]),
    ).toBeNull();
    expect(selectLatestCustomerQuestion([question, deliveredReply])).toEqual({
      question,
      reply: deliveredReply,
    });
  });
});
