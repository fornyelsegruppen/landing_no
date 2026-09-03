import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import {
  assertRoofFusionPreviewEnabledV1,
  PayloadRoofFusionCaseAuthorizationV1,
  RoofFusionPreviewReadErrorV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";
import {
  invokeWorkbenchHeightAdapterV1,
  RoofFusionWorkbenchHeightAdapterErrorV1,
} from "@/lib/roof-fusion/workbench-height-adapter-v1";
import { PayloadRoofFusionWorkbenchDraftRepositoryV1 } from "@/lib/roof-fusion/workbench-draft-repository-v1";
import { userIsAdmin } from "@/payload/access/roles";

const identifier = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const requestSchema = z.object({
  caseId: identifier,
  draftId: identifier,
  draftHash: sha256,
  targetSnapshotId: identifier,
  previousSnapshotId: identifier.optional(),
  idempotencyKey: z.string().trim().min(8).max(300),
  heightSurface: z.unknown(),
  orthophoto: z.unknown(),
}).strict();

function errorResponse(error: unknown) {
  if (error instanceof RoofFusionPreviewReadErrorV1) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === "CASE_NOT_FOUND" || error.code === "PREVIEW_REQUIRED" ? 404 : 403 });
  }
  if (error instanceof RoofFusionWorkbenchHeightAdapterErrorV1) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
  }
  return NextResponse.json({ error: "Workbench height calculation could not be prepared", code: "INVALID_HEIGHT_INPUT" }, { status: 400 });
}

/** A Preview/UAT-only calculation preparation endpoint. It never persists or prices a snapshot. */
export async function POST(request: Request) {
  try {
    assertRoofFusionPreviewEnabledV1(process.env);
    const body = requestSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Invalid workbench height request", code: "INVALID_HEIGHT_INPUT" }, { status: 400 });
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await new PayloadRoofFusionCaseAuthorizationV1(payload).assertAdminCaseAccess(body.data.caseId, user);
    const draft = await new PayloadRoofFusionWorkbenchDraftRepositoryV1(payload).readDraft(body.data.caseId, body.data.draftId);
    if (!draft || draft.draftHash !== body.data.draftHash) {
      return NextResponse.json({ error: "Draft is stale or not found", code: "STALE_DRAFT" }, { status: 409 });
    }
    if (draft.actor.actorId !== String(user.id)) {
      return NextResponse.json({ error: "Draft actor does not match the authenticated administrator", code: "ACTOR_MISMATCH" }, { status: 403 });
    }
    const result = invokeWorkbenchHeightAdapterV1({
      draft,
      targetSnapshotId: body.data.targetSnapshotId,
      ...(body.data.previousSnapshotId ? { previousSnapshotId: body.data.previousSnapshotId } : {}),
      idempotencyKey: body.data.idempotencyKey,
      requestedAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      heightSurface: body.data.heightSurface,
      orthophoto: body.data.orthophoto,
    });
    return NextResponse.json({
      status: result.summary.status,
      pricingReady: false,
      summary: result.summary,
      snapshot: {
        snapshotId: result.snapshot.snapshotId,
        state: result.snapshot.state,
        measurementClass: result.snapshot.measurement.class,
      },
    }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
