import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { assertFeatureReady, FeatureUnavailableError } from "@/lib/platform/features";
import { appendTimeline, loadAuthorizedWorkOrder, relationId } from "@/lib/work-orders/access";
import { createPrivateMedia, deletePrivateMedia } from "@/lib/private-media-storage";
import { uploadDigestMatches, uploadSha256 } from "@/lib/images/upload-integrity";
import { normalizedImageFilename, sanitizeImageUpload, UnsafeImageUploadError } from "@/lib/images/sanitize-upload";

const phaseSchema = z.enum(["before", "after"]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertFeatureReady("workerPortal");
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const order = await loadAuthorizedWorkOrder(payload, Number(id), user);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    const phase = phaseSchema.safeParse(form.get("phase"));
    if (!(file instanceof File) || !phase.success) return NextResponse.json({ error: "File and phase are required" }, { status: 400 });
    if (!allowedTypes.has(file.type) || file.size < 1 || file.size > 10_000_000) return NextResponse.json({ error: "Use JPEG, PNG or WebP up to 10 MB" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const expectedDigest = request.headers.get("x-upload-sha256")?.toLowerCase();
    const actualDigest = uploadSha256(bytes);
    if (!uploadDigestMatches(bytes, expectedDigest)) return NextResponse.json({ error: "Upload integrity check failed; retry the photo" }, { status: 422 });
    const normalized = await sanitizeImageUpload(bytes, {
      declaredMime: file.type,
      maxInputBytes: 10_000_000,
    });
    if (phase.data === "before" && !["arrived", "precheck", "blocked"].includes(order.status)) return NextResponse.json({ error: "Before photos can only be added during precheck" }, { status: 409 });
    if (phase.data === "after" && !["in_progress", "completed"].includes(order.status)) return NextResponse.json({ error: "After photos can only be added after work starts" }, { status: 409 });
    const safeName = `${phase.data}-${Date.now()}-${normalizedImageFilename(file.name, "photo")}`;
    const media = await createPrivateMedia(payload, {
      classification: "work", ownerType: "work-order", ownerId: String(order.id), alt: `${phase.data === "before" ? "Før" : "Etter"}-dokumentasjon for ${order.reference}`,
    }, { data: normalized.bytes, mimeType: normalized.mimeType, filename: safeName });
    try {
      const field = phase.data === "before" ? "beforePhotos" : "afterPhotos";
      const existing = Array.isArray(order[field]) ? order[field].map(relationId).filter((value): value is number => value !== null) : [];
      const photoIds = [...new Set([...existing, media.id])];
      await payload.update({ collection: "work-orders", id: order.id, overrideAccess: true, context: { trustedWorkerAction: true }, data: {
        [field]: photoIds,
        eventTimeline: appendTimeline(order.eventTimeline, { action: `photo.${phase.data}`, actorId: Number(user.id), changedFields: [field] }),
      } });
      await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: Number(user.id), action: `work-order.photo-${phase.data}`, entityType: "work-order", entityId: order.id, correlationId: correlationIdFromHeaders(request.headers), changedFields: [field] });
    } catch (error) {
      await deletePrivateMedia(payload, media).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ id: media.id, phase: phase.data, sha256: actualDigest, storedSha256: normalized.storedSha256 }, { status: 201 });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) return NextResponse.json({ error: error.reason, missing: error.unavailable }, { status: 503 });
    if (error instanceof UnsafeImageUploadError) return NextResponse.json({ error: error.message, code: error.code }, { status: 415 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 409 });
  }
}
