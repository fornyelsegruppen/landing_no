import { NextResponse } from "next/server";
import { buildAcceptedChangePdf } from "@/lib/change-agreements/change-pdf";
import { changeAgreementSnapshotSchema } from "@/lib/change-agreements/document";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return new NextResponse(null, { status: 401 });
  if (!userIsAdmin(user)) return new NextResponse(null, { status: 403 });
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return new NextResponse(null, { status: 400 });
  const agreement = await payload.findByID({ collection: "change-agreements", id: Number(id), depth: 0, overrideAccess: true });
  const snapshot = changeAgreementSnapshotSchema.parse(agreement.snapshot);
  const evidence = agreement.acceptanceEvidence && typeof agreement.acceptanceEvidence === "object"
    ? agreement.acceptanceEvidence as { customerName: string; acceptedAt: string; documentHash: string }
    : undefined;
  const bytes = await buildAcceptedChangePdf(snapshot, evidence);
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${snapshot.reference}.pdf"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
