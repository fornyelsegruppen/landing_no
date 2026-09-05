import { NextResponse } from "next/server";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import {
  assertRoofFusionOfferBridgePreviewEnabledV1,
  parseRoofFusionOfferBridgeRequestV1,
  RoofFusionOfferBridgeErrorV1,
} from "@/lib/roof-fusion/offer-bridge-contract-v1";
import { executeRoofFusionOfferBridgeV1 } from "@/lib/roof-fusion/offer-bridge-v1";
import {
  PayloadRoofFusionCaseAuthorizationV1,
  RoofFusionPreviewReadErrorV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";
import { userIsAdmin } from "@/payload/access/roles";

function noStore(status: number) {
  return { status, headers: { "Cache-Control": "no-store" } };
}

function failure(error: unknown) {
  if (error instanceof RoofFusionOfferBridgeErrorV1) {
    return NextResponse.json(
      { error: error.message, code: error.code, entityRefs: error.entityRefs },
      noStore(error.suggestedHttpStatus),
    );
  }
  if (error instanceof RoofFusionPreviewReadErrorV1) {
    const status = error.code === "CASE_NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: error.message, code: error.code },
      noStore(status),
    );
  }
  return NextResponse.json(
    {
      error: "Roof Fusion offer package was not created",
      code: "REPOSITORY_INTEGRITY",
    },
    noStore(500),
  );
}

export async function POST(request: Request) {
  try {
    // Fail closed before Payload, authentication, or any database access.
    assertRoofFusionOfferBridgePreviewEnabledV1(process.env);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const command = parseRoofFusionOfferBridgeRequestV1(body);
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, noStore(401));
    }
    if (!userIsAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, noStore(403));
    }
    await new PayloadRoofFusionCaseAuthorizationV1(
      payload,
    ).assertAdminCaseAccess(command.caseId, user);
    const actorId = Number(user.id);
    if (!Number.isSafeInteger(actorId) || actorId < 1) {
      return NextResponse.json({ error: "Forbidden" }, noStore(403));
    }
    const result = await executeRoofFusionOfferBridgeV1({
      payload,
      request: command,
      actorId,
      actorDisplayName:
        typeof user.displayName === "string" ? user.displayName : undefined,
      correlationId: correlationIdFromHeaders(request.headers),
    });
    return NextResponse.json(
      result,
      noStore(result.status === "applied" ? 201 : 200),
    );
  } catch (error) {
    return failure(error);
  }
}
