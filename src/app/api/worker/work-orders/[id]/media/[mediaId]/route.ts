import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import { loadAuthorizedWorkOrder } from "@/lib/work-orders/access";

export async function GET(request: Request, context: { params: Promise<{ id: string; mediaId: string }> }) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return new NextResponse(null, { status: 401 });
  const { id, mediaId } = await context.params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(mediaId)) return new NextResponse(null, { status: 404 });
  const order = await loadAuthorizedWorkOrder(payload, Number(id), user);
  if (!order) return new NextResponse(null, { status: 404 });
  const media = await payload.findByID({ collection: "private-media", id: Number(mediaId), depth: 0, overrideAccess: true }).catch(() => null);
  if (!media || media.classification !== "work" || media.ownerType !== "work-order" || media.ownerId !== String(order.id) || !media.mimeType?.startsWith("image/")) return new NextResponse(null, { status: 404 });
  const file = await readPrivateMediaContent(media);
  return new NextResponse(file.data, { headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
