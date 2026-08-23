import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPayloadAiUsageAvailable } from "@/lib/ai/payload-usage-limit";
import { generateRoofProposal } from "@/lib/measurements/ai-proposal";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { GeminiAiProvider } from "@/lib/providers/gemini-ai-provider";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = z.object({
  mapImageId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.literal("norge-i-bilder"),
  licenseAccepted: z.literal(true),
  credits: z.literal("© norgeibilder.no"),
});

export async function POST(request: Request) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    assertFeatureReady("roofMeasurement");
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid licensed imagery request" }, { status: 400 });
    await assertPayloadAiUsageAvailable(payload, { reserve: 1 });
    const media = await payload.findByID({ collection: "private-media", id: parsed.data.mapImageId, depth: 0, overrideAccess: true });
    if (media.classification !== "measurement" || !media.url || !media.mimeType?.match(/^image\/(jpeg|png|webp)$/)) {
      return NextResponse.json({ error: "A private measurement image is required" }, { status: 409 });
    }
    if ((media.filesize ?? 0) > 10_000_000) return NextResponse.json({ error: "Measurement image is too large" }, { status: 413 });
    const parsedUrl = new URL(media.url);
    if (!parsedUrl.hostname.endsWith(".blob.vercel-storage.com") || !process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Private measurement storage is not configured" }, { status: 503 });
    }
    const blob = await get(`${parsedUrl.origin}${parsedUrl.pathname}`, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!blob?.stream || blob.statusCode !== 200) return NextResponse.json({ error: "Measurement image not found" }, { status: 404 });
    const bytes = Buffer.from(await new Response(blob.stream).arrayBuffer());
    if (bytes.byteLength > 10_000_000) return NextResponse.json({ error: "Measurement image is too large" }, { status: 413 });
    const job = await payload.create({ collection: "operational-jobs", overrideAccess: true, data: {
      type: "roof.ai.proposal", status: "running", idempotencyKey: `roof-proposal:${media.id}:${Date.now()}`,
      correlationId, attempts: 1, maxAttempts: 1, availableAt: new Date().toISOString(), startedAt: new Date().toISOString(),
      payload: { mapImageId: media.id },
    } });
    try {
      const result = await generateRoofProposal({ provider: new GeminiAiProvider(), image: { mimeType: media.mimeType as "image/jpeg" | "image/png" | "image/webp", dataBase64: bytes.toString("base64") }, latitude: parsed.data.latitude, longitude: parsed.data.longitude, correlationId });
      await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "completed", completedAt: new Date().toISOString(), result: { confidence: result.proposal.confidence, provider: result.provider, model: result.model } } });
      return NextResponse.json({ ...result, source: parsed.data.source, credits: parsed.data.credits });
    } catch (error) {
      await payload.update({ collection: "operational-jobs", id: job.id, overrideAccess: true, data: { status: "attention", lastErrorCode: "ROOF_AI_PROPOSAL_FAILED", lastErrorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown proposal error" } });
      throw error;
    }
  } catch (error) {
    if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Proposal failed", correlationId }, { status: 500 });
  }
}
