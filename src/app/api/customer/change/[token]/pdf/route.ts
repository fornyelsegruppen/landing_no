import { NextResponse } from "next/server";
import { buildAcceptedChangePdf } from "@/lib/change-agreements/change-pdf";
import { loadCustomerChange } from "@/lib/change-agreements/customer-view";
import { getPayload } from "@/lib/payload";
import { readPrivateMediaContent } from "@/lib/private-media-content";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const payload = await getPayload(); const { token } = await context.params; const view = await loadCustomerChange(payload, token); if (!view) return new NextResponse(null, { status: 404 });
  let bytes: Uint8Array;
  if (view.acceptedDocumentId) { const media = await payload.findByID({ collection: "private-media", id: view.acceptedDocumentId, depth: 0, overrideAccess: true }); bytes = await readPrivateMediaContent(media).then((file) => file.data); }
  else bytes = await buildAcceptedChangePdf(view.snapshot);
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${view.snapshot.reference}.pdf"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
