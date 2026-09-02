import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPayloadAiUsageAvailable } from "@/lib/ai/payload-usage-limit";
import { generateRoofProposal } from "@/lib/measurements/ai-proposal";
import { approvedNorgeIBilderCaptureMetadata } from "@/lib/measurements/persist-evidence";
import { assertNorgeIBilderScreenshotEvidence } from "@/lib/measurements/evidence-policy";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import {
  assertFeatureReady,
  FeatureUnavailableError,
} from "@/lib/platform/features";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { KartverketAddressProvider } from "@/lib/providers/kartverket-address-provider";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
  mapImageId: z.number().int().positive(),
  leadId: z.number().int().positive(),
  source: z.literal("norge-i-bilder-screenshot"),
  licenseAccepted: z.literal(true),
  trainingProhibited: z.literal(true),
  credits: z.literal("©norgeibilder.no"),
});

function addressQuery(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter(
      (part, index, normalized) =>
        normalized.findIndex(
          (candidate) =>
            candidate.toLocaleLowerCase("nb-NO") ===
            part.toLocaleLowerCase("nb-NO"),
        ) === index,
    )
    .join(" ");
}

export async function POST(request: Request) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    assertFeatureReady("roofMeasurement");
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid licensed imagery request" },
        { status: 400 },
      );

    const lead = await payload
      .findByID({
        collection: "leads",
        id: parsed.data.leadId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);
    if (!lead) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const query = addressQuery([
      lead.address,
      lead.houseNumber,
      lead.postal,
      lead.city,
    ]);
    if (query.length < 4) {
      return NextResponse.json(
        { error: "Case address is incomplete" },
        { status: 409 },
      );
    }
    const candidates = await new KartverketAddressProvider().searchAddress(
      query,
    );
    if (!candidates.length) {
      return NextResponse.json(
        { error: "Case address is incomplete" },
        { status: 409 },
      );
    }
    const address =
      candidates.find((candidate) => candidate.postalCode === lead.postal) ||
      candidates[0];

    const media = await payload.findByID({
      collection: "private-media",
      id: parsed.data.mapImageId,
      depth: 0,
      overrideAccess: true,
    });
    if (
      media.classification !== "measurement" ||
      media.ownerType !== "norge-i-bilder-capture" ||
      media.ownerId !== `lead-${lead.id}` ||
      !media.url ||
      !media.mimeType?.match(/^image\/(jpeg|png)$/)
    ) {
      return NextResponse.json(
        { error: "A private measurement image is required" },
        { status: 409 },
      );
    }

    try {
      const trustedCapture = approvedNorgeIBilderCaptureMetadata(
        media,
        `lead-${lead.id}`,
      );
      assertNorgeIBilderScreenshotEvidence(trustedCapture);
    } catch {
      return NextResponse.json(
        {
          error:
            "Approved screenshot evidence is incomplete or does not belong to this case",
        },
        { status: 409 },
      );
    }

    // This endpoint is inference-only and cannot be used for model training.
    if (
      !parsed.data.trainingProhibited ||
      parsed.data.credits !== "©norgeibilder.no"
    ) {
      return NextResponse.json(
        { error: "Invalid licensed imagery request" },
        { status: 400 },
      );
    }

    await assertPayloadAiUsageAvailable(payload, { reserve: 1 });
    if ((media.filesize ?? 0) > 10_000_000)
      return NextResponse.json(
        { error: "Measurement image is too large" },
        { status: 413 },
      );
    const parsedUrl = new URL(media.url);
    if (
      !parsedUrl.hostname.endsWith(".blob.vercel-storage.com") ||
      !process.env.BLOB_READ_WRITE_TOKEN
    ) {
      return NextResponse.json(
        { error: "Private measurement storage is not configured" },
        { status: 503 },
      );
    }
    const blob = await get(`${parsedUrl.origin}${parsedUrl.pathname}`, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!blob?.stream || blob.statusCode !== 200)
      return NextResponse.json(
        { error: "Measurement image is not found" },
        { status: 404 },
      );
    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
    if (bytes.byteLength > 10_000_000)
      return NextResponse.json(
        { error: "Measurement image is too large" },
        { status: 413 },
      );
    const job = await payload.create({
      collection: "operational-jobs",
      overrideAccess: true,
      data: {
        type: "roof.ai.proposal",
        status: "running",
        idempotencyKey: `roof-proposal:${media.id}:${Date.now()}`,
        correlationId,
        attempts: 1,
        maxAttempts: 1,
        availableAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        payload: { mapImageId: media.id },
      },
    });
    try {
      const result = await generateRoofProposal({
        provider: new GeminiAiProvider(),
        image: {
          mimeType: media.mimeType as "image/jpeg" | "image/png" | "image/webp",
          dataBase64: bytes.toString("base64"),
        },
        latitude: address.latitude,
        longitude: address.longitude,
        correlationId,
      });
      await payload.update({
        collection: "operational-jobs",
        id: job.id,
        overrideAccess: true,
        data: {
          status: "completed",
          completedAt: new Date().toISOString(),
          result: {
            confidence: result.proposal.confidence,
            provider: result.provider,
            model: result.model,
          },
        },
      });
      return NextResponse.json({
        ...result,
        source: parsed.data.source,
        credits: parsed.data.credits,
      });
    } catch (error) {
      await payload.update({
        collection: "operational-jobs",
        id: job.id,
        overrideAccess: true,
        data: {
          status: "attention",
          lastErrorCode: "ROOF_AI_PROPOSAL_FAILED",
          lastErrorMessage:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Unknown proposal error",
        },
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json(
        { error: error.reason, missing: error.unavailable },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Proposal failed",
        correlationId,
      },
      { status: 500 },
    );
  }
}
