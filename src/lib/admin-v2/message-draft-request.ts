export type MessageDraftAction =
  | "cancel_draft"
  | "polish_reply"
  | "save_draft"
  | "regenerate_reply"
  | "approve_send";

export function messageDraftRequest(
  action: MessageDraftAction,
  input: {
    bodyText: string;
    caseRevision: number;
    messageId: number;
    messageUpdatedAt: string;
    subject: string;
  },
) {
  if (action === "approve_send") {
    return {
      action,
      messageId: input.messageId,
      subject: input.subject,
      bodyText: input.bodyText,
      expectedMessageUpdatedAt: input.messageUpdatedAt,
      expectedCaseRevision: input.caseRevision,
    };
  }
  if (action === "save_draft") {
    return {
      action,
      messageId: input.messageId,
      subject: input.subject,
      bodyText: input.bodyText,
      expectedMessageUpdatedAt: input.messageUpdatedAt,
    };
  }
  if (action === "polish_reply") {
    return {
      action,
      messageId: input.messageId,
      subject: input.subject,
      bodyText: input.bodyText,
    };
  }
  return { action, messageId: input.messageId };
}
