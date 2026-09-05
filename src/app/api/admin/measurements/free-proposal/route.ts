import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import {
  assertFeatureReady,
  FeatureUnavailableError,
} from "@/lib/platform/features";
import { OpenStreetMapBuildingProvider } from "@/lib/providers/osm-building-provider";
import { userIsAdmin } from "@/payload/access/roles";
import { verifiedLeadAddressCandidate } from "@/lib/leads/address-verification";

export const runtime = "nodejs";
export const maxDuration = 30;

const inputSchema = z.object({
  leadId: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    assertFeatureReady("roofMeasurement");
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid lead" }, { status: 400 });
    const lead = await payload.findByID({
      collection: "leads",
      id: parsed.data.leadId,
      depth: 0,
      overrideAccess: true,
    });
    const address = verifiedLeadAddressCandidate(lead);
    if (!address) {
      return NextResponse.json(
        {
          error:
            "The case address must be server-verified before automatic roof measurement.",
          code: "ADDRESS_UNVERIFIED",
        },
        { status: 409 },
      );
    }
    const candidates = await new OpenStreetMapBuildingProvider().findBuildings({
      latitude: address.latitude,
      longitude: address.longitude,
    });
    if (!candidates.length) {
      return NextResponse.json(
        {
          address,
          candidates: [],
          error:
            "No usable OpenStreetMap building footprint was found near this address. Use manual measurement or add the missing building to OpenStreetMap.",
          code: "BUILDING_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      address,
      candidates,
      selectedCandidateId: candidates[0].id,
      method: "free-osm-footprint",
      notice:
        "Preliminary footprint only. Select the correct building and roof slope; administrator approval is mandatory.",
    });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json(
        { error: error.reason, missing: error.unavailable },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Automatic building lookup failed",
      },
      { status: 502 },
    );
  }
}
