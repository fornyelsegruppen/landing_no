import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { loadAuthorizedWorkOrder, relationId } from "@/lib/work-orders/access";

function photoUrls(value: unknown) {
  return typeof value === "string" ? value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 15) : [];
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return new NextResponse(null, { status: 404 });
  const order = await loadAuthorizedWorkOrder(payload, Number(id), user);
  if (!order) return new NextResponse(null, { status: 404 });
  const leadId = relationId(order.lead);
  if (!leadId) return new NextResponse(null, { status: 404 });
  const index = Number(new URL(request.url).searchParams.get("index"));
  if (!Number.isInteger(index) || index < 0 || index > 14) return new NextResponse(null, { status: 404 });
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  const raw = photoUrls(lead.photoUrls)[index];
  if (!raw || !process.env.BLOB_READ_WRITE_TOKEN) return new NextResponse(null, { status: 404 });
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return new NextResponse(null, { status: 404 }); }
  if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return new NextResponse(null, { status: 404 });
  const result = await get(`${parsed.origin}${parsed.pathname}`, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result?.stream || result.statusCode !== 200 || !result.blob.contentType.startsWith("image/")) return new NextResponse(null, { status: 404 });
  return new NextResponse(result.stream, { headers: { "Content-Type": result.blob.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
