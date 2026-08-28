export type AdminActionResponse = {
  code?: string;
  configurationRequired?: boolean;
  currentReference?: string;
  customerNotification?: "sent" | "queued" | "skipped";
  error?: string;
  notification?: "sent" | "queued" | "skipped";
  queued?: boolean;
  sent?: boolean;
  workerNotification?: "sent" | "queued" | "skipped";
};

export type AdminActionFeedback = {
  kind: "error" | "queued" | "stale" | "success";
  message: string;
  refresh: boolean;
};

export function interpretAdminActionResult(input: {
  fallbackError: string;
  measurementEvidenceUnavailableMessage?: string;
  ok: boolean;
  queuedMessage: string;
  reference?: string;
  result: AdminActionResponse;
  staleMessage: string;
  successMessage: string;
}): AdminActionFeedback {
  const { result } = input;
  if (!input.ok) {
    if (
      result.code === "MEASUREMENT_EVIDENCE_TEMPORARILY_UNAVAILABLE" &&
      input.measurementEvidenceUnavailableMessage
    ) {
      return {
        kind: "error",
        message: input.measurementEvidenceUnavailableMessage,
        refresh: false,
      };
    }
    if (
      ["STALE_COMMERCIAL_CONTEXT", "CASE_REVISION_CONFLICT"].includes(
        result.code || "",
      )
    ) {
      return {
        kind: "stale",
        message: `${input.staleMessage}${result.currentReference ? ` ${result.currentReference}` : ""}`,
        refresh: true,
      };
    }
    return {
      kind: "error",
      message: result.error || input.fallbackError,
      refresh: false,
    };
  }
  if (
    result.notification === "queued" ||
    result.queued === true ||
    result.configurationRequired === true ||
    result.sent === false
  ) {
    return { kind: "queued", message: input.queuedMessage, refresh: true };
  }
  return {
    kind: "success",
    message: `${input.successMessage}${input.reference ? ` ${input.reference}` : ""}`,
    refresh: true,
  };
}

export function interpretAdminActionNetworkFailure(
  error: unknown,
  input: { networkMessage: string; timeoutMessage: string },
): AdminActionFeedback {
  const timedOut = error instanceof Error && error.name === "AbortError";
  return {
    kind: "error",
    message: timedOut ? input.timeoutMessage : input.networkMessage,
    refresh: false,
  };
}
