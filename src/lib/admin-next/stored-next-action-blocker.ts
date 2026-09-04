import type { CaseNextActionKind } from "@/lib/admin-v2/case-read-model";

const blockerCodePattern = /^[A-Z][A-Z0-9_]{2,127}$/u;

const safelyMappedBlockers = {
  CUSTOMER_CANCELLATION_REQUEST: "review_cancellation",
  CUSTOMER_QUESTION_PENDING: "prepare_question_reply",
  DOCUMENTED_WITHOUT_COMPLETION_REVIEW: "review_completion",
  EMAIL_HARD_BOUNCE: "retry_message",
  MESSAGE_DELIVERY_FAILED: "retry_message",
  WORK_BLOCKED: "resolve_work_block",
} as const satisfies Partial<Record<string, CaseNextActionKind>>;

export type StoredNextActionBlockerProjection =
  | { status: "none" }
  | { status: "mapped"; code: string }
  | { status: "diagnostic"; code: string };

/**
 * Stored blocker text predates the typed resolver. It is considered mapped
 * only when a known code resolves to the expected canonical action and that
 * action carries an exact related-entity ID. Everything else remains a
 * non-executable, PII-safe diagnostic instead of being guessed into a target.
 */
export function projectStoredNextActionBlocker(input: {
  actionKind: CaseNextActionKind;
  actionTargetId?: number;
  storedBlocker?: string | null;
}): StoredNextActionBlockerProjection {
  const raw = input.storedBlocker?.trim();
  if (!raw) return { status: "none" };
  const code = blockerCodePattern.test(raw) ? raw : "UNMAPPED_LEGACY_BLOCKER";
  const expectedKind =
    safelyMappedBlockers[code as keyof typeof safelyMappedBlockers];
  if (
    expectedKind === input.actionKind &&
    Number.isInteger(input.actionTargetId) &&
    Number(input.actionTargetId) > 0
  ) {
    return { status: "mapped", code };
  }
  return { status: "diagnostic", code };
}
