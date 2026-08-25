import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { documentHash } from "@/lib/quotes/document";
import { issueQuoteCustomerLink, revokeIssuedQuote } from "@/lib/quotes/issue";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.object({ action: z.enum(["approve", "issue", "regenerate_link", "revoke"]) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid quote" }, { status: 400 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    const quote = await payload.findByID({ collection: "quotes", id: Number(id), depth: 0, overrideAccess: true });
    let result: Record<string, unknown>;
    if (parsed.data.action === "approve") {
      if (quote.status !== "draft") throw new Error("Only a draft can be approved");
      if (documentHash(quote.snapshot) !== quote.snapshotHash) throw new Error("Quote snapshot hash mismatch");
      const siblingId = typeof quote.siblingQuote === "number" ? quote.siblingQuote : quote.siblingQuote?.id;
      const sibling = siblingId ? await payload.findByID({ collection: "quotes", id: siblingId, depth: 0, overrideAccess: true }) : null;
      if (sibling && (sibling.status !== "draft" || documentHash(sibling.snapshot) !== sibling.snapshotHash)) throw new Error("The alternative quote is not a valid draft");
      const approvedAt = new Date().toISOString();
      const approved = await Promise.all([quote, ...(sibling ? [sibling] : [])].map((item) => payload.update({ collection: "quotes", id: item.id, overrideAccess: true, context: { trustedQuoteApproval: true }, data: { status: "approved", approvedBy: user.id, approvedAt } })));
      result = { quoteId: quote.id, approvedQuoteIds: approved.map((item) => item.id) };
    } else if (parsed.data.action === "issue" || parsed.data.action === "regenerate_link") {
      assertFeatureReady("customerQuotes");
      if (parsed.data.action === "regenerate_link" && !["sent", "viewed"].includes(quote.status)) throw new Error("Only an active issued quote can receive a new link");
      const issued = await issueQuoteCustomerLink(payload, quote.id);
      result = { messageId: issued.message.id, previewUrl: issued.url };
    } else {
      const revoked = await revokeIssuedQuote(payload, quote.id);
      result = { quoteId: revoked.id };
    }
    await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: user.id, action: `quote.${parsed.data.action}`, entityType: "quote", entityId: quote.id, correlationId, changedFields: parsed.data.action === "approve" ? ["status", "approvedAt"] : ["accessToken", "message", "status"] });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Quote action failed", correlationId }, { status: 409 });
  }
}
