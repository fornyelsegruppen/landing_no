import { NextResponse } from "next/server";
import { z } from "zod";
import type { Payload } from "payload";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { updateCaseState } from "@/lib/cases/case-command";
import { measurementSnapshotHash } from "@/lib/measurements/geometry";
import { manualAreaDeviationPercent, slopeBandForPreset } from "@/lib/measurements/admin-workbench";
import { persistSchematicMeasurementEvidence } from "@/lib/measurements/persist-evidence";
import { prepareMeasurement, roofProposalSchema } from "@/lib/measurements/proposal";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { KartverketAddressProvider, norgeIBilderAccess } from "@/lib/providers/kartverket-address-provider";
import { OpenStreetMapBuildingProvider, type BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import { createPreparedPackageForMeasurement } from "@/lib/quotes/payload-quote-engine";
import { userIsAdmin } from "@/payload/access/roles";

const candidateSchema = z.object({ id: z.string(), label: z.string(), postalCode: z.string(), city: z.string(), latitude: z.number(), longitude: z.number(), source: z.string() });
const createSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), leadId: z.number().int().positive(), expectedRevision: z.number().int().positive().optional(), address: candidateSchema, proposal: roofProposalSchema, imageryLicensed: z.boolean(), imagerySource: z.string().min(3).max(300), imagerySourceUrl: z.string().url().optional(), license: z.string().min(3).max(200), credits: z.string().min(3).max(200), mapImageId: z.number().int().positive().optional() }),
  z.object({ action: z.literal("create_from_candidate"), leadId: z.number().int().positive(), expectedRevision: z.number().int().positive().optional(), addressId: z.string().min(1), buildingId: z.string().min(1), slopeDegrees: z.union([z.literal(22), z.literal(27), z.literal(32), z.literal(36), z.literal(40), z.literal(45)]), reason: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("create_manual"), leadId: z.number().int().positive(), expectedRevision: z.number().int().positive().optional(), areaSquareMeters: z.number().min(10).max(5000), manualAreaSource: z.enum(["customer", "drawing", "admin_estimate", "onsite"]), reason: z.string().trim().min(5).max(500), confirmLargeDeviation: z.boolean().default(false) }),
]);

function uniqueAddressParts(parts: Array<string | null | undefined>) {
  const normalized = parts.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return normalized.filter((value, index) => normalized.findIndex((candidate) => candidate.toLocaleLowerCase("nb-NO") === value.toLocaleLowerCase("nb-NO")) === index);
}

async function authorize(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!userIsAdmin(user)) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { payload, user };
}

async function priorMeasurement(payload: Payload, leadId: number) {
  const result = await payload.find({ collection: "roof-measurements", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: { lead: { equals: leadId } } });
  return result.docs[0];
}

async function createVisualMeasurement(input: {
  actorId: number; address: z.infer<typeof candidateSchema>; candidates: BuildingFootprintCandidate[]; credits: string;
  imageryLicensed: boolean; imagerySource: string; imagerySourceUrl?: string; lead: { id: number; inquiryType?: string | null };
  leadId: number; license: string; mapImageId?: number; payload: Payload; proposal: z.infer<typeof roofProposalSchema>;
  expectedRevision?: number;
}) {
  const rules = await input.payload.find({ collection: "price-rules", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: { and: [{ serviceKey: { equals: input.lead.inquiryType } }, { status: { equals: "approved" } }] } });
  const prepared = prepareMeasurement({ proposal: input.proposal, addressResolved: true, sourceAuthorized: input.imageryLicensed, hasApprovedPriceRule: rules.totalDocs > 0 });
  if (!prepared.calculation) throw new TypeError(`Measurement cannot be calculated: ${prepared.gate.reasons.join(", ")}`);
  const prior = await priorMeasurement(input.payload, input.leadId);
  const version = (prior?.version ?? 0) + 1;
  const generatedAt = new Date();
  const measurement = await input.payload.create({ collection: "roof-measurements", overrideAccess: true, data: {
    reference: `TM-${input.leadId}-V${version}`, lead: input.leadId, version, supersedes: prior?.id,
    measurementMode: "schematic", normalizedAddress: input.address.label, addressSourceId: input.address.id,
    latitude: input.address.latitude, longitude: input.address.longitude, buildingIdentifier: prepared.proposal.buildingIdentifier ?? undefined,
    source: input.imagerySource, sourceUrl: input.imagerySourceUrl, license: input.license, credits: input.credits,
    imageryLicensed: input.imageryLicensed, capturedAt: generatedAt.toISOString(), mapImage: input.mapImageId,
    candidateBuildings: input.candidates, evidenceSource: input.imagerySource, evidenceAttribution: input.credits,
    roofPlanes: prepared.proposal.roofPlanes, horizontalAreaTenths: prepared.calculation.horizontalAreaTenths,
    actualAreaMinTenths: prepared.calculation.actualAreaMinTenths, actualAreaMaxTenths: prepared.calculation.actualAreaMaxTenths,
    calculationSnapshot: prepared.calculation, inputHash: prepared.inputHash, confidence: prepared.proposal.confidence,
    confidenceReasoning: prepared.proposal.confidenceReasoning, status: prepared.status, blockingReasons: prepared.gate.reasons,
  } });
  try {
    await persistSchematicMeasurementEvidence({ payload: input.payload, leadId: input.leadId, measurementId: measurement.id, address: input.address.label, addressPoint: { latitude: input.address.latitude, longitude: input.address.longitude }, candidates: input.candidates, selectedBuildingId: String(prepared.proposal.buildingIdentifier), source: input.imagerySource, attribution: input.credits, generatedAt });
  } catch (error) {
    await input.payload.delete({ collection: "roof-measurements", id: measurement.id, overrideAccess: true }).catch(() => undefined);
    throw error;
  }
  if (prior && prior.status !== "approved") await input.payload.update({ collection: "roof-measurements", id: prior.id, overrideAccess: true, data: { status: "superseded" } });
  await updateCaseState(input.payload, { leadId: input.leadId, actorId: input.actorId, expectedRevision: input.expectedRevision, command: "measurement_candidate_selected", idempotencyKey: `measurement-candidate:${measurement.id}`, patch: { status: "measuring", nextActionOwner: "administrator", nextActionBlocker: null, nextAction: "Kontroller og godkjenn valgt bygning og takmåling.", nextActionAt: generatedAt.toISOString() } });
  return { measurement, gate: prepared.gate, prior };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const params = new URL(request.url).searchParams;
  const leadId = Number(params.get("leadId"));
  if (Number.isInteger(leadId) && leadId > 0) {
    const lead = await auth.payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
    const query = uniqueAddressParts([lead.address, lead.houseNumber, lead.postal, lead.city]).join(" ");
    if (query.length < 4) return NextResponse.json({ error: "Address is incomplete", code: "ADDRESS_REQUIRED", addresses: [], candidates: [] }, { status: 409 });
    const addresses = await new KartverketAddressProvider().searchAddress(query);
    const selectedAddress = addresses.find((address) => !lead.postal || address.postalCode === lead.postal) || addresses[0];
    if (!selectedAddress) return NextResponse.json({ error: "Kartverket could not resolve the address", code: "ADDRESS_NOT_FOUND", addresses: [], candidates: [] }, { status: 409 });
    let candidates: BuildingFootprintCandidate[];
    try {
      candidates = await new OpenStreetMapBuildingProvider().findBuildings({ latitude: selectedAddress.latitude, longitude: selectedAddress.longitude });
    } catch {
      return NextResponse.json({ error: "Building service is temporarily unavailable. Correct the case manually or try again.", code: "BUILDING_SERVICE_UNAVAILABLE", addresses, selectedAddress, candidates: [] }, { status: 503 });
    }
    return NextResponse.json({ addresses, selectedAddress, candidates, imagery: norgeIBilderAccess() });
  }
  const query = params.get("query") ?? "";
  const addresses = query.length >= 4 ? await new KartverketAddressProvider().searchAddress(query) : [];
  return NextResponse.json({ addresses, imagery: norgeIBilderAccess() });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid measurement data", details: parsed.error.flatten() }, { status: 400 });
  const { payload, user } = auth;
  const lead = await payload.findByID({ collection: "leads", id: parsed.data.leadId, depth: 0, overrideAccess: true });
  if (parsed.data.expectedRevision !== undefined && Number(lead.caseRevision || 1) !== parsed.data.expectedRevision) {
    return NextResponse.json({ error: "Case was changed by another administrator. Refresh before saving.", code: "CASE_REVISION_CONFLICT", expected: parsed.data.expectedRevision, actual: Number(lead.caseRevision || 1) }, { status: 409 });
  }
  const correlationId = correlationIdFromHeaders(request.headers);
  if (parsed.data.action !== "create") {
    const activeQuotes = await payload.find({ collection: "quotes", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: { and: [{ lead: { equals: lead.id } }, { status: { not_equals: "superseded" } }] } });
    if (activeQuotes.docs[0] && activeQuotes.docs[0].status !== "draft") {
      return NextResponse.json({ error: "An issued or accepted quote requires a controlled change agreement", code: "CONTROLLED_CHANGE_REQUIRED" }, { status: 409 });
    }
  }

  if (parsed.data.action === "create_manual") {
    const prior = await priorMeasurement(payload, lead.id);
    const areaTenths = Math.round(parsed.data.areaSquareMeters * 10);
    const priorArea = Number(prior?.actualAreaMaxTenths || 0);
    const differencePercent = manualAreaDeviationPercent(priorArea || undefined, areaTenths);
    if (differencePercent > 20 && !parsed.data.confirmLargeDeviation) return NextResponse.json({ error: "Manual area differs by more than 20%", requiresConfirmation: true, differencePercent: Math.round(differencePercent * 10) / 10 }, { status: 409 });
    const now = new Date().toISOString();
    const version = (prior?.version ?? 0) + 1;
    const snapshot = { mode: "manual_no_visual", manualOverride: { areaTenths, source: parsed.data.manualAreaSource, reason: parsed.data.reason, overriddenBy: user.id, overriddenAt: now }, formula: "Godkjent manuelt takareal brukes som prisgrunnlag; arealet kontrolleres på stedet før arbeid." };
    const measurement = await payload.create({ collection: "roof-measurements", overrideAccess: true, data: {
      reference: `TM-${lead.id}-V${version}`, lead: lead.id, version, supersedes: prior?.id, measurementMode: "manual_no_visual",
      normalizedAddress: uniqueAddressParts([lead.address, lead.houseNumber, lead.postal, lead.city]).join(" ") || "Adresse ikke verifisert",
      source: "Manuell arealregistrering", license: "Ikke aktuelt", credits: "Ingen visuell kilde", imageryLicensed: false, capturedAt: now,
      roofPlanes: [], horizontalAreaTenths: areaTenths, actualAreaMinTenths: areaTenths, actualAreaMaxTenths: areaTenths,
      calculationSnapshot: snapshot, inputHash: measurementSnapshotHash({ ...snapshot, version }), confidence: "medium", confidenceReasoning: `Manuelt areal: ${parsed.data.reason}`,
      status: "review_required", blockingReasons: [], manualAreaSource: parsed.data.manualAreaSource, manualAreaReason: parsed.data.reason,
    } });
    if (prior && prior.status !== "approved") await payload.update({ collection: "roof-measurements", id: prior.id, overrideAccess: true, data: { status: "superseded" } });
    await updateCaseState(payload, { leadId: lead.id, actorId: user.id, expectedRevision: parsed.data.expectedRevision, command: "manual_no_visual_measurement", idempotencyKey: `manual-no-visual:${measurement.id}`, patch: { status: "measuring", nextActionOwner: "administrator", nextActionBlocker: null, nextAction: "Kontroller og godkjenn manuelt takareal uten kart.", nextActionAt: now } });
    await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: user.id, action: "measurement.manual-no-visual-created", entityType: "roof-measurement", entityId: measurement.id, correlationId, changedFields: ["measurementMode", "manualAreaSource", "manualAreaReason", "actualAreaMaxTenths"], metadata: { differencePercent, supersedes: prior?.id } });
    const packageResult = await createPreparedPackageForMeasurement(payload, { leadId: lead.id, measurementId: measurement.id });
    return NextResponse.json({ measurement, differencePercent, package: { calculationId: packageResult.calculation.id, quoteId: packageResult.quote.id, contractId: packageResult.contract.id } }, { status: 201 });
  }

  let result: Awaited<ReturnType<typeof createVisualMeasurement>>;
  let reason = "Administrator-created measurement";
  if (parsed.data.action === "create_from_candidate") {
    const { addressId, buildingId, slopeDegrees } = parsed.data;
    const query = uniqueAddressParts([lead.address, lead.houseNumber, lead.postal, lead.city]).join(" ");
    const addresses = await new KartverketAddressProvider().searchAddress(query);
    const address = addresses.find((candidate) => candidate.id === addressId);
    if (!address) return NextResponse.json({ error: "Address candidate is no longer available" }, { status: 409 });
    const candidates = await new OpenStreetMapBuildingProvider().findBuildings({ latitude: address.latitude, longitude: address.longitude });
    const building = candidates.find((candidate) => candidate.id === buildingId);
    if (!building) return NextResponse.json({ error: "Building candidate is no longer available" }, { status: 409 });
    const [angleMinDegrees, angleMaxDegrees] = slopeBandForPreset(slopeDegrees);
    reason = parsed.data.reason;
    result = await createVisualMeasurement({ payload, actorId: user.id, expectedRevision: parsed.data.expectedRevision, lead, leadId: lead.id, address, candidates, proposal: { buildingIdentifier: building.id, confidence: building.confidence, confidenceReasoning: `${building.confidenceReasoning} Administrator valgte bygget og vinkelgruppen ${slopeDegrees}°: ${parsed.data.reason}`, roofPlanes: [{ id: `${building.id}-roof`, polygon: building.polygon, angleMinDegrees, angleMaxDegrees }] }, imageryLicensed: true, imagerySource: building.source, imagerySourceUrl: building.sourceUrl, license: building.license, credits: building.credits });
  } else {
    const selectedBuildingId = parsed.data.proposal.buildingIdentifier || "manual-building";
    const firstPolygon = parsed.data.proposal.roofPlanes[0]?.polygon;
    if (!firstPolygon?.length) return NextResponse.json({ error: "Selected building polygon is required" }, { status: 409 });
    const candidates = [{ id: selectedBuildingId, label: "Valgt bygg", polygon: firstPolygon, horizontalAreaSquareMeters: 0, distanceToAddressMeters: 0, containsAddress: true, confidence: parsed.data.proposal.confidence, confidenceReasoning: parsed.data.proposal.confidenceReasoning, source: "OpenStreetMap building footprint via Overpass API", sourceUrl: parsed.data.imagerySourceUrl || "https://www.openstreetmap.org", license: "Open Database License (ODbL) 1.0", credits: "© OpenStreetMap contributors" }] satisfies BuildingFootprintCandidate[];
    result = await createVisualMeasurement({ payload, actorId: user.id, expectedRevision: parsed.data.expectedRevision, lead, leadId: lead.id, address: parsed.data.address, candidates, proposal: parsed.data.proposal, imageryLicensed: parsed.data.imageryLicensed, imagerySource: parsed.data.imagerySource, imagerySourceUrl: parsed.data.imagerySourceUrl, license: parsed.data.license, credits: parsed.data.credits, mapImageId: parsed.data.mapImageId });
  }
  await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: user.id, action: "measurement.building-selected", entityType: "roof-measurement", entityId: result.measurement.id, correlationId, changedFields: ["buildingIdentifier", "roofPlanes", "candidateBuildings", "evidenceHash"], metadata: { reason, supersedes: result.prior?.id } });
  const packageResult = await createPreparedPackageForMeasurement(payload, { leadId: lead.id, measurementId: result.measurement.id });
  return NextResponse.json({ measurement: result.measurement, gate: result.gate, package: { calculationId: packageResult.calculation.id, quoteId: packageResult.quote.id, contractId: packageResult.contract.id } }, { status: 201 });
}
