import type { Payload, Where } from "payload";
import { assertPayloadAiUsageAvailable } from "@/lib/ai/payload-usage-limit";
import {
  prepareAutomaticLeadMeasurement,
  prepareAutomaticLeadPackage,
} from "@/lib/leads/automatic-package";
import {
  createCustomerReplyDraft,
  createLeadAiReply,
  deliverMessage,
} from "@/lib/messages/message-engine";
import {
  customerReplyPurposes,
  type CustomerReplyPurpose,
} from "@/lib/messages/customer-reply";
import { featureReadiness } from "@/lib/platform/features";
import { automaticCommunicationIsPaused } from "@/lib/platform/operating-mode";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { createEmailProvider } from "@/lib/providers/email-provider";
import {
  ChannelUnavailableError,
  CommunicationCancelledError,
  processWorkerAssignmentNotificationJob,
  processWorkOrderCommunicationJob,
} from "@/lib/work-orders/communications";
import { nextRetryDelayMs, sanitizeJobError } from "./job-policy";
import { processQuoteFollowUpJob } from "@/lib/quotes/follow-up";
import { updateCaseState } from "@/lib/cases/case-command";
import { makeIdempotencyKey } from "./idempotency";

type ProcessorOptions = {
  jobIds?: number[];
  limit?: number;
  now?: Date;
  rescueStale?: boolean;
};

export function automaticPreparationScope(
  measurementReady: boolean,
  quotesReady: boolean,
) {
  if (!measurementReady) return "none" as const;
  return quotesReady
    ? ("commercial-package" as const)
    : ("measurement-only" as const);
}

function numericPayloadId(
  value: unknown,
  key: "messageId" | "leadId" | "sourceMessageId",
) {
  if (!value || typeof value !== "object") return null;
  const id = (value as Record<string, unknown>)[key];
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

function customerReplyPurpose(value: unknown): CustomerReplyPurpose | null {
  if (!value || typeof value !== "object") return null;
  const purpose = (value as Record<string, unknown>).purpose;
  return typeof purpose === "string" &&
    (customerReplyPurposes as readonly string[]).includes(purpose)
    ? (purpose as CustomerReplyPurpose)
    : null;
}

async function automaticCommunicationJobIsPaused(
  payload: Payload,
  job: { type?: string | null; payload?: unknown },
) {
  if (!automaticCommunicationIsPaused()) return false;
  if (job.type === "work-order.communication") {
    const data = job.payload && typeof job.payload === "object"
      ? job.payload as Record<string, unknown>
      : {};
    return data.adminApprovedTransactional !== true;
  }
  if (job.type === "quote.follow-up") return true;
  if (job.type !== "message.delivery") return false;
  const messageId = numericPayloadId(job.payload, "messageId");
  if (!messageId) return false;
  const message = await payload
    .findByID({
      collection: "messages",
      id: messageId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!message) return false;
  const analysis =
    message.aiAnalysis && typeof message.aiAnalysis === "object"
      ? (message.aiAnalysis as Record<string, unknown>)
      : {};
  return Boolean(
    (analysis.workOrderId || analysis.reminder) &&
    analysis.adminApprovedTransactional !== true,
  );
}

async function rescueStaleJobs(payload: Payload, now: Date) {
  const staleBefore = new Date(now.getTime() - 15 * 60_000).toISOString();
  const stale = await payload.find({
    collection: "operational-jobs",
    depth: 0,
    limit: 50,
    overrideAccess: true,
    where: {
      and: [
        { status: { equals: "running" } },
        { startedAt: { less_than_equal: staleBefore } },
      ],
    },
  });
  for (const job of stale.docs) {
    await payload.update({
      collection: "operational-jobs",
      id: job.id,
      overrideAccess: true,
      data: {
        status: "retry",
        availableAt: now.toISOString(),
        lastErrorCode: "STALE_JOB_RECOVERED",
        lastErrorMessage: "En avbrutt jobb ble returnert til sikker retry-kø.",
      },
    });
  }
  return stale.docs.map((job) => job.id);
}

async function overduePendingJobIds(payload: Payload, now: Date) {
  const overdueBefore = new Date(now.getTime() - 90 * 60_000).toISOString();
  const result = await payload.find({
    collection: "operational-jobs",
    depth: 0,
    limit: 50,
    overrideAccess: true,
    sort: "availableAt",
    where: {
      and: [
        { status: { in: ["pending", "retry"] } },
        { availableAt: { less_than_equal: overdueBefore } },
      ],
    },
  });
  return result.docs
    .filter(
      (job) =>
        ["pending", "retry"].includes(job.status) &&
        new Date(job.availableAt).getTime() <=
          new Date(overdueBefore).getTime(),
    )
    .map((job) => job.id);
}

async function markMessageContactAttention(
  payload: Payload,
  messageId: number,
  reason: string,
  now: Date,
) {
  const message = await payload.findByID({
    collection: "messages",
    id: messageId,
    depth: 0,
    overrideAccess: true,
  });
  const leadId =
    typeof message.lead === "number"
      ? message.lead
      : message.lead && typeof message.lead === "object" && "id" in message.lead
        ? Number(message.lead.id)
        : null;
  if (!leadId || !Number.isSafeInteger(leadId)) return;
  const lead = await payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
  });
  const hasPhone =
    typeof lead.phone === "string" && lead.phone.trim().length >= 8;
  await updateCaseState(payload, {
    leadId,
    command: "message_delivery_attention",
    idempotencyKey: makeIdempotencyKey("message.delivery-attention", {
      messageId,
      reason,
    }),
    patch: {
      nextActionOwner: "administrator",
      nextActionAt: now.toISOString(),
      nextActionBlocker: "MESSAGE_DELIVERY_FAILED",
      nextAction: hasPhone
        ? "Kundemeldingen kunne ikke leveres. Kontroller e-postadressen og kontakt kunden manuelt på telefon."
        : "Kundemeldingen kunne ikke leveres, og kunden har ingen brukbar reservekanal. Finn en trygg manuell kontaktmåte.",
    },
  });
}

export async function processOperationalJobs(
  payload: Payload,
  options: ProcessorOptions = {},
) {
  const now = options.now || new Date();
  const rescued =
    options.rescueStale === false ? [] : await rescueStaleJobs(payload, now);
  const filters: Where[] = [
    {
      type: {
        in: [
          "message.delivery",
          "lead.ai.draft",
          "customer.reply.draft",
          "work-order.communication",
          "worker.assignment.notification",
          "quote.follow-up",
        ],
      },
    },
    { status: { in: ["pending", "retry"] } },
    { availableAt: { less_than_equal: now.toISOString() } },
  ];
  if (options.jobIds?.length) filters.push({ id: { in: options.jobIds } });

  const jobs = await payload.find({
    collection: "operational-jobs",
    depth: 0,
    limit: Math.min(Math.max(options.limit || 10, 1), 50),
    sort: "availableAt",
    overrideAccess: true,
    where: { and: filters },
  });

  const completed: number[] = [];
  const attention: number[] = [];
  const retried: number[] = [];
  const cancelled: number[] = [];
  const paused: number[] = [];

  for (const job of jobs.docs) {
    if (await automaticCommunicationJobIsPaused(payload, job)) {
      paused.push(job.id);
      continue;
    }
    const attempts = (job.attempts || 0) + 1;
    const claim = await payload.update({
      collection: "operational-jobs",
      overrideAccess: true,
      where: {
        and: [
          { id: { equals: job.id } },
          { status: { in: ["pending", "retry"] } },
          { availableAt: { less_than_equal: now.toISOString() } },
        ],
      },
      data: { status: "running", attempts, startedAt: now.toISOString() },
    });
    if (!Array.isArray(claim.docs) || claim.docs.length !== 1) continue;
    try {
      let jobResult: Record<string, unknown> = { processed: true };
      if (job.type === "message.delivery") {
        const messageId = numericPayloadId(job.payload, "messageId");
        if (!messageId)
          throw new TypeError("Delivery job has no message reference");
        const provider = createEmailProvider();
        if (provider.health().status !== "ready")
          throw new Error("Email provider requires configuration");
        await deliverMessage(payload, provider, messageId, job.correlationId);
      } else if (job.type === "customer.reply.draft") {
        const leadId = numericPayloadId(job.payload, "leadId");
        const sourceMessageId = numericPayloadId(
          job.payload,
          "sourceMessageId",
        );
        const purpose = customerReplyPurpose(job.payload);
        if (!leadId || !sourceMessageId || !purpose)
          throw new TypeError("Customer reply job has incomplete references");
        if (!featureReadiness("aiDrafts").ready)
          throw new Error("AI drafts require configuration");
        await createCustomerReplyDraft(payload, new GeminiAiProvider(), {
          correlationId: job.correlationId,
          leadId,
          purpose,
          sourceMessageId,
        });
      } else if (job.type === "lead.ai.draft") {
        const leadId = numericPayloadId(job.payload, "leadId");
        if (!leadId) throw new TypeError("AI job has no lead reference");
        const lead = await payload.findByID({
          collection: "leads",
          id: leadId,
          depth: 0,
          overrideAccess: true,
        });
        if (!["new", "draft_ready"].includes(lead.status || "")) {
          const terminal = lead.status === "converted" || lead.status === "closed";
          await payload.update({
            collection: "operational-jobs",
            id: job.id,
            overrideAccess: true,
            data: {
              status: "cancelled",
              completedAt: new Date().toISOString(),
              result: {
                processed: false,
                reason: terminal
                  ? "lead-terminal-state"
                  : "lead-intake-finished",
              },
            },
          });
          cancelled.push(job.id);
          continue;
        }
        if (!featureReadiness("aiDrafts").ready)
          throw new Error("AI drafts require configuration");
        await assertPayloadAiUsageAvailable(payload);
        await createLeadAiReply(
          payload,
          new GeminiAiProvider(),
          leadId,
          job.correlationId,
        );
        const measurementReady =
          featureReadiness("roofMeasurement").ready &&
          featureReadiness("measurementEvidenceV2").ready;
        const quotesReady = featureReadiness("customerQuotes").ready;
        const preparationScope = automaticPreparationScope(
          measurementReady,
          quotesReady,
        );
        if (preparationScope !== "none") {
          const preparedPackage =
            preparationScope === "commercial-package"
              ? await prepareAutomaticLeadPackage(payload, leadId)
              : await prepareAutomaticLeadMeasurement(payload, leadId);
          jobResult = {
            processed: true,
            package: preparedPackage,
            scope: preparationScope,
          };
        } else {
          jobResult = {
            processed: true,
            package: {
              status: "skipped",
              reason: "roof-measurement-not-ready",
            },
          };
        }
      } else if (job.type === "work-order.communication") {
        await processWorkOrderCommunicationJob(
          payload,
          job.payload,
          job.correlationId,
          now,
        );
      } else if (job.type === "worker.assignment.notification") {
        const provider = createEmailProvider();
        if (provider.health().status !== "ready")
          throw new Error("Email provider requires configuration");
        const delivery = await processWorkerAssignmentNotificationJob(
          payload,
          job.payload,
          job.correlationId,
          provider,
        );
        jobResult = {
          processed: true,
          provider: delivery.provider,
          providerMessageId: delivery.providerMessageId,
        };
      } else {
        jobResult = await processQuoteFollowUpJob(
          payload,
          job.payload,
          job.correlationId,
          now,
        );
      }

      await payload.update({
        collection: "operational-jobs",
        id: job.id,
        overrideAccess: true,
        data: {
          status: "completed",
          completedAt: new Date().toISOString(),
          result: jobResult,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      completed.push(job.id);
    } catch (error) {
      if (error instanceof CommunicationCancelledError) {
        await payload.update({
          collection: "operational-jobs",
          id: job.id,
          overrideAccess: true,
          data: {
            status: "cancelled",
            completedAt: new Date().toISOString(),
            lastErrorCode: "STATE_CHANGED",
            lastErrorMessage: error.message,
          },
        });
        cancelled.push(job.id);
        continue;
      }
      const sanitized = sanitizeJobError(error);
      const exhausted =
        error instanceof ChannelUnavailableError ||
        attempts >= (job.maxAttempts || 3) ||
        /requires configuration|daily request limit/i.test(
          error instanceof Error ? error.message : "",
        );
      await payload.update({
        collection: "operational-jobs",
        id: job.id,
        overrideAccess: true,
        data: {
          status: exhausted ? "attention" : "retry",
          availableAt: new Date(
            now.getTime() + nextRetryDelayMs(attempts),
          ).toISOString(),
          lastErrorCode: sanitized.code,
          lastErrorMessage: sanitized.message,
        },
      });
      if (exhausted && job.type === "message.delivery") {
        const messageId = numericPayloadId(job.payload, "messageId");
        if (messageId) {
          await payload.update({
            collection: "messages",
            id: messageId,
            overrideAccess: true,
            data: {
              status: "attention",
              failureCode: sanitized.code,
              failureMessage: sanitized.message,
            },
          });
          await markMessageContactAttention(
            payload,
            messageId,
            sanitized.code,
            now,
          );
        }
      }
      if (exhausted) attention.push(job.id);
      else retried.push(job.id);
    }
  }

  const overdue = await overduePendingJobIds(payload, now);
  return { completed, attention, retried, cancelled, paused, rescued, overdue };
}
