import { z } from "zod";
import { measureRoofPlanes, measurementSnapshotHash } from "./geometry";
import { evaluateMeasurementGate } from "./policy";

const point = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
export const roofProposalSchema = z.object({
  buildingIdentifier: z.string().trim().min(1).max(160).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  confidenceReasoning: z.string().trim().min(10).max(1_500),
  roofPlanes: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    polygon: z.array(point).min(3).max(30),
    angleMinDegrees: z.number().min(0).max(60),
    angleMaxDegrees: z.number().min(0).max(60),
  }).refine((plane) => plane.angleMinDegrees <= plane.angleMaxDegrees, "Minimum angle cannot exceed maximum angle")).max(20),
});

export const roofProposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["buildingIdentifier", "confidence", "confidenceReasoning", "roofPlanes"],
  properties: {
    buildingIdentifier: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    confidenceReasoning: { type: "string" },
    roofPlanes: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "polygon", "angleMinDegrees", "angleMaxDegrees"],
        properties: {
          id: { type: "string" },
          polygon: { type: "array", minItems: 3, maxItems: 30, items: { type: "object", additionalProperties: false, required: ["latitude", "longitude"], properties: { latitude: { type: "number" }, longitude: { type: "number" } } } },
          angleMinDegrees: { type: "number" }, angleMaxDegrees: { type: "number" },
        },
      },
    },
  },
} as const;

export type RoofProposal = z.infer<typeof roofProposalSchema>;

export function prepareMeasurement(input: {
  proposal: unknown;
  addressResolved: boolean;
  imageryLicensed: boolean;
  hasApprovedPriceRule: boolean;
}) {
  const proposal = roofProposalSchema.parse(input.proposal);
  const gate = evaluateMeasurementGate({
    addressResolved: input.addressResolved,
    buildingResolved: Boolean(proposal.buildingIdentifier),
    imageryLicensed: input.imageryLicensed,
    roofPlanes: proposal.roofPlanes,
    confidence: proposal.confidence,
  }, input.hasApprovedPriceRule);
  const calculation = proposal.roofPlanes.length ? measureRoofPlanes(proposal.roofPlanes) : null;
  const snapshot = { proposal, calculation, gate };
  return {
    proposal,
    calculation,
    gate,
    inputHash: measurementSnapshotHash(snapshot),
    status: gate.allowed ? (gate.requiresAdminReview ? "review_required" : "draft") : "blocked",
  } as const;
}
