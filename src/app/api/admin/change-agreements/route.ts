import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createChangeAgreementDraft } from "@/lib/change-agreements/engine";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.object({ workOrderId: z.number().int().positive(), proposedTotalIncVatOre: z.number().int().positive().optional(), reasonDescription: z.string().trim().max(2_000).optional() });

export async function POST(request: Request) {
  const payload = await getPayload(); const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid change input" }, { status: 400 });
  try {
    const agreement = await createChangeAgreementDraft(payload, parsed.data);
    await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: user.id, action: "change-agreement.created", entityType: "change-agreement", entityId: agreement.id, correlationId: correlationIdFromHeaders(request.headers), changedFields: ["snapshot", "reasonCode", "beforeTotalIncVatOre", "afterTotalIncVatOre", "status"] });
    return NextResponse.json({ agreementId: agreement.id }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Change agreement failed" }, { status: 409 }); }
}
