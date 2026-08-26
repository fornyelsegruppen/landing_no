import { NextResponse } from "next/server";
import { PRODUCTION_PILOT_TERMS } from "@/content/production-pilot-terms";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

export async function POST(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (
    process.env.LEGAL_REVIEW_REFERENCE !==
    PRODUCTION_PILOT_TERMS.ownerApprovalReference
  ) {
    return NextResponse.json(
      {
        error:
          "Preview LEGAL_REVIEW_REFERENCE must match the owner-approved pilot reference",
        requiredReference: PRODUCTION_PILOT_TERMS.ownerApprovalReference,
      },
      { status: 409 },
    );
  }

  const [existingResult, previousApprovedResult] = await Promise.all([
    payload.find({
      collection: "contract-terms",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { version: { equals: PRODUCTION_PILOT_TERMS.version } },
    }),
    payload.find({
      collection: "contract-terms",
      depth: 0,
      limit: 20,
      overrideAccess: true,
      where: { status: { equals: "approved" } },
    }),
  ]);
  const existing = existingResult.docs[0];
  if (existing?.status === "approved") {
    return NextResponse.json({
      alreadyActive: true,
      id: existing.id,
      version: existing.version,
    });
  }

  const data = {
    version: PRODUCTION_PILOT_TERMS.version,
    title: PRODUCTION_PILOT_TERMS.title,
    contractText: PRODUCTION_PILOT_TERMS.contractText,
    withdrawalInstructions: PRODUCTION_PILOT_TERMS.withdrawalInstructions,
    withdrawalFormUrl: PRODUCTION_PILOT_TERMS.withdrawalFormUrl,
    status: "approved" as const,
  };
  const terms = existing
    ? await payload.update({
        collection: "contract-terms",
        id: existing.id,
        data,
        overrideAccess: true,
        req: { user },
      })
    : await payload.create({
        collection: "contract-terms",
        data,
        overrideAccess: true,
        req: { user },
      });

  for (const previous of previousApprovedResult.docs) {
    if (previous.id === terms.id) continue;
    await payload.update({
      collection: "contract-terms",
      id: previous.id,
      data: { status: "retired" },
      overrideAccess: true,
      req: { user },
    });
  }

  await recordAuditEvent(createPayloadAuditWriter(payload), {
    actorId: user.id,
    action: "contract-terms.production-pilot-activated",
    entityType: "contract-terms",
    entityId: terms.id,
    correlationId: correlationIdFromHeaders(request.headers),
    changedFields: [
      "version",
      "contractText",
      "withdrawalInstructions",
      "withdrawalFormUrl",
      "status",
    ],
    before: {
      approvedVersions: previousApprovedResult.docs.map((item) => item.version),
    },
    after: {
      version: terms.version,
      legalReviewReference: terms.legalReviewReference,
      status: terms.status,
    },
  });

  return NextResponse.json({ id: terms.id, version: terms.version });
}
