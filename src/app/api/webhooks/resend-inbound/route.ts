import { handleResendWebhook } from "@/lib/messages/resend-webhook-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleResendWebhook(request, {
    webhookSecret: process.env.RESEND_INBOUND_WEBHOOK_SECRET,
    routeLabel: "POST /api/webhooks/resend-inbound",
  });
}
