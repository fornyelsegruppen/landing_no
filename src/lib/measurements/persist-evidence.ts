import { createHash } from "node:crypto";
import type { Payload } from "payload";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import {
  createPrivateMedia,
  deletePrivateMedia,
} from "@/lib/private-media-storage";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import {
  SchematicRoofEvidenceProvider,
  type MapEvidenceProvider,
} from "./schematic-evidence";

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
  measurement: { evidenceHash?: string | null; evidenceSnapshot?: unknown },
) {
  const mediaId =
    typeof measurement.evidenceSnapshot === "number"
      ? measurement.evidenceSnapshot
      : measurement.evidenceSnapshot &&
          typeof measurement.evidenceSnapshot === "object" &&
          typeof (measurement.evidenceSnapshot as { id?: unknown }).id ===
            "number"
        ? (measurement.evidenceSnapshot as { id: number }).id
        : null;
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
