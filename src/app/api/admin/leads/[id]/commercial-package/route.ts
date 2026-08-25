import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { rebuildCommercialPackage } from "@/lib/pricing/commercial-package";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.object({
  baseUnitPriceExVatOre: z.number().int().positive(),
  discountKind: z.enum(["none", "percent", "fixed"]),
  discountValue: z.number().min(0),
  reason: z.string().trim().min(10).max(500),
  recommendedServiceKey: z.enum(["takvask", "takvask_impregnering", "impregnering", "takmaling", "nytt_tak"]).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid lead" }, { status: 400 });
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid commercial package" }, { status: 400 });
  try {
    const result = await rebuildCommercialPackage(payload, { administratorId: user.id, leadId: Number(id), ...parsed.data });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "quote.commercial-package-rebuilt",
      entityType: "lead",
      entityId: Number(id),
      correlationId: correlationIdFromHeaders(request.headers),
      changedFields: ["unitPriceExVatOre", "discount", "quoteVersion", "contractVersion", "commercialOptions"],
      before: { sourceQuoteId: result.sourceQuoteId },
      after: { baseQuoteId: result.base.quote.id, recommendedQuoteId: result.recommended?.quote.id ?? null },
      metadata: { optionCount: result.recommended ? 2 : 1 },
    });
    return NextResponse.json({ baseQuoteId: result.base.quote.id, recommendedQuoteId: result.recommended?.quote.id ?? null }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Commercial package rebuild failed" }, { status: 409 });
  }
}
