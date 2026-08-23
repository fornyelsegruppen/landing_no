import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { privateLeadBlobUrls, retainedBySignedContract } from "@/lib/retention/lead-retention";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Deletes leads older than Site Settings retentionMonths, and best-effort
 * cleans matching private Blob objects under leads/.
 *
 * Secure with CRON_SECRET (Vercel Cron sends Authorization: Bearer …).
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getPayload();
    const settings = await payload.findGlobal({
      slug: "site-settings",
      depth: 0,
      draft: false,
      overrideAccess: true,
    });
    const months =
      typeof settings.retentionMonths === "number" &&
      settings.retentionMonths > 0
        ? settings.retentionMonths
        : 24;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const old = await payload.find({
      collection: "leads",
      where: {
        createdAt: { less_than: cutoff.toISOString() },
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    });

    let deleted = 0;
    let retainedForLegalBasis = 0;
    let failed = 0;
    const deletedBlobUrls = new Set<string>();
    for (const lead of old.docs) {
      try {
        await payload.delete({ collection: "leads", id: lead.id, overrideAccess: true });
        for (const url of privateLeadBlobUrls(lead.photoUrls)) deletedBlobUrls.add(url);
        deleted += 1;
      } catch (error) {
        if (retainedBySignedContract(error)) retainedForLegalBasis += 1;
        else { failed += 1; captureException(error, { route: "GET /api/cron/purge-leads", operation: "lead-delete", leadId: lead.id }); }
      }
    }

    let blobsDeleted = 0;
    if (process.env.BLOB_READ_WRITE_TOKEN && deletedBlobUrls.size) {
      try {
        await del([...deletedBlobUrls], { token: process.env.BLOB_READ_WRITE_TOKEN });
        blobsDeleted = deletedBlobUrls.size;
      } catch (err) {
        captureException(err, {
          route: "GET /api/cron/purge-leads",
          operation: "blob-purge",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      retentionMonths: months,
      cutoff: cutoff.toISOString(),
      leadsDeleted: deleted,
      retainedForLegalBasis,
      failures: failed,
      blobsDeleted,
    });
  } catch (err) {
    captureException(err, { route: "GET /api/cron/purge-leads" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
