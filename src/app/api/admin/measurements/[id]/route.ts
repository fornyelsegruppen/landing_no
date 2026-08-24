import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { calculatePrice, type PriceRuleSnapshot } from "@/lib/measurements/pricing";
import { prepareMeasurement } from "@/lib/measurements/proposal";
import { nextMeasurementVersion } from "@/lib/measurements/versioning";
import { userIsAdmin } from "@/payload/access/roles";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("create_version"), roofPlanes: z.unknown(), confidence: z.enum(["high", "medium", "low"]), confidenceReasoning: z.string().min(10) }),
  z.object({ action: z.literal("calculate_price") }),
]);
function idOf(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  throw new TypeError("Missing relationship");
}
function hasAuthorizedSource(blockingReasons: unknown) {
  return !Array.isArray(blockingReasons)
    || (!blockingReasons.includes("imagery_not_licensed")
      && !blockingReasons.includes("measurement_source_not_authorized"));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid measurement" }, { status: 400 });
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const measurement = await payload.findByID({ collection: "roof-measurements", id: Number(id), depth: 0, overrideAccess: true });
  const leadId = idOf(measurement.lead);
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  const rules = await payload.find({ collection: "price-rules", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: {
    and: [{ serviceKey: { equals: lead.inquiryType } }, { status: { equals: "approved" } }],
  } });

  if (parsed.data.action === "approve") {
    const prepared = prepareMeasurement({
      proposal: { buildingIdentifier: measurement.buildingIdentifier ?? null, confidence: measurement.confidence, confidenceReasoning: measurement.confidenceReasoning, roofPlanes: measurement.roofPlanes },
      addressResolved: Boolean(measurement.addressSourceId), sourceAuthorized: measurement.imageryLicensed && hasAuthorizedSource(measurement.blockingReasons), hasApprovedPriceRule: rules.totalDocs > 0,
    });
    if (!prepared.gate.allowed) return NextResponse.json({ error: "Measurement is blocked", reasons: prepared.gate.reasons }, { status: 409 });
    const updated = await payload.update({ collection: "roof-measurements", id: measurement.id, overrideAccess: true, data: { status: "approved", approvedBy: user.id, approvedAt: new Date().toISOString(), blockingReasons: [] } });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "measurement.approved",
      entityType: "roof-measurement",
      entityId: updated.id,
      correlationId: correlationIdFromHeaders(request.headers),
      changedFields: ["status", "approvedBy", "approvedAt"],
    });
    return NextResponse.json({ measurement: updated });
  }

  if (parsed.data.action === "create_version") {
    const prepared = prepareMeasurement({
      proposal: { buildingIdentifier: measurement.buildingIdentifier ?? null, confidence: parsed.data.confidence, confidenceReasoning: parsed.data.confidenceReasoning, roofPlanes: parsed.data.roofPlanes },
      addressResolved: Boolean(measurement.addressSourceId), sourceAuthorized: measurement.imageryLicensed && hasAuthorizedSource(measurement.blockingReasons), hasApprovedPriceRule: rules.totalDocs > 0,
    });
    const versionData = nextMeasurementVersion(measurement as unknown as Record<string, unknown> & { id: number; version: number; lead: unknown; reference: string }, {
      roofPlanes: prepared.proposal.roofPlanes,
      confidence: prepared.proposal.confidence,
      confidenceReasoning: prepared.proposal.confidenceReasoning,
      horizontalAreaTenths: prepared.calculation?.horizontalAreaTenths ?? 0,
      actualAreaMinTenths: prepared.calculation?.actualAreaMinTenths ?? 0,
      actualAreaMaxTenths: prepared.calculation?.actualAreaMaxTenths ?? 0,
      calculationSnapshot: prepared.calculation,
      blockingReasons: prepared.gate.reasons,
      status: prepared.status,
    });
    const createData = { ...versionData } as Record<string, unknown>;
    delete createData.id;
    delete createData.createdAt;
    delete createData.updatedAt;
    const created = await payload.create({ collection: "roof-measurements", overrideAccess: true, data: createData as never });
    await payload.update({ collection: "roof-measurements", id: measurement.id, overrideAccess: true, data: { status: "superseded" } });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "measurement.version-created",
      entityType: "roof-measurement",
      entityId: created.id,
      correlationId: correlationIdFromHeaders(request.headers),
      changedFields: ["version", "roofPlanes", "confidence", "status"],
    });
    return NextResponse.json({ measurement: created, gate: prepared.gate }, { status: 201 });
  }

  if (measurement.status !== "approved") return NextResponse.json({ error: "Approve the measurement first" }, { status: 409 });
  const rule = rules.docs[0];
  if (!rule) return NextResponse.json({ error: "No approved price rule" }, { status: 409 });
  const snapshot: PriceRuleSnapshot = {
    id: rule.id, version: rule.version, serviceKey: rule.serviceKey,
    unitPriceExVatOre: rule.unitPriceExVatOre, vatBasisPoints: rule.vatBasisPoints,
    minimumExVatOre: rule.minimumExVatOre, toleranceBasisPoints: rule.toleranceBasisPoints,
    maximumExVatOre: rule.maximumExVatOre, status: rule.status,
  };
  const calculated = calculatePrice(measurement.actualAreaMaxTenths, snapshot);
  const created = await payload.create({ collection: "price-calculations", overrideAccess: true, data: {
    reference: `PB-${leadId}-${Date.now()}`, lead: leadId, measurement: measurement.id, priceRule: rule.id,
    inputSnapshot: { measurementHash: measurement.inputHash, measurementVersion: measurement.version, rule: snapshot },
    outputSnapshot: calculated, inputHash: calculated.inputHash,
    subtotalExVatOre: calculated.subtotalExVatOre, vatOre: calculated.vatOre,
    totalIncVatOre: calculated.totalIncVatOre, maximumTotalIncVatOre: calculated.maximumTotalIncVatOre,
    status: "ready", blockingReasons: [],
  } });
  await recordAuditEvent(createPayloadAuditWriter(payload), {
    actorId: user.id,
    action: "price.calculated",
    entityType: "price-calculation",
    entityId: created.id,
    correlationId: correlationIdFromHeaders(request.headers),
    changedFields: ["measurement", "priceRule", "subtotalExVatOre", "vatOre", "totalIncVatOre", "maximumTotalIncVatOre", "status"],
  });
  return NextResponse.json({ calculation: created }, { status: 201 });
}
