import { NextResponse } from "next/server";
import { userIsAdmin } from "@/payload/access/roles";
import { getPayload } from "@/lib/payload";
import { assertRoofFusionPreviewEnabledV1 } from "@/lib/roof-fusion/preview-read-adapters-v1";
import {
  fetchEnturAutocompleteV1,
  normalizeEnturAutocompleteQueryV1,
  type EnturAddressSuggestionV1,
} from "@/lib/providers/entur-geocoder-v3";

export const maxDuration = 10;

const CACHE_TTL_MS = 60_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const cache = new Map<
  string,
  { expiresAt: number; suggestions: EnturAddressSuggestionV1[] }
>();
const rates = new Map<string, number[]>();

export function resetEnturAutocompleteRouteStateForTests() {
  cache.clear();
  rates.clear();
}

function rateAllowed(actorId: string, now: number) {
  const recent = (rates.get(actorId) ?? []).filter(
    (timestamp) => timestamp > now - RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT) {
    rates.set(actorId, recent);
    return false;
  }
  rates.set(actorId, [...recent, now]);
  return true;
}

export async function GET(request: Request) {
  try {
    assertRoofFusionPreviewEnabledV1(process.env);
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user)
      return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
    if (!userIsAdmin(user))
      return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
    const query = normalizeEnturAutocompleteQueryV1(
      new URL(request.url).searchParams.get("q") ?? "",
    );
    if (query.length < 3 || query.length > 120) {
      return NextResponse.json({ code: "INVALID_QUERY" }, { status: 400 });
    }
    const now = Date.now();
    if (!rateAllowed(String(user.id), now)) {
      return NextResponse.json(
        { code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    const key = query.toLocaleLowerCase("nb-NO");
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(
        { suggestions: cached.suggestions, source: "Kartverket per Entur" },
        { headers: { "Cache-Control": "private, max-age=30" } },
      );
    }
    const suggestions = await fetchEnturAutocompleteV1(query);
    cache.set(key, { expiresAt: now + CACHE_TTL_MS, suggestions });
    return NextResponse.json(
      { suggestions, source: "Kartverket per Entur" },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch {
    return NextResponse.json(
      { code: "AUTOCOMPLETE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
