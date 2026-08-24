import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { applyResendWebhookEvent } from "@/lib/messages/resend-webhook";

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
    const result = await applyResendWebhookEvent(payload, event);
    return NextResponse.json({ ok: true, matched: result.matched });
  } catch (error) {
    captureException(error, { route: "POST /api/webhooks/resend", operation: "verify-or-apply" });
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
