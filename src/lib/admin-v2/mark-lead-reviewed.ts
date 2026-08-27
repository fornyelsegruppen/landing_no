import type { Payload } from "payload";
import { executeCaseCommand } from "@/lib/cases/case-command";

type ReviewableLead = {
  adminReviewedAt?: string | null;
};

export async function markLeadReviewed(
  payload: Payload,
  input: {
    actorId: number;
    lead: ReviewableLead;
    leadId: number;
    now?: Date;
  },
) {
  if (input.lead.adminReviewedAt) {
    return {
      duplicate: true as const,
      reviewedAt: input.lead.adminReviewedAt,
    };
  }

  const reviewedAt = (input.now ?? new Date()).toISOString();
  const command = await executeCaseCommand(payload, {
    actorId: input.actorId,
    command: "mark_reviewed",
    idempotencyKey: `lead:${input.leadId}:mark-reviewed`,
    leadId: input.leadId,
    patch: {
      adminReviewedAt: reviewedAt,
      adminReviewedBy: input.actorId,
    },
  });
  const persistedAt = command.lead.adminReviewedAt;
  if (typeof persistedAt !== "string" || !persistedAt) {
    throw new Error("Lead review marker was not persisted");
  }

  return {
    duplicate: command.duplicate,
    reviewedAt: persistedAt,
  };
}
