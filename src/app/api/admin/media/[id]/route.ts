import { NextResponse } from "next/server";
import { captureException } from "@/lib/monitoring";
import { getPayload } from "@/lib/payload";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const media = await payload.findByID({ collection: "private-media", id: Number(id), depth: 0, overrideAccess: true }).catch(() => null);
    if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const file = await readPrivateMediaContent(media);
    const safeFilename = file.filename.replace(/[\r\n"\\]/g, "_");
    return new NextResponse(file.data, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Content-Type": file.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    captureException(error, { route: "GET /api/admin/media/[id]" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
