export const ROOF_FUSION_CAPABILITY_CONTRACT_VERSION =
  "roof-fusion-capabilities.v1" as const;

export const roofFusionCapabilityContractV1 = {
  schemaVersion: ROOF_FUSION_CAPABILITY_CONTRACT_VERSION,
  featureGate: "roofFusionV1",
  activation: "shared_registry_not_implemented",
  capabilities: {
    "roof_fusion.snapshot.read": {
      actors: ["administrator"],
      payload: "roof-snapshot.v1",
      scope: "case_scoped_internal",
    },
    "roof_fusion.evidence.read": {
      actors: ["administrator"],
      payload: "roof-snapshot.v1#provenance",
      scope: "case_scoped_internal",
    },
    "roof_fusion.calculate": {
      actors: ["system"],
      payload: "roof-repository-command.v1#calculate",
      scope: "service_only",
    },
    "roof_fusion.review": {
      actors: ["administrator"],
      payload: "roof-repository-command.v1#review",
      scope: "case_scoped_internal",
    },
    "roof_fusion.correct": {
      actors: ["administrator"],
      payload: "roof-repository-command.v1#correct",
      scope: "case_scoped_internal",
    },
    "roof_fusion.approve": {
      actors: ["administrator"],
      payload: "roof-repository-command.v1#approve",
      scope: "case_scoped_internal",
    },
    "roof_fusion.renderer.read_approved": {
      actors: ["administrator", "assigned_worker", "customer", "pdf_service"],
      payload: "approved-roof-renderer-envelope.v1",
      scope: "case_or_token_scoped_downstream",
    },
  },
} as const;

export type RoofFusionCapabilityIdV1 =
  keyof typeof roofFusionCapabilityContractV1.capabilities;

export function roofFusionCapabilityAllowsActorV1(
  capability: RoofFusionCapabilityIdV1,
  actor: string,
) {
  const actors = roofFusionCapabilityContractV1.capabilities[capability]
    .actors as readonly string[];
  return actors.includes(actor);
}
