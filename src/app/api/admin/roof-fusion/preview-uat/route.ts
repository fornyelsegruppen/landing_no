import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAdminNextR4CaseIdentityV1 } from "@/lib/admin-next/r4-read-adapter";
import { FeatureUnavailableError } from "@/lib/platform/features";
import { getPayload } from "@/lib/payload";
import { PayloadRoofSnapshotRepositoryV1 } from "@/lib/roof-fusion/payload-repository-v1";
import {
  assertRoofFusionPreviewEnabledV1,
  PayloadRoofFusionCaseAuthorizationV1,
  RoofFusionPreviewReadErrorV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";
import {
  prepareRoofFusionPreviewUatGoldenV1,
  RoofFusionPreviewUatConflictErrorV1,
} from "@/lib/roof-fusion/preview-uat-golden-v1";
import { RoofRepositoryCommandErrorV1 } from "@/lib/roof-fusion/repository-contract-v1";
import { userIsAdmin } from "@/payload/access/roles";

const requestSchema = z
  .object({
    caseReference: z.string().regex(/^TF-[1-9]\d*$/u),
    confirmation: z.literal("prepare-roof-fusion-preview-uat-golden.v1"),
  })
  .strict();

function previewDenied(error: unknown) {
  return (
    error instanceof FeatureUnavailableError ||
    (error instanceof RoofFusionPreviewReadErrorV1 &&
      error.code === "PREVIEW_REQUIRED")
  );
}

export async function POST(request: Request) {
  try {
    assertRoofFusionPreviewEnabledV1(process.env);
  } catch (error) {
    if (previewDenied(error)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const identity = parseAdminNextR4CaseIdentityV1(parsed.data.caseReference);
  if (!identity) {
    return NextResponse.json({ error: "Invalid case" }, { status: 400 });
  }

  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userIsAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authorization = new PayloadRoofFusionCaseAuthorizationV1(payload);
  try {
    await authorization.assertAdminCaseAccess(identity.roofFusionCaseId, user);
    const result = await prepareRoofFusionPreviewUatGoldenV1({
      repository: new PayloadRoofSnapshotRepositoryV1(payload),
      leadId: identity.leadId,
    });
    return NextResponse.json(
      {
        ...result,
        caseReference: identity.caseReference,
        previewHref: `/admin-next-preview/cases/${identity.caseReference}/measurements/${result.snapshot.snapshotId}`,
      },
      { status: result.status === "prepared" ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof RoofFusionPreviewReadErrorV1) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "CASE_NOT_FOUND" ? 404 : 403 },
      );
    }
    if (error instanceof RoofFusionPreviewUatConflictErrorV1) {
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    if (error instanceof RoofRepositoryCommandErrorV1) {
      return NextResponse.json(
        { error: error.code },
        { status: error.suggestedHttpStatus },
      );
    }
    throw error;
  }
}
