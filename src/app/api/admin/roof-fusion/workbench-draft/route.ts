import { NextResponse } from "next/server";
import { z } from "zod";
import { userIsAdmin } from "@/payload/access/roles";
import { getPayload } from "@/lib/payload";
import {
  assertRoofFusionPreviewEnabledV1,
  PayloadRoofFusionCaseAuthorizationV1,
  RoofFusionPreviewReadErrorV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";
import {
  parseRoofFusionWorkbenchDraftV1,
  type RoofFusionWorkbenchDraftReferenceV1,
} from "@/lib/roof-fusion/workbench-draft-contract-v1";
import { AssistedManualRoofGeometryValidationError } from "@/lib/roof-fusion/assisted-manual-roof-geometry-v1";
import {
  PayloadRoofFusionWorkbenchDraftRepositoryV1,
  RoofFusionWorkbenchDraftRepositoryError,
} from "@/lib/roof-fusion/workbench-draft-repository-v1";

const referenceSchema = z
  .object({
    draftId: z.string().min(1),
    revision: z.number().int().positive(),
    draftHash: z.string().regex(/^[a-f0-9]{64}$/u),
    state: z.enum(["draft", "review_required", "blocked"]),
  })
  .strict();
const requestSchema = z
  .object({
    draft: z.unknown(),
    expectedLatest: referenceSchema.nullable().default(null),
  })
  .strict();
const loadSchema = z
  .object({
    caseId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u),
    draftId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u).optional(),
  })
  .strict();

function errorResponse(error: unknown) {
  if (error instanceof AssistedManualRoofGeometryValidationError) {
    return NextResponse.json(
      {
        error: "Workbench geometry failed validation",
        code: error.issues[0]?.code ?? "INVALID_GEOMETRY",
      },
      { status: 400 },
    );
  }
  if (error instanceof RoofFusionPreviewReadErrorV1) {
    const status = error.code === "CASE_NOT_FOUND" ? 404 : error.code === "PREVIEW_REQUIRED" ? 404 : 403;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  if (error instanceof RoofFusionWorkbenchDraftRepositoryError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
  }
  return NextResponse.json({ error: "Workbench draft could not be saved", code: "INVALID_DRAFT" }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    assertRoofFusionPreviewEnabledV1(process.env);
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsedBody = requestSchema.safeParse(await request.json());
    if (!parsedBody.success) return NextResponse.json({ error: "Invalid workbench draft request", code: "INVALID_DRAFT" }, { status: 400 });
    const draft = parseRoofFusionWorkbenchDraftV1(parsedBody.data.draft);
    if (draft.actor.actorId !== String(user.id)) {
      return NextResponse.json({ error: "Draft actor does not match the authenticated administrator", code: "ACTOR_MISMATCH" }, { status: 403 });
    }
    await new PayloadRoofFusionCaseAuthorizationV1(payload).assertAdminCaseAccess(
      draft.caseId,
      user,
    );
    const repository = new PayloadRoofFusionWorkbenchDraftRepositoryV1(payload);
    const status = await repository.appendAtomically({
      draft,
      expectedLatest: parsedBody.data.expectedLatest as RoofFusionWorkbenchDraftReferenceV1 | null,
    });
    const reference = {
      draftId: draft.draftId,
      caseId: draft.caseId,
      revision: draft.revision,
      draftHash: draft.draftHash,
      state: draft.state,
    };
    return NextResponse.json(
      {
        status,
        draft: reference,
        // This is deliberately explicit so a UAT client can distinguish a
        // successful CAS append from an idempotent transport replay.
        confirmation: {
          kind: "case_scoped_cas_idempotency.v1",
          caseId: draft.caseId,
          idempotencyKey: draft.idempotencyKey,
          status,
          latest: reference,
        },
      },
      { status: status === "applied" ? 201 : 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Preview-only, administrator-authorized draft load.  The case ID is always
 * checked before either a latest or historical append-only revision is read.
 */
export async function GET(request: Request) {
  try {
    assertRoofFusionPreviewEnabledV1(process.env);
    const parsedQuery = loadSchema.safeParse({
      caseId: new URL(request.url).searchParams.get("caseId") ?? "",
      ...(new URL(request.url).searchParams.get("draftId")
        ? { draftId: new URL(request.url).searchParams.get("draftId") }
        : {}),
    });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: "Invalid workbench draft lookup", code: "INVALID_LOOKUP" }, { status: 400 });
    }
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await new PayloadRoofFusionCaseAuthorizationV1(payload).assertAdminCaseAccess(
      parsedQuery.data.caseId,
      user,
    );
    const repository = new PayloadRoofFusionWorkbenchDraftRepositoryV1(payload);
    const draft = parsedQuery.data.draftId
      ? await repository.readDraft(parsedQuery.data.caseId, parsedQuery.data.draftId)
      : await repository.readLatestDraft(parsedQuery.data.caseId);
    if (!draft) {
      return NextResponse.json({ error: "Workbench draft was not found", code: "DRAFT_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ draft });
  } catch (error) {
    return errorResponse(error);
  }
}
