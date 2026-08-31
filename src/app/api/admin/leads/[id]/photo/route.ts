import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { ALLOWED_IMAGE_MIMES } from "@/lib/image-mime";
import { parseLeadPhotoUrls } from "@/lib/lead-photo-token";
import { captureException } from "@/lib/monitoring";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";
export const maxDuration = 30;

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

function emptyResponse(status: number) {
  return new NextResponse(null, { headers: privateHeaders, status });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return emptyResponse(401);
    if (!userIsAdmin(user)) return emptyResponse(403);

    const { id } = await context.params;
    const leadId = Number(id);
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(leadId) || leadId <= 0) {
      return emptyResponse(404);
    }
    const rawIndex = new URL(request.url).searchParams.get("index");
    if (!rawIndex || !/^(?:[0-9]|1[0-4])$/.test(rawIndex)) {
      return emptyResponse(404);
    }
    const index = Number(rawIndex);
    if (!process.env.BLOB_READ_WRITE_TOKEN) return emptyResponse(503);

    const lead = await payload
      .findByID({
        collection: "leads",
        depth: 0,
        id: leadId,
        overrideAccess: true,
      })
      .catch(() => null);
    if (!lead) return emptyResponse(404);

    const raw = parseLeadPhotoUrls(lead.photoUrls).slice(0, 15)[index];
    if (!raw) return emptyResponse(404);

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return emptyResponse(404);
    }
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname.endsWith(".blob.vercel-storage.com") ||
      !parsed.pathname.startsWith("/leads/")
    ) {
      return emptyResponse(404);
    }

    const cleanUrl = `${parsed.origin}${parsed.pathname}`;
    const result = await get(cleanUrl, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (
      !result?.stream ||
      result.statusCode !== 200 ||
      !ALLOWED_IMAGE_MIMES.has(result.blob.contentType)
    ) {
      return emptyResponse(404);
    }

    return new NextResponse(result.stream, {
      headers: {
        ...privateHeaders,
        "Content-Type": result.blob.contentType,
      },
    });
  } catch (error) {
    captureException(error, { route: "GET /api/admin/leads/[id]/photo" });
    return emptyResponse(500);
  }
}
