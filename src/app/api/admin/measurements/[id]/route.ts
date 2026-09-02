import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import {
  calculatePrice,
  type PriceRuleSnapshot,
} from "@/lib/measurements/pricing";
import { reviewManualMeasurement } from "@/lib/measurements/admin-workbench";
import { prepareMeasurement } from "@/lib/measurements/proposal";
import { nextMeasurementVersion } from "@/lib/measurements/versioning";
import { userIsAdmin } from "@/payload/access/roles";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { overridePreparedLeadArea } from "@/lib/leads/automatic-package";
import {
  verifyMeasurementEvidence,
} from "@/lib/measurements/persist-evidence";
import { isNorgeIBilderScreenshotSource } from "@/lib/measurements/evidence-policy";
import { measurementWorkflowMode } from "@/lib/measurements/workflow-mode";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("create_version"),
    roofPlanes: z.unknown(),
    confidence: z.enum(["high", "medium", "low"]),
    confidenceReasoning: z.string().min(10),
  }),
  z.object({
    action: z.literal("override_area"),
    areaSquareMeters: z.number().min(10).max(5000),
    reason: z.string().trim().min(5).max(500),
  }),
  z.object({ action: z.literal("calculate_price") }),
]);
function idOf(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  )
    return (value as { id: number }).id;
  throw new TypeError("Missing relationship");
}
function optionalIdOf(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  )
    return (value as { id: number }).id;
  return undefined;
}
function hasAuthorizedSource(blockingReasons: unknown) {
  return (
    !Array.isArray(blockingReasons) ||
    (!blockingReasons.includes("imagery_not_licensed") &&
      !blockingReasons.includes("measurement_source_not_authorized"))
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  if (!/^\d+$/.test(id))
    return NextResponse.json({ error: "Invalid measurement" }, { status: 400 });
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const measurement = await payload.findByID({
    collection: "roof-measurements",
    id: Number(id),
    depth: 0,
    overrideAccess: true,
  });
  const leadId = idOf(measurement.lead);
  const lead = await payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
  });
  const { commercialPackageEnabled, requireApprovedPriceRule } =
    measurementWorkflowMode();
  const rules = await payload.find({
    collection: "price-rules",
    depth: 0,
    limit: 1,
    sort: "-version",
    overrideAccess: true,
    where: {
      and: [
        { serviceKey: { equals: lead.inquiryType } },
        { status: { equals: "approved" } },
      ],
    },
  });

  if (parsed.data.action === "override_area") {
    if (!commercialPackageEnabled) {
      return NextResponse.json(
        {
          error:
            "Commercial area override is disabled. Use the measurement-only manual area action.",
          code: "CUSTOMER_QUOTES_DISABLED",
        },
        { status: 409 },
      );
    }
    let result: Awaited<ReturnType<typeof overridePreparedLeadArea>>;
    try {
      result = await overridePreparedLeadArea(payload, {
        measurementId: measurement.id,
        administratorId: user.id,
        areaSquareMeters: parsed.data.areaSquareMeters,
        reason: parsed.data.reason,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Area override failed",
        },
        { status: 409 },
      );
    }
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "measurement.area-overridden",
      entityType: "roof-measurement",
      entityId: result.measurementId,
      correlationId: correlationIdFromHeaders(request.headers),
      changedFields: [
        "actualAreaMinTenths",
        "actualAreaMaxTenths",
        "calculationSnapshot",
        "price",
        "quote",
        "contract",
      ],
    });
    return NextResponse.json({ measurement: result }, { status: 201 });
  }

  if (parsed.data.action === "approve") {
    if (
      process.env.FEATURE_MEASUREMENT_EVIDENCE_V2 === "true" &&
      measurement.measurementMode !== "manual_no_visual" &&
      !(await verifyMeasurementEvidence(payload, measurement))
    ) {
      return NextResponse.json(
        {
          error:
            "Measurement evidence is missing or does not match its stored hash",
        },
        { status: 409 },
      );
    }
    const gate =
      measurement.measurementMode === "manual_no_visual"
        ? reviewManualMeasurement(measurement)
        : prepareMeasurement({
            proposal: {
              buildingIdentifier: measurement.buildingIdentifier ?? null,
              confidence: measurement.confidence,
              confidenceReasoning: measurement.confidenceReasoning,
              roofPlanes: measurement.roofPlanes,
            },
            addressResolved: Boolean(measurement.addressSourceId),
            sourceAuthorized:
              measurement.imageryLicensed &&
              hasAuthorizedSource(measurement.blockingReasons),
            hasApprovedPriceRule: rules.totalDocs > 0,
            requireApprovedPriceRule,
          }).gate;
    if (!gate.allowed)
      return NextResponse.json(
        { error: "Measurement is blocked", reasons: gate.reasons },
        { status: 409 },
      );
    const approvedAt = new Date().toISOString();
    const updated = await payload.update({
      collection: "roof-measurements",
      id: measurement.id,
      overrideAccess: true,
      data: {
        status: "approved",
        approvedBy: user.id,
        approvedAt,
        selectionConfirmedBy: user.id,
        selectionConfirmedAt: approvedAt,
        blockingReasons: [],
      },
    });
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
      proposal: {
        buildingIdentifier: measurement.buildingIdentifier ?? null,
        confidence: parsed.data.confidence,
        confidenceReasoning: parsed.data.confidenceReasoning,
        roofPlanes: parsed.data.roofPlanes,
      },
      addressResolved: Boolean(measurement.addressSourceId),
      sourceAuthorized:
        measurement.imageryLicensed &&
        hasAuthorizedSource(measurement.blockingReasons),
      hasApprovedPriceRule: rules.totalDocs > 0,
      requireApprovedPriceRule,
    });
    const versionData = nextMeasurementVersion(
      measurement as unknown as Record<string, unknown> & {
        id: number;
        version: number;
        lead: unknown;
        reference: string;
      },
      {
        roofPlanes: prepared.proposal.roofPlanes,
        confidence: prepared.proposal.confidence,
        confidenceReasoning: prepared.proposal.confidenceReasoning,
        horizontalAreaTenths: prepared.calculation?.horizontalAreaTenths ?? 0,
        actualAreaMinTenths: prepared.calculation?.actualAreaMinTenths ?? 0,
        actualAreaMaxTenths: prepared.calculation?.actualAreaMaxTenths ?? 0,
        calculationSnapshot: prepared.calculation,
        blockingReasons: prepared.gate.reasons,
        status: prepared.status,
      },
    );
    const createData = { ...versionData } as Record<string, unknown>;
    delete createData.id;
    delete createData.createdAt;
    delete createData.updatedAt;
    const created = await payload.create({
      collection: "roof-measurements",
      overrideAccess: true,
      data: createData as never,
    });
    try {
      const shouldReuseRasterEvidence = isNorgeIBilderScreenshotSource(
        measurement.evidenceSource,
      );
      if (shouldReuseRasterEvidence) {
        const { verifyMeasurementEvidence } = await import(
          "@/lib/measurements/persist-evidence"
        );
        if (!(await verifyMeasurementEvidence(payload, measurement))) {
          throw new Error(
            "Approved screenshot evidence no longer matches its case-bound capture",
          );
        }
        const evidenceSnapshotId = idOf(measurement.evidenceSnapshot);
        if (!measurement.evidenceHash || !measurement.imageryCapturedAt) {
          throw new Error(
            "Approved screenshot evidence is incomplete on the previous measurement",
          );
        }
        await payload.update({
          collection: "roof-measurements",
          id: created.id,
          overrideAccess: true,
          data: {
            measurementMode: "schematic_with_context",
            mapImage: optionalIdOf(measurement.mapImage),
            evidenceSnapshot: evidenceSnapshotId,
            evidenceHash: measurement.evidenceHash,
            evidenceSource: measurement.evidenceSource,
            evidenceAttribution: measurement.evidenceAttribution,
            evidenceGeneratedAt: measurement.evidenceGeneratedAt,
            imageryCapturedAt: measurement.imageryCapturedAt,
          },
        });
      } else {
        const { persistSchematicMeasurementEvidence } = await import(
          "@/lib/measurements/persist-evidence"
        );
        const planes = prepared.proposal.roofPlanes;
        const selectedBuildingId = String(
          measurement.buildingIdentifier ||
            planes[0]?.id ||
            "selected-building",
        );
        const storedCandidates = Array.isArray(measurement.candidateBuildings)
          ? (measurement.candidateBuildings as Array<Record<string, unknown>>)
          : [];
        const candidates = storedCandidates
          .map((candidate) =>
            candidate.id === selectedBuildingId
              ? {
                  ...candidate,
                  polygon: planes[0]?.polygon || candidate.polygon,
                }
              : candidate,
          )
          .filter(
            (candidate) =>
              typeof candidate.id === "string" &&
              typeof candidate.label === "string" &&
              Array.isArray(candidate.polygon),
          ) as Array<{
          id: string;
          label: string;
          polygon: Array<{ latitude: number; longitude: number }>;
        }>;
        if (!candidates.length && planes[0]?.polygon)
          candidates.push({
            id: selectedBuildingId,
            label: "Valgt bygg",
            polygon: planes[0].polygon,
          });
        if (
          typeof created.latitude !== "number" ||
          typeof created.longitude !== "number"
        )
          throw new Error(
            "Measurement coordinates are required for schematic evidence",
          );
        await persistSchematicMeasurementEvidence({
          payload,
          leadId,
          measurementId: created.id,
          address: created.normalizedAddress,
          addressPoint: {
            latitude: created.latitude,
            longitude: created.longitude,
          },
          candidates,
          selectedBuildingId,
          source: created.evidenceSource || created.source,
          attribution: created.evidenceAttribution || created.credits,
        });
      }
    } catch (error) {
      await payload
        .delete({
          collection: "roof-measurements",
          id: created.id,
          overrideAccess: true,
        })
        .catch(() => undefined);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Measurement evidence could not be regenerated",
        },
        { status: 503 },
      );
    }
    await payload.update({
      collection: "roof-measurements",
      id: measurement.id,
      overrideAccess: true,
      data: { status: "superseded" },
    });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "measurement.version-created",
      entityType: "roof-measurement",
      entityId: created.id,
      correlationId: correlationIdFromHeaders(request.headers),
      changedFields: ["version", "roofPlanes", "confidence", "status"],
    });
    return NextResponse.json(
      { measurement: created, gate: prepared.gate },
      { status: 201 },
    );
  }

  if (!commercialPackageEnabled) {
    return NextResponse.json(
      {
        error: "Price calculation is disabled in the measurement-only pilot",
        code: "CUSTOMER_QUOTES_DISABLED",
      },
      { status: 409 },
    );
  }
  if (measurement.status !== "approved")
    return NextResponse.json(
      { error: "Approve the measurement first" },
      { status: 409 },
    );
  const rule = rules.docs[0];
  if (!rule)
    return NextResponse.json(
      { error: "No approved price rule" },
      { status: 409 },
    );
  const snapshot: PriceRuleSnapshot = {
    id: rule.id,
    version: rule.version,
    serviceKey: rule.serviceKey,
    unitPriceExVatOre: rule.unitPriceExVatOre,
    vatBasisPoints: rule.vatBasisPoints,
    minimumExVatOre: rule.minimumExVatOre,
    toleranceBasisPoints: rule.toleranceBasisPoints,
    maximumExVatOre: rule.maximumExVatOre,
    status: rule.status,
  };
  const calculated = calculatePrice(measurement.actualAreaMaxTenths, snapshot);
  const created = await payload.create({
    collection: "price-calculations",
    overrideAccess: true,
    data: {
      reference: `PB-${leadId}-${Date.now()}`,
      lead: leadId,
      measurement: measurement.id,
      priceRule: rule.id,
      inputSnapshot: {
        measurementHash: measurement.inputHash,
        measurementVersion: measurement.version,
        rule: snapshot,
      },
      outputSnapshot: calculated,
      inputHash: calculated.inputHash,
      subtotalExVatOre: calculated.subtotalExVatOre,
      vatOre: calculated.vatOre,
      totalIncVatOre: calculated.totalIncVatOre,
      maximumTotalIncVatOre: calculated.maximumTotalIncVatOre,
      status: "ready",
      blockingReasons: [],
    },
  });
  await recordAuditEvent(createPayloadAuditWriter(payload), {
    actorId: user.id,
    action: "price.calculated",
    entityType: "price-calculation",
    entityId: created.id,
    correlationId: correlationIdFromHeaders(request.headers),
    changedFields: [
      "measurement",
      "priceRule",
      "subtotalExVatOre",
      "vatOre",
      "totalIncVatOre",
      "maximumTotalIncVatOre",
      "status",
    ],
  });
  return NextResponse.json({ calculation: created }, { status: 201 });
}
