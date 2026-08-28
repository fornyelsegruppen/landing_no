export type CustomerReplyRecoveryKind =
  | "ai_unavailable"
  | "refresh"
  | "safety_rejected"
  | "source_changed"
  | "unknown";

export type CustomerReplyFailure = {
  code?: string;
  error?: string;
};

export function customerReplyRecoveryKind(
  failure: CustomerReplyFailure,
): CustomerReplyRecoveryKind {
  if (
    failure.code === "CASE_REVISION_CONFLICT" ||
    failure.code === "MESSAGE_REVISION_CONFLICT"
  ) {
    return "refresh";
  }
  if (failure.code === "CUSTOMER_REPLY_SOURCE_CHANGED") {
    return "source_changed";
  }
  if (failure.code === "CUSTOMER_REPLY_SAFETY_REJECTED") {
    return "safety_rejected";
  }

  const error = failure.error?.toLowerCase() || "";
  if (
    error.includes("documents, prices or active company terms changed") ||
    error.includes("bound source changed")
  ) {
    return "source_changed";
  }
  if (
    error.includes("ai reply") ||
    error.includes("approved quote snapshot") ||
    error.includes("approved measurement snapshot")
  ) {
    return "safety_rejected";
  }
  if (
    error.includes("ai draft") ||
    error.includes("gemini") ||
    error.includes("ai usage")
  ) {
    return "ai_unavailable";
  }
  return "unknown";
}

export function customerReplyRecoveryCode(
  failure: CustomerReplyFailure,
): "CUSTOMER_REPLY_SAFETY_REJECTED" | "CUSTOMER_REPLY_SOURCE_CHANGED" | null {
  const recovery = customerReplyRecoveryKind(failure);
  if (recovery === "safety_rejected") {
    return "CUSTOMER_REPLY_SAFETY_REJECTED";
  }
  if (recovery === "source_changed") {
    return "CUSTOMER_REPLY_SOURCE_CHANGED";
  }
  return null;
}
