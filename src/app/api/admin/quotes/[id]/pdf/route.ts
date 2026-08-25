import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { buildQuoteContractPdf } from "@/lib/quotes/quote-pdf";
import type { ContractSnapshot } from "@/lib/quotes/document";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid quote" }, { status: 400 });
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const contracts = await payload.find({ collection: "contracts", depth: 0, limit: 1, overrideAccess: true, where: { quote: { equals: Number(id) } } });
  const contract = contracts.docs[0];
  if (!contract) return NextResponse.json({ error: "Contract draft not found" }, { status: 404 });
  const bytes = await buildQuoteContractPdf({ contract: contract.snapshot as ContractSnapshot });
  return new NextResponse(Buffer.from(bytes), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${contract.reference.toLowerCase()}.pdf"`,
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  } });
}
