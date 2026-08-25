import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import { loadCustomerQuote } from "@/lib/quotes/customer-view";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const payload = await getPayload();
  const view = await loadCustomerQuote(payload, token);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const measurement = view.snapshot.quote.measurement;
  if (!measurement.evidenceMediaId || !measurement.evidenceHash || measurement.mode === "manual_no_visual") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const media = await payload.findByID({ collection: "private-media", id: measurement.evidenceMediaId, depth: 0, overrideAccess: true });
  const file = await readPrivateMediaContent(media);
  if (createHash("sha256").update(file.data).digest("hex") !== measurement.evidenceHash) {
    return NextResponse.json({ error: "Evidence integrity check failed" }, { status: 409 });
  }
  return new NextResponse(file.data, { headers: {
    "Content-Type": file.contentType,
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  } });
}
