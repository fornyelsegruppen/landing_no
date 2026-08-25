import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { privateLeadBlobUrls, retainedBySignedContract } from "@/lib/retention/lead-retention";
import { purgeCase } from "@/lib/leads/case-lifecycle";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Permanently deletes only cases that an administrator already moved to trash
 * and whose explicit trash retention period has expired. Active and merely
 * archived cases are never selected by this job.
 *
 * Secure with CRON_SECRET (Vercel Cron sends Authorization: Bearer …).
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getPayload();
    const now = new Date();

    const old = await payload.find({
      collection: "leads",
      where: { and: [
        { recordState: { equals: "trashed" } },
        { purgeAfter: { less_than_equal: now.toISOString() } },
      ] },
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
        await purgeCase(payload, lead.id, { confirmation: String(lead.id), reason: "Automated purge after the administrator-approved trash retention period", now });
        await recordAuditEvent(createPayloadAuditWriter(payload), {
          action: "lead.retention_purge",
          entityType: "lead",
          entityId: lead.id,
          correlationId: `retention-${now.toISOString().slice(0, 10)}`,
          changedFields: ["deletedAt"],
          metadata: { retentionConfirmed: true },
        });
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
      purgeCutoff: now.toISOString(),
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
