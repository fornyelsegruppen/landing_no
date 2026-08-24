import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import { loadCustomerQuote } from "@/lib/quotes/customer-view";
import { buildQuoteContractPdf } from "@/lib/quotes/quote-pdf";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const payload = await getPayload();
  const view = await loadCustomerQuote(payload, token);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let bytes: Uint8Array;
  const signedDocumentId = view.companySignedDocumentId || view.signedDocumentId;
  if (signedDocumentId) {
    const media = await payload.findByID({ collection: "private-media", id: signedDocumentId, depth: 0, overrideAccess: true });
    bytes = await readPrivateMediaContent(media).then((file) => new Uint8Array(file.data));
  } else {
    bytes = await buildQuoteContractPdf({ contract: view.snapshot });
  }
  return new NextResponse(Buffer.from(bytes), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${view.contractReference.toLowerCase()}.pdf"`,
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  } });
}
