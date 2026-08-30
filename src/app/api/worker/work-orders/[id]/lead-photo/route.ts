import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { loadAuthorizedWorkOrder, relationId } from "@/lib/work-orders/access";
import { workerPortalAvailable, workerPrivateNoStoreHeaders } from "@/lib/worker-portal/gate";

function emptyPrivateResponse(status: number) {
  return new NextResponse(null, { status, headers: workerPrivateNoStoreHeaders });
}

function photoUrls(value: unknown) {
  return typeof value === "string" ? value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 15) : [];
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!workerPortalAvailable()) return emptyPrivateResponse(503);
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return emptyPrivateResponse(401);
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return emptyPrivateResponse(404);
  const order = await loadAuthorizedWorkOrder(payload, Number(id), user);
  if (!order) return emptyPrivateResponse(404);
  const leadId = relationId(order.lead);
  if (!leadId) return emptyPrivateResponse(404);
  const index = Number(new URL(request.url).searchParams.get("index"));
  if (!Number.isInteger(index) || index < 0 || index > 14) return emptyPrivateResponse(404);
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  const raw = photoUrls(lead.photoUrls)[index];
  if (!raw || !process.env.BLOB_READ_WRITE_TOKEN) return emptyPrivateResponse(404);
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return emptyPrivateResponse(404); }
  if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return emptyPrivateResponse(404);
  const result = await get(`${parsed.origin}${parsed.pathname}`, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result?.stream || result.statusCode !== 200 || !result.blob.contentType.startsWith("image/")) return emptyPrivateResponse(404);
  return new NextResponse(result.stream, { headers: { "Content-Type": result.blob.contentType, ...workerPrivateNoStoreHeaders, "X-Content-Type-Options": "nosniff" } });
}
