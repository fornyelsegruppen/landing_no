import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/platform/state-machine";
import {
  nextRetryDelayMs,
  operationalJobTransitions,
  retryDecision,
  sanitizeJobError,
} from "./job-policy";

describe("operational job policy", () => {
  it("uses bounded exponential retry delays", () => {
    expect(nextRetryDelayMs(1)).toBe(30_000);
    expect(nextRetryDelayMs(3)).toBe(120_000);
    expect(nextRetryDelayMs(20)).toBe(3_600_000);
  });

  it("moves exhausted jobs to human attention", () => {
    expect(retryDecision(1, 3)).toBe("retry");
    expect(retryDecision(3, 3)).toBe("attention");
  });

  it("does not reopen completed or cancelled jobs", () => {
    expect(canTransition(operationalJobTransitions, "completed", "retry")).toBe(
      false,
    );
    expect(
      canTransition(operationalJobTransitions, "cancelled", "pending"),
    ).toBe(false);
  });

  it("does not copy a provider error message into the job record", () => {
    const result = sanitizeJobError(
      new Error("customer@example.com token=very-secret"),
    );
    expect(JSON.stringify(result)).not.toContain("customer@example.com");
    expect(JSON.stringify(result)).not.toContain("very-secret");
  });
});
