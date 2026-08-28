import { describe, expect, it } from "vitest";
import { messageDraftRequest } from "./message-draft-request";

const input = {
  bodyText: "Dette er administratorens kontrollerte svar til kunden.",
  caseRevision: 7,
  messageId: 42,
  messageUpdatedAt: "2026-08-28T09:30:00.000Z",
  subject: "Svar på spørsmålet ditt",
};

describe("message draft requests", () => {
  it("sends edited content and both revisions in one atomic approval request", () => {
    expect(messageDraftRequest("approve_send", input)).toEqual({
      action: "approve_send",
      messageId: 42,
      subject: input.subject,
      bodyText: input.bodyText,
      expectedMessageUpdatedAt: input.messageUpdatedAt,
      expectedCaseRevision: 7,
    });
  });

  it("guards an ordinary draft save with the current message revision", () => {
    expect(messageDraftRequest("save_draft", input)).toEqual({
      action: "save_draft",
      messageId: 42,
      subject: input.subject,
      bodyText: input.bodyText,
      expectedMessageUpdatedAt: input.messageUpdatedAt,
    });
  });
});
