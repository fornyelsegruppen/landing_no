import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { KartverketAddressProvider, norgeIBilderAccess } from "@/lib/providers/kartverket-address-provider";
import { prepareMeasurement, roofProposalSchema } from "@/lib/measurements/proposal";
import { userIsAdmin } from "@/payload/access/roles";

const candidateSchema = z.object({
  id: z.string(), label: z.string(), postalCode: z.string(), city: z.string(),
  latitude: z.number(), longitude: z.number(), source: z.string(),
});
const createSchema = z.object({
  action: z.literal("create"),
  leadId: z.number().int().positive(),
  address: candidateSchema,
  proposal: roofProposalSchema,
  imageryLicensed: z.boolean(),
  imagerySource: z.string().min(3).max(300),
  imagerySourceUrl: z.string().url().optional(),
  license: z.string().min(3).max(200),
  credits: z.string().min(3).max(200),
  mapImageId: z.number().int().positive().optional(),
});

async function authorize(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!userIsAdmin(user)) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { payload, user };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const query = new URL(request.url).searchParams.get("query") ?? "";
  const addresses = query.length >= 4 ? await new KartverketAddressProvider().searchAddress(query) : [];
  return NextResponse.json({ addresses, imagery: norgeIBilderAccess() });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid measurement data", details: parsed.error.flatten() }, { status: 400 });

  const { payload } = auth;
  const lead = await payload.findByID({ collection: "leads", id: parsed.data.leadId, depth: 0, overrideAccess: true });
  const rule = await payload.find({
    collection: "price-rules", depth: 0, limit: 1, sort: "-version", overrideAccess: true,
    where: { and: [{ serviceKey: { equals: lead.inquiryType } }, { status: { equals: "approved" } }] },
  });
  const prepared = prepareMeasurement({
    proposal: parsed.data.proposal,
    addressResolved: true,
    sourceAuthorized: parsed.data.imageryLicensed,
    hasApprovedPriceRule: rule.totalDocs > 0,
  });
  const prior = await payload.find({
    collection: "roof-measurements", depth: 0, limit: 1, sort: "-version", overrideAccess: true,
    where: { lead: { equals: parsed.data.leadId } },
  });
  const version = (prior.docs[0]?.version ?? 0) + 1;
  const measurement = await payload.create({
    collection: "roof-measurements", overrideAccess: true,
    data: {
      reference: `TM-${parsed.data.leadId}-V${version}`,
      lead: parsed.data.leadId,
      version,
      supersedes: prior.docs[0]?.id,
      normalizedAddress: parsed.data.address.label,
      addressSourceId: parsed.data.address.id,
      latitude: parsed.data.address.latitude,
      longitude: parsed.data.address.longitude,
      buildingIdentifier: prepared.proposal.buildingIdentifier ?? undefined,
      source: parsed.data.imagerySource,
      sourceUrl: parsed.data.imagerySourceUrl,
      license: parsed.data.license,
      credits: parsed.data.credits,
      imageryLicensed: parsed.data.imageryLicensed,
      capturedAt: new Date().toISOString(),
      mapImage: parsed.data.mapImageId,
      roofPlanes: prepared.proposal.roofPlanes,
      horizontalAreaTenths: prepared.calculation?.horizontalAreaTenths ?? 0,
      actualAreaMinTenths: prepared.calculation?.actualAreaMinTenths ?? 0,
      actualAreaMaxTenths: prepared.calculation?.actualAreaMaxTenths ?? 0,
      calculationSnapshot: prepared.calculation,
      inputHash: prepared.inputHash,
      confidence: prepared.proposal.confidence,
      confidenceReasoning: prepared.proposal.confidenceReasoning,
      status: prepared.status,
      blockingReasons: prepared.gate.reasons,
    },
  });
  if (prior.docs[0]) {
    await payload.update({ collection: "roof-measurements", id: prior.docs[0].id, overrideAccess: true, data: { status: "superseded" } });
  }
  await payload.update({ collection: "leads", id: lead.id, overrideAccess: true, data: {
    status: "measuring",
    nextAction: prepared.gate.allowed ? "Kontroller og godkjenn takmålingen." : `Takmåling blokkert: ${prepared.gate.reasons.join(", ")}`,
  } });
  return NextResponse.json({ measurement, gate: prepared.gate }, { status: 201 });
}
