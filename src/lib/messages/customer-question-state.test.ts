import { describe, expect, it } from "vitest";
import { selectUnresolvedCustomerQuestion } from "./customer-question-state";

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

  it("resolves a question only after its direct reply is sent", () => {
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

    expect(result).toBeNull();
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
});
