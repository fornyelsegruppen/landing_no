import { NextResponse } from "next/server";
import { z } from "zod";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import {
  assertPreviewCaseAddressCommandEnabled,
  executePreviewCaseAddressCommand,
  PREVIEW_CASE_ADDRESS_COMMAND_VERSION,
  PreviewCaseAddressCommandError,
} from "@/lib/cases/preview-case-address-command";
import { userIsAdmin } from "@/payload/access/roles";

const requestSchema = z
  .object({
    expectedCaseRevision: z.number().int().positive(),
    expectedAddressRevision: z.number().int().positive(),
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(200)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
    reasonCode: z.enum([
      "operator_correction",
      "customer_confirmation",
      "provider_resolution",
      "data_quality_recovery",
    ]),
    address: z
      .object({
        street: z.string().trim().min(2).max(200),
        houseNumber: z.string().trim().min(1).max(30).nullable(),
        postalCode: z.string().regex(/^\d{4}$/u),
        city: z.string().trim().min(2).max(100).nullable(),
      })
      .strict(),
  })
  .strict();

function commandErrorResponse(error: unknown) {
  if (error instanceof PreviewCaseAddressCommandError) {
    return NextResponse.json(
      {
        error: "Case address correction was not applied",
        code: error.code,
        ...(error.expectedRevision !== undefined
          ? { expectedRevision: error.expectedRevision }
          : {}),
        ...(error.actualRevision !== undefined
          ? { actualRevision: error.actualRevision }
          : {}),
      },
      {
        status: error.suggestedHttpStatus,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  return NextResponse.json(
    {
      error: "Case address correction was not applied",
      code: "REPOSITORY_INTEGRITY",
    },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // This guard must remain before Payload initialization and authentication.
    assertPreviewCaseAddressCommandEnabled(process.env);
    const { id } = await params;
    if (!/^[1-9]\d*$/u.test(id)) {
      return NextResponse.json(
        { error: "Invalid case address request", code: "INVALID_COMMAND" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid case address request", code: "INVALID_COMMAND" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!userIsAdmin(user)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const actorId = Number(user.id);
    if (!Number.isSafeInteger(actorId) || actorId < 1) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await executePreviewCaseAddressCommand({
      payload,
      command: {
        schemaVersion: PREVIEW_CASE_ADDRESS_COMMAND_VERSION,
        leadId: Number(id),
        actorId,
        correlationId: correlationIdFromHeaders(request.headers),
        ...parsed.data,
      },
    });
    return NextResponse.json(result, {
      status: result.status === "applied" ? 201 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return commandErrorResponse(error);
  }
}
