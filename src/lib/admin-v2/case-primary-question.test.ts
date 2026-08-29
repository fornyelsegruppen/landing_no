import { describe, expect, it } from "vitest";
import { selectPrimaryCustomerQuestion } from "./case-primary-question";

describe("primary customer question selection", () => {
  it("hides delivered question evidence when the customer declined", () => {
    const delivered = { id: 17, stage: "delivered" };

    expect(
      selectPrimaryCustomerQuestion({
        latest: delivered,
        nextActionKind: "follow_up_decline",
      }),
    ).toBeNull();
  });

  it("lets the decline state outrank an unresolved earlier question", () => {
    const unresolved = { id: 18, stage: "review" };

    expect(
      selectPrimaryCustomerQuestion({
        latest: unresolved,
        nextActionKind: "follow_up_decline",
        unresolved,
      }),
    ).toBeNull();
  });

  it("keeps the unresolved question primary in the normal flow", () => {
    const unresolved = { id: 18, stage: "review" };
    const delivered = { id: 17, stage: "delivered" };

    expect(
      selectPrimaryCustomerQuestion({
        latest: delivered,
        nextActionKind: "prepare_question_reply",
        unresolved,
      }),
    ).toBe(unresolved);
  });
});
