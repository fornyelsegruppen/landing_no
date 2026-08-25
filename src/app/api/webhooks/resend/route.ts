import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { applyResendWebhookEvent } from "@/lib/messages/resend-webhook";
import { applyResendInboundEmail } from "@/lib/messages/resend-inbound";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { featureReadiness } from "@/lib/platform/features";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });

  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Invalid webhook headers" }, { status: 400 });

  try {
    const rawBody = await request.text();
    const event = new Resend(process.env.RESEND_API_KEY || "re_webhook_verification").webhooks.verify({
      payload: rawBody,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
    const payload = await getPayload();
    const result = event.type === "email.received" && featureReadiness("communicationRoutingV2").ready
      ? await applyResendInboundEmail(payload, event.data, async (emailId) => {
          const received = await new Resend(process.env.RESEND_API_KEY || "").emails.receiving.get(emailId);
          if (received.error || !received.data) throw new Error("Inbound email content could not be retrieved");
          return received.data;
        }, correlationIdFromHeaders(request.headers))
      : event.type === "email.received"
        ? { matched: false as const, reason: "inbound-routing-disabled" }
        : await applyResendWebhookEvent(payload, event);
    return NextResponse.json({ ok: true, matched: result.matched });
  } catch (error) {
    captureException(error, { route: "POST /api/webhooks/resend", operation: "verify-or-apply" });
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
