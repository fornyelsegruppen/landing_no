import type { FeatureFlagName } from "@/lib/platform/features";

export const adminNextCanonicalCapabilityIds = [
  "Case",
  "Property",
  "Customer",
  "Roof",
  "Visit",
] as const;

export type AdminNextCanonicalCapabilityId =
  (typeof adminNextCanonicalCapabilityIds)[number];

export type AdminNextCanonicalCapabilityContract = {
  id: AdminNextCanonicalCapabilityId;
  canonicalSource: "leads" | "roof-measurements" | "work-orders";
  maturity: "canonical" | "legacy_bridge";
  readContract: string;
  targetCanonicalSource?: string;
  targetReadContracts?: readonly string[];
  mutationOwner: string;
  previewMutationPolicy: "forbidden";
};

export const adminNextCanonicalCapabilityRegistry: Readonly<
  Record<AdminNextCanonicalCapabilityId, AdminNextCanonicalCapabilityContract>
> = {
  Case: {
    id: "Case",
    canonicalSource: "leads",
    maturity: "canonical",
    readContract: "src/lib/admin-v2/case-read-model.ts",
    mutationOwner: "Admin V2 lead APIs and case commands",
    previewMutationPolicy: "forbidden",
  },
  Property: {
    id: "Property",
    canonicalSource: "leads",
    maturity: "canonical",
    readContract: "lead address/property projection through the Case adapter",
    mutationOwner: "Admin V2 lead APIs",
    previewMutationPolicy: "forbidden",
  },
  Customer: {
    id: "Customer",
    canonicalSource: "leads",
    maturity: "canonical",
    readContract: "lead customer projection through the Case adapter",
    mutationOwner: "Admin V2 lead and customer-contact APIs",
    previewMutationPolicy: "forbidden",
  },
  Roof: {
    id: "Roof",
    canonicalSource: "roof-measurements",
    maturity: "legacy_bridge",
    readContract: "AdminNextCaseWorkspaceAdapter.measurementReview",
    targetCanonicalSource: "append-only roof-snapshot.v1 repository",
    targetReadContracts: [
      "roof-snapshot.v1 (authorized internal read)",
      "approved-roof-renderer-envelope.v1 (downstream read)",
    ],
    mutationOwner: "canonical measurement APIs and approval workflow",
    previewMutationPolicy: "forbidden",
  },
  Visit: {
    id: "Visit",
    canonicalSource: "work-orders",
    maturity: "canonical",
    readContract: "AdminNextFieldVisitAdapter",
    mutationOwner: "worker work-order APIs and workflow",
    previewMutationPolicy: "forbidden",
  },
} as const;

export const adminNextRoofFusionActionCapabilityIds = [
  "roof_fusion.snapshot.read",
  "roof_fusion.evidence.read",
  "roof_fusion.calculate",
  "roof_fusion.review",
  "roof_fusion.correct",
  "roof_fusion.approve",
  "roof_fusion.renderer.read_approved",
] as const;

export type AdminNextRoofFusionActionCapabilityId =
  (typeof adminNextRoofFusionActionCapabilityIds)[number];

export const adminNextRoofFusionI1TargetContract = {
  status: "r4_preview_read_wired",
  snapshotSchemaVersion: "roof-snapshot.v1",
  rendererSchemaVersion: "roof-renderer.v1",
  approvedRendererEnvelopeVersion: "approved-roof-renderer-envelope.v1",
  featureGate: "roofFusionV1",
  actionCapabilities: adminNextRoofFusionActionCapabilityIds,
  previewMutationPolicy: "forbidden",
  downstreamReadPolicy: "approved_renderer_envelope_only",
  snapshotRepository:
    "src/lib/roof-fusion/payload-repository-v1.ts#PayloadRoofSnapshotRepositoryV1",
  adminReadAdapter:
    "src/lib/roof-fusion/preview-read-adapters-v1.ts#AdminRoofFusionPreviewReadAdapterV1",
  workerReadAdapter:
    "src/lib/roof-fusion/preview-read-adapters-v1.ts#WorkerRoofFusionPreviewRendererAdapterV1",
  r4ReadRoute:
    "src/app/(admin-shell)/admin-next-preview/cases/[caseId]/measurements/[measurementId]/page.tsx",
  previewUatHarness:
    "src/app/(admin-shell)/admin-next-preview/roof-fusion/uat/page.tsx#prepareR4Uat",
  mutationOwner: "future authorized Roof Fusion command API",
} as const;

export type AdminNextModuleId =
  | "today"
  | "caseWorkspace"
  | "roofWorkbench"
  | "documentPreflight"
  | "fieldVisit";

export type AdminNextModuleStage = "adapter_ready" | "release_ready" | "planned";
export type AdminNextRolloutStage = "legacy_only" | "shadow_read" | "preview" | "canonical";
export type AdminNextFoundationTarget = "FP0" | "FP1" | "FP2";

export type AdminNextModuleDefinition = {
  id: AdminNextModuleId;
  stage: AdminNextModuleStage;
  rolloutStage: AdminNextRolloutStage;
  foundationTarget: AdminNextFoundationTarget;
  capabilities: readonly AdminNextCanonicalCapabilityId[];
  dependencies: readonly FeatureFlagName[];
  legacyHref: string;
  workerLegacyHref?: string;
  previewAdapter: "fixture_only" | "canonical_read_with_fixture_fallback";
  mutationPolicy: "legacy_only";
};

export const adminNextModuleDefinitions: readonly AdminNextModuleDefinition[] = [
  {
    id: "today",
    stage: "adapter_ready",
    rolloutStage: "preview",
    foundationTarget: "FP1",
    capabilities: ["Case", "Customer", "Property", "Visit"],
    dependencies: ["caseStateEngineV2", "adminExceptionFlowsV2"],
    legacyHref: "/admin-v2",
    previewAdapter: "canonical_read_with_fixture_fallback",
    mutationPolicy: "legacy_only",
  },
  {
    id: "caseWorkspace",
    stage: "adapter_ready",
    rolloutStage: "preview",
    foundationTarget: "FP1",
    capabilities: ["Case", "Customer", "Property", "Roof", "Visit"],
    dependencies: ["caseStateEngineV2"],
    legacyHref: "/admin-v2/cases",
    previewAdapter: "canonical_read_with_fixture_fallback",
    mutationPolicy: "legacy_only",
  },
  {
    id: "roofWorkbench",
    stage: "adapter_ready",
    rolloutStage: "preview",
    foundationTarget: "FP2",
    capabilities: ["Case", "Property", "Roof"],
    dependencies: ["roofFusionV1"],
    legacyHref: "/admin-v2/cases",
    previewAdapter: "canonical_read_with_fixture_fallback",
    mutationPolicy: "legacy_only",
  },
  {
    id: "documentPreflight",
    stage: "adapter_ready",
    rolloutStage: "preview",
    foundationTarget: "FP2",
    capabilities: ["Case", "Customer", "Roof"],
    dependencies: [
      "customerQuotes",
      "contractSigning",
      "communicationRoutingV2",
    ],
    legacyHref: "/admin-v2/documents",
    previewAdapter: "fixture_only",
    mutationPolicy: "legacy_only",
  },
  {
    id: "fieldVisit",
    stage: "adapter_ready",
    rolloutStage: "preview",
    foundationTarget: "FP2",
    capabilities: ["Case", "Customer", "Property", "Visit"],
    dependencies: ["workerPortal"],
    legacyHref: "/admin-v2/work",
    workerLegacyHref: "/user",
    previewAdapter: "canonical_read_with_fixture_fallback",
    mutationPolicy: "legacy_only",
  },
] as const;

export function adminNextModuleDefinition(id: AdminNextModuleId) {
  const definition = adminNextModuleDefinitions.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown Admin Next module: ${id}`);
  return definition;
}

export function adminNextModuleCanServeCanonical(id: AdminNextModuleId) {
  return adminNextModuleDefinition(id).rolloutStage === "canonical";
}

export function adminNextModuleUsesShadowRead(id: AdminNextModuleId) {
  return adminNextModuleDefinition(id).rolloutStage === "shadow_read";
}
