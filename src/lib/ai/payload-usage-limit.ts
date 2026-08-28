import type { Payload } from "payload";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";

const customerReplyUsageAction = "ai.customer-reply.request";

function positiveLimit(value: string | undefined, fallback: number) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function usageSince(payload: Payload, start: Date) {
  const [blog, leads, customerReplies] = await Promise.all([
    payload.count({
      collection: "seo-runs",
      overrideAccess: true,
      where: {
        and: [
          { startedAt: { greater_than_equal: start.toISOString() } },
          {
            jobType: { in: ["blog.article.draft", "blog.article.regenerate"] },
          },
        ],
      },
    }),
    payload.count({
      collection: "operational-jobs",
      overrideAccess: true,
      where: {
        and: [
          { startedAt: { greater_than_equal: start.toISOString() } },
          {
            type: {
              in: ["lead.ai.draft", "roof.ai.proposal", "price.ai.explanation"],
            },
          },
        ],
      },
    }),
    payload.count({
      collection: "audit-events",
      overrideAccess: true,
      where: {
        and: [
          { createdAt: { greater_than_equal: start.toISOString() } },
          { action: { equals: customerReplyUsageAction } },
        ],
      },
    }),
  ]);
  return blog.totalDocs + leads.totalDocs + customerReplies.totalDocs;
}

export async function assertPayloadAiUsageAvailable(
  payload: Payload,
  options: { reserve?: number; now?: Date } = {},
) {
  const now = options.now || new Date();
  const reserve = options.reserve || 0;
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [daily, monthly] = await Promise.all([
    usageSince(payload, day),
    usageSince(payload, month),
  ]);
  if (
    daily + reserve >
    positiveLimit(process.env.GEMINI_DAILY_REQUEST_LIMIT, 20)
  ) {
    throw new Error("Gemini daily request limit reached");
  }
  if (
    monthly + reserve >
    positiveLimit(process.env.GEMINI_MONTHLY_REQUEST_LIMIT, 400)
  ) {
    throw new Error("Gemini monthly request limit reached");
  }
  return { daily, monthly };
}

export async function reserveCustomerReplyAiRequest(
  payload: Payload,
  input: {
    attempt: number;
    correlationId: string;
    purpose?: "customer-reply-draft" | "customer-reply-polish";
    sourceMessageId: number;
    now?: Date;
  },
) {
  const usage = await assertPayloadAiUsageAvailable(payload, {
    now: input.now,
    reserve: 1,
  });
  await recordAuditEvent(createPayloadAuditWriter(payload), {
    action: customerReplyUsageAction,
    entityType: "message",
    entityId: input.sourceMessageId,
    correlationId: input.correlationId,
    changedFields: ["geminiRequest"],
    metadata: {
      attempt: input.attempt,
      purpose: input.purpose || "customer-reply-draft",
    },
  });
  return { ...usage, reserved: 1 as const };
}
