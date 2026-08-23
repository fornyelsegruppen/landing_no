import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import { sanitizeJobError } from "@/lib/jobs/job-policy";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { ResendEmailProvider } from "@/lib/providers/resend-email-provider";
import { createLeadAiReply, deliverMessage } from "@/lib/messages/message-engine";
import { featureReadiness } from "@/lib/platform/features";
import { assertPayloadAiUsageAvailable } from "@/lib/ai/payload-usage-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

function numericPayloadId(value: unknown, key: "messageId" | "leadId") {
  if (!value || typeof value !== "object") return null;
  const id = (value as Record<string, unknown>)[key];
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await getPayload();
    const now = new Date();
    const jobs = await payload.find({
      collection: "operational-jobs",
      depth: 0,
      limit: 10,
      sort: "availableAt",
      overrideAccess: true,
      where: {
        and: [
          { type: { in: ["message.delivery", "lead.ai.draft"] } },
          { status: { in: ["pending", "retry"] } },
          { availableAt: { less_than_equal: now.toISOString() } },
        ],
      },
    });
    const completed: number[] = [];
    const attention: number[] = [];
    for (const job of jobs.docs) {
      const attempts = (job.attempts || 0) + 1;
      await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "running", attempts, startedAt: now.toISOString() } });
      try {
        if (job.type === "message.delivery") {
          const messageId = numericPayloadId(job.payload, "messageId");
          if (!messageId) throw new TypeError("Delivery job has no message reference");
          const provider = new ResendEmailProvider();
          if (provider.health().status !== "ready") throw new Error("Email provider requires configuration");
          await deliverMessage(payload, provider, messageId, job.correlationId);
        } else {
          const leadId = numericPayloadId(job.payload, "leadId");
          if (!leadId) throw new TypeError("AI job has no lead reference");
          if (!featureReadiness("aiDrafts").ready) throw new Error("AI drafts require configuration");
          await assertPayloadAiUsageAvailable(payload);
          await createLeadAiReply(payload, new GeminiAiProvider(), leadId, job.correlationId);
        }
        await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "completed", completedAt: new Date().toISOString(), result: { processed: true }, lastErrorCode: null, lastErrorMessage: null } });
        completed.push(job.id);
      } catch (error) {
        const sanitized = sanitizeJobError(error);
        const exhausted = attempts >= (job.maxAttempts || 3) || /requires configuration|daily request limit/i.test(error instanceof Error ? error.message : "");
        await payload.update({
          collection: "operational-jobs",
          id: job.id,
          overrideAccess: true,
          data: {
            status: exhausted ? "attention" : "retry",
            availableAt: new Date(Date.now() + attempts * 5 * 60_000).toISOString(),
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
              data: { status: "attention", failureCode: sanitized.code, failureMessage: sanitized.message },
            });
          }
        }
        if (exhausted) attention.push(job.id);
      }
    }
    return NextResponse.json({ ok: true, completed, attention });
  } catch (error) {
    captureException(error, { route: "GET /api/cron/operational-jobs" });
    return NextResponse.json({ error: "Operational job processing failed" }, { status: 500 });
  }
}
