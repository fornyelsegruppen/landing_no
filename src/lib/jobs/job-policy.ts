import type { TransitionMap } from "@/lib/platform/state-machine";

export type OperationalJobStatus =
  | "pending"
  | "running"
  | "retry"
  | "completed"
  | "failed"
  | "attention"
  | "cancelled";

export const operationalJobTransitions: TransitionMap<OperationalJobStatus> = {
  pending: ["running", "cancelled"],
  running: ["completed", "retry", "failed", "attention"],
  retry: ["running", "cancelled", "attention"],
  completed: [],
  failed: ["retry", "attention"],
  attention: ["retry", "cancelled"],
  cancelled: [],
};

export function nextRetryDelayMs(
  attempts: number,
  baseMs = 30_000,
  maximumMs = 60 * 60 * 1_000,
) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new TypeError("Attempts must be a positive integer");
  }
  return Math.min(baseMs * 2 ** (attempts - 1), maximumMs);
}

export function retryDecision(attempts: number, maxAttempts: number) {
  if (!Number.isInteger(attempts) || !Number.isInteger(maxAttempts)) {
    throw new TypeError("Attempt counters must be integers");
  }
  if (attempts < 0 || maxAttempts < 1) {
    throw new TypeError("Attempt counters are outside the supported range");
  }
  return attempts < maxAttempts ? "retry" : "attention";
}

export function sanitizeJobError(error: unknown) {
  if (error instanceof Error) {
    return {
      code: error.name.slice(0, 100),
      message: "The operation failed. Review provider and correlation logs.",
    };
  }
  return {
    code: "UnknownError",
    message: "The operation failed. Review provider and correlation logs.",
  };
}
