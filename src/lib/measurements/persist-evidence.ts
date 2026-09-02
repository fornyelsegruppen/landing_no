import { createHash } from "node:crypto";
import type { Payload } from "payload";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import {
  createPrivateMedia,
  deletePrivateMedia,
} from "@/lib/private-media-storage";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import {
  assertNorgeIBilderScreenshotEvidence,
  isNorgeIBilderScreenshotSource,
  NORGE_I_BILDER_EXACT_ATTRIBUTION,
  NORGE_I_BILDER_SCREENSHOT_SOURCE,
} from "./evidence-policy";
import {
  SchematicRoofEvidenceProvider,
  type MapEvidenceProvider,
} from "./schematic-evidence";

type EvidenceMeasurementRecord = {
  evidenceAttribution?: string | null;
  evidenceHash?: string | null;
  evidenceSnapshot?: unknown;
  evidenceSource?: string | null;
  imageryCapturedAt?: string | null;
  lead?: unknown;
};

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  ) {
    return (value as { id: number }).id;
  }
  return null;
}

type PrivateCaptureMetadata = {
  alt?: string | null;
  classification?: string | null;
  createdAt?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  ownerId?: string | null;
  ownerType?: string | null;
};

const screenshotAlt = `Norge i bilder screenshot — ${NORGE_I_BILDER_EXACT_ATTRIBUTION}`;
const screenshotFilenamePrefix = `${NORGE_I_BILDER_SCREENSHOT_SOURCE}-`;

/**
 * Verifies immutable private-media metadata before a screenshot is attached
 * to a measurement. No client-provided provenance is used for this decision.
 */
export function approvedNorgeIBilderCaptureMetadata(
  media: PrivateCaptureMetadata,
  expectedCaseId: string,
) {
  if (
    media.classification !== "measurement" ||
    media.ownerType !== "norge-i-bilder-capture" ||
    media.ownerId !== expectedCaseId ||
    !["image/png", "image/jpeg"].includes(media.mimeType || "") ||
    media.alt !== screenshotAlt ||
    !media.filename?.startsWith(screenshotFilenamePrefix)
  ) {
    throw new Error(
      "Approved screenshot evidence requires one case-bound Norge i bilder private capture",
    );
  }
  if (
    typeof media.createdAt !== "string" ||
    Number.isNaN(new Date(media.createdAt).getTime())
  ) {
    throw new Error(
      "Approved screenshot evidence requires a valid private-media createdAt timestamp",
    );
  }
  return {
    capturedAt: media.createdAt,
    source: NORGE_I_BILDER_SCREENSHOT_SOURCE,
    attribution: NORGE_I_BILDER_EXACT_ATTRIBUTION,
    trainingProhibited: true as const,
  };
}

export async function persistSchematicMeasurementEvidence(input: {
  address: string;
  addressPoint: { latitude: number; longitude: number };
  attribution: string;
  candidates: Pick<
    BuildingFootprintCandidate,
    | "id"
    | "label"
    | "polygon"
    | "addressHouseNumber"
    | "addressStreet"
    | "buildingName"
  >[];
  generatedAt?: Date;
  leadId: number;
  measurementId: number;
  payload: Payload;
  provider?: MapEvidenceProvider;
  selectedBuildingId: string;
  source: string;
}) {
  const generatedAt = (input.generatedAt || new Date()).toISOString();
  const evidence = await (
    input.provider || new SchematicRoofEvidenceProvider()
  ).render({
    address: input.address,
    addressPoint: input.addressPoint,
    attribution: input.attribution,
    candidates: input.candidates,
    generatedAt,
    selectedBuildingId: input.selectedBuildingId,
    source: input.source,
  });
  const media = await createPrivateMedia(
    input.payload,
    {
      classification: "measurement",
      ownerType: "roof-measurement",
      ownerId: String(input.measurementId),
      alt: `Skjematisk takmåling for ${input.address}`,
    },
    {
      data: evidence.bytes,
      filename: evidence.filename,
      mimeType: evidence.mimeType,
    },
  );
  try {
    const measurement = await input.payload.update({
      collection: "roof-measurements",
      id: input.measurementId,
      depth: 0,
      overrideAccess: true,
      data: {
        candidateBuildings: evidence.snapshot.candidates,
        evidenceAttribution: input.attribution,
        evidenceGeneratedAt: generatedAt,
        evidenceHash: evidence.hash,
        evidenceSnapshot: media.id,
        evidenceSource: input.source,
        measurementMode: "schematic",
      },
    });
    return { evidence, measurement, privateMedia: media };
  } catch (error) {
    await deletePrivateMedia(input.payload, media).catch(() => undefined);
    throw error;
  }
}

export async function verifySchematicMeasurementEvidence(
  payload: Payload,
  measurement: EvidenceMeasurementRecord,
) {
  const mediaId = relationId(measurement.evidenceSnapshot);
  if (!mediaId || !/^[a-f0-9]{64}$/i.test(measurement.evidenceHash || ""))
    return false;
  const media = await payload.findByID({
    collection: "private-media",
    id: mediaId,
    depth: 0,
    overrideAccess: true,
  });
  if (media.mimeType !== "image/svg+xml") return false;
  const file = await readPrivateMediaContent(media);
  return (
    createHash("sha256").update(file.data).digest("hex") ===
    measurement.evidenceHash
  );
}

export async function attachApprovedRasterMeasurementEvidence(input: {
  expectedCaseId: string;
  mapImageId: number;
  measurementId: number;
  payload: Payload;
  source: string;
  trainingProhibited: boolean;
}) {
  const media = await input.payload.findByID({
    collection: "private-media",
    id: input.mapImageId,
    depth: 0,
    overrideAccess: true,
  });
  const trusted = approvedNorgeIBilderCaptureMetadata(
    media,
    input.expectedCaseId,
  );
  assertNorgeIBilderScreenshotEvidence({
    source: input.source,
    attribution: trusted.attribution,
    capturedAt: trusted.capturedAt,
    trainingProhibited: input.trainingProhibited,
  });
  const file = await readPrivateMediaContent(media);
  if (!["image/png", "image/jpeg"].includes(file.contentType)) {
    throw new Error(
      "Approved screenshot evidence requires one case-bound private PNG or JPEG measurement image",
    );
  }
  const evidenceHash = createHash("sha256").update(file.data).digest("hex");
  const measurement = await input.payload.update({
    collection: "roof-measurements",
    id: input.measurementId,
    depth: 0,
    overrideAccess: true,
    data: {
      evidenceSnapshot: media.id,
      evidenceHash,
      evidenceSource: trusted.source,
      evidenceAttribution: trusted.attribution,
      evidenceGeneratedAt: new Date().toISOString(),
      imageryCapturedAt: trusted.capturedAt,
      measurementMode: "schematic_with_context",
    },
  });
  return { evidenceHash, measurement, privateMedia: media };
}

export async function verifyMeasurementEvidence(
  payload: Payload,
  measurement: EvidenceMeasurementRecord,
) {
  if (isNorgeIBilderScreenshotSource(measurement.evidenceSource)) {
    try {
      assertNorgeIBilderScreenshotEvidence({
        source: measurement.evidenceSource,
        attribution: measurement.evidenceAttribution,
        capturedAt: measurement.imageryCapturedAt,
        trainingProhibited: true,
      });
    } catch {
      return false;
    }
    const mediaId = relationId(measurement.evidenceSnapshot);
    if (!mediaId || !/^[a-f0-9]{64}$/i.test(measurement.evidenceHash || "")) {
      return false;
    }
    const media = await payload.findByID({
      collection: "private-media",
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    });
    const leadId = relationId(measurement.lead);
    if (!leadId) return false;
    try {
      approvedNorgeIBilderCaptureMetadata(media, `lead-${leadId}`);
    } catch {
      return false;
    }
    const file = await readPrivateMediaContent(media);
    if (!["image/png", "image/jpeg"].includes(file.contentType)) {
      return false;
    }
    return (
      createHash("sha256").update(file.data).digest("hex") ===
      measurement.evidenceHash
    );
  }
  return verifySchematicMeasurementEvidence(payload, measurement);
}
