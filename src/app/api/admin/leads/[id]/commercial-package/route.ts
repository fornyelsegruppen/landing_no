import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import {
  assertFeatureReady,
  FeatureUnavailableError,
} from "@/lib/platform/features";
import { claimCommercialPackageRequest, completeCommercialPackageRequest, failCommercialPackageRequest, type CommercialPackageResult } from "@/lib/pricing/commercial-package-request";
import { rebuildCommercialPackage } from "@/lib/pricing/commercial-package";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.object({
  baseUnitPriceExVatOre: z.number().int().positive(),
  discountKind: z.enum(["none", "percent", "fixed"]),
  discountValue: z.number().min(0),
  reason: z.string().trim().min(10).max(500),
  recommendedServiceKey: z.enum(["takvask", "takvask_impregnering", "impregnering", "takmaling", "nytt_tak"]).optional(),
  depositPercent: z.number().min(0).max(100).default(0),
  expectedRevision: z.number().int().positive(),
  sourceQuoteId: z.number().int().positive(),
});

const requestKeySchema = z.string().trim().min(16).max(200).regex(/^[A-Za-z0-9._:-]+$/);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid lead" }, { status: 400 });
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsedRequestKey = requestKeySchema.safeParse(request.headers.get("idempotency-key"));
  if (!parsedRequestKey.success) return NextResponse.json({ error: "A valid Idempotency-Key header is required" }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid commercial package" }, { status: 400 });

  const correlationId = correlationIdFromHeaders(request.headers);
  let requestJobId: number | null = null;
  try {
    assertFeatureReady("customerQuotes");
    assertFeatureReady("caseStateEngineV2");
    const requestFingerprint = makeIdempotencyKey(
      "commercial.package-rebuild-body",
      parsed.data,
    );
    const claim = await claimCommercialPackageRequest(payload, {
      administratorId: user.id,
      correlationId,
      expectedRevision: parsed.data.expectedRevision,
      leadId: Number(id),
      requestKey: parsedRequestKey.data,
      requestFingerprint,
      sourceQuoteId: parsed.data.sourceQuoteId,
    });
    if (claim.kind === "completed") return NextResponse.json({ ...claim.result, idempotent: true, status: "completed" }, { status: 200 });
    if (claim.kind === "processing") return NextResponse.json({ idempotent: true, status: "processing" }, { status: 202 });
    if (claim.kind === "conflict") return NextResponse.json({ error: "The case or commercial terms changed. Reload before trying again", code: "STALE_COMMERCIAL_CONTEXT" }, { status: 409 });
    if (claim.kind === "failed") return NextResponse.json({ error: "This exact commercial package request needs administrator review before retrying" }, { status: 409 });
    requestJobId = claim.jobId;

    const result = await rebuildCommercialPackage(payload, {
      administratorId: user.id,
      leadId: Number(id),
      ...parsed.data,
      depositBasisPoints: Math.round(parsed.data.depositPercent * 100),
    });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "quote.commercial-package-rebuilt",
      entityType: "lead",
      entityId: Number(id),
      correlationId,
      changedFields: ["unitPriceExVatOre", "discount", "deposit", "quoteVersion", "contractVersion", "commercialOptions"],
      before: { sourceQuoteId: result.sourceQuoteId },
      after: { baseQuoteId: result.base.quote.id, recommendedQuoteId: result.recommended?.quote.id ?? null },
      metadata: { optionCount: result.recommended ? 2 : 1 },
    });
    const commercialResult: CommercialPackageResult = {
      baseQuoteId: result.base.quote.id,
      baseQuoteReference: result.base.quote.reference,
      recommendedQuoteId: result.recommended?.quote.id ?? null,
      recommendedQuoteReference: result.recommended?.quote.reference ?? null,
    };
    await completeCommercialPackageRequest(payload, requestJobId, commercialResult);
    return NextResponse.json({ ...commercialResult, idempotent: false, status: "completed" }, { status: 201 });
  } catch (error) {
    if (requestJobId) await failCommercialPackageRequest(payload, requestJobId, error).catch(() => undefined);
    if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Commercial package rebuild failed" }, { status: 409 });
  }
}
