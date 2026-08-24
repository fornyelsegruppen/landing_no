import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { KartverketAddressProvider } from "@/lib/providers/kartverket-address-provider";
import { OpenStreetMapBuildingProvider } from "@/lib/providers/osm-building-provider";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";
export const maxDuration = 30;

const inputSchema = z.object({
  leadId: z.number().int().positive(),
});

function usableAddress(value: unknown): value is string {
  return typeof value === "string"
    && value.trim().length >= 4
    && !/^ikke oppgitt$/i.test(value.trim());
}

export async function POST(request: Request) {
  try {
    assertFeatureReady("roofMeasurement");
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid lead" }, { status: 400 });
    const lead = await payload.findByID({
      collection: "leads",
      id: parsed.data.leadId,
      depth: 0,
      overrideAccess: true,
    });
    if (!usableAddress(lead.address)) {
      return NextResponse.json({
        error: "Exact address is required for automatic roof measurement. Add and save the address first.",
        code: "ADDRESS_REQUIRED",
      }, { status: 409 });
    }

    const query = [lead.address.trim(), lead.postal, lead.city].filter(Boolean).join(", ");
    const addresses = await new KartverketAddressProvider().searchAddress(query);
    if (!addresses.length) {
      return NextResponse.json({
        error: "Kartverket could not resolve the saved address. Check house number and postal code.",
        code: "ADDRESS_NOT_FOUND",
      }, { status: 404 });
    }

    const address = addresses[0];
    const candidates = await new OpenStreetMapBuildingProvider().findBuildings({
      latitude: address.latitude,
      longitude: address.longitude,
    });
    if (!candidates.length) {
      return NextResponse.json({
        address,
        candidates: [],
        error: "No usable OpenStreetMap building footprint was found near this address. Use manual measurement or add the missing building to OpenStreetMap.",
        code: "BUILDING_NOT_FOUND",
      }, { status: 404 });
    }

    return NextResponse.json({
      address,
      candidates,
      selectedCandidateId: candidates[0].id,
      method: "free-osm-footprint",
      notice: "Preliminary footprint only. Select the correct building and roof slope; administrator approval is mandatory.",
    });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Automatic building lookup failed",
    }, { status: 502 });
  }
}
