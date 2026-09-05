import { NextResponse } from "next/server";
import { z } from "zod";
import { captureException } from "@/lib/monitoring";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { KartverketAddressProvider } from "@/lib/providers/kartverket-address-provider";

export const runtime = "nodejs";

const querySchema = z.string().trim().min(4).max(180);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const limited = await rateLimit("public-address-search", clientIp(request), {
    limit: 30,
    windowSec: 60,
  });
  if (!limited.success) {
    return json({ error: "Address search is temporarily unavailable" }, 429);
  }

  const parsed = querySchema.safeParse(
    new URL(request.url).searchParams.get("q"),
  );
  if (!parsed.success) {
    return json(
      { error: "Search query must contain 4 to 180 characters" },
      400,
    );
  }

  try {
    const candidates = await new KartverketAddressProvider().searchAddress(
      parsed.data,
    );
    return json({
      items: candidates.slice(0, 10).map((candidate) => ({
        provider: "kartverket-address-rest-v1" as const,
        providerAddressId: candidate.id,
        canonicalLabel: candidate.label,
        streetAddress: candidate.streetAddress,
        postalCode: candidate.postalCode,
        city: candidate.city,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      })),
    });
  } catch (error) {
    captureException(error, {
      route: "GET /api/address-search",
      operation: "kartverket-address-search",
    });
    return json({ error: "Address search is temporarily unavailable" }, 502);
  }
}
