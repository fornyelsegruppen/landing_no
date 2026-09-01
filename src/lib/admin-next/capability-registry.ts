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
  readContract: string;
  mutationOwner: string;
  previewMutationPolicy: "forbidden";
};

export const adminNextCanonicalCapabilityRegistry: Readonly<
  Record<AdminNextCanonicalCapabilityId, AdminNextCanonicalCapabilityContract>
> = {
  Case: {
    id: "Case",
    canonicalSource: "leads",
    readContract: "src/lib/admin-v2/case-read-model.ts",
    mutationOwner: "Admin V2 lead APIs and case commands",
    previewMutationPolicy: "forbidden",
  },
  Property: {
    id: "Property",
    canonicalSource: "leads",
    readContract: "lead address/property projection through the Case adapter",
    mutationOwner: "Admin V2 lead APIs",
    previewMutationPolicy: "forbidden",
  },
  Customer: {
    id: "Customer",
    canonicalSource: "leads",
    readContract: "lead customer projection through the Case adapter",
    mutationOwner: "Admin V2 lead and customer-contact APIs",
    previewMutationPolicy: "forbidden",
  },
  Roof: {
    id: "Roof",
    canonicalSource: "roof-measurements",
    readContract: "AdminNextCaseWorkspaceAdapter.measurementReview",
    mutationOwner: "canonical measurement APIs and approval workflow",
    previewMutationPolicy: "forbidden",
  },
  Visit: {
    id: "Visit",
    canonicalSource: "work-orders",
    readContract: "AdminNextFieldVisitAdapter",
    mutationOwner: "worker work-order APIs and workflow",
    previewMutationPolicy: "forbidden",
  },
} as const;

export type AdminNextModuleId =
  | "today"
  | "caseWorkspace"
  | "roofWorkbench"
  | "documentPreflight"
  | "fieldVisit";

export type AdminNextModuleStage = "adapter_ready" | "release_ready" | "planned";
export type AdminNextFoundationTarget = "FP0" | "FP1" | "FP2";

export type AdminNextModuleDefinition = {
  id: AdminNextModuleId;
  stage: AdminNextModuleStage;
  foundationTarget: AdminNextFoundationTarget;
  capabilities: readonly AdminNextCanonicalCapabilityId[];
  dependencies: readonly FeatureFlagName[];
  legacyHref: string;
  workerLegacyHref?: string;
  previewAdapter: "fixture_only";
  mutationPolicy: "legacy_only";
};

export const adminNextModuleDefinitions: readonly AdminNextModuleDefinition[] = [
  {
    id: "today",
    stage: "adapter_ready",
    foundationTarget: "FP1",
    capabilities: ["Case", "Customer", "Property", "Visit"],
    dependencies: ["caseStateEngineV2", "adminExceptionFlowsV2"],
    legacyHref: "/admin-v2",
    previewAdapter: "fixture_only",
    mutationPolicy: "legacy_only",
  },
  {
    id: "caseWorkspace",
    stage: "adapter_ready",
    foundationTarget: "FP1",
    capabilities: ["Case", "Customer", "Property", "Roof", "Visit"],
    dependencies: ["caseStateEngineV2"],
    legacyHref: "/admin-v2/cases",
    previewAdapter: "fixture_only",
    mutationPolicy: "legacy_only",
  },
  {
    id: "roofWorkbench",
    stage: "adapter_ready",
    foundationTarget: "FP2",
    capabilities: ["Case", "Property", "Roof"],
    dependencies: ["measurementEvidenceV2"],
    legacyHref: "/admin-v2/cases",
    previewAdapter: "fixture_only",
    mutationPolicy: "legacy_only",
  },
  {
    id: "documentPreflight",
    stage: "adapter_ready",
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
    foundationTarget: "FP2",
    capabilities: ["Case", "Customer", "Property", "Visit"],
    dependencies: ["workerPortal"],
    legacyHref: "/admin-v2/work",
    workerLegacyHref: "/user",
    previewAdapter: "fixture_only",
    mutationPolicy: "legacy_only",
  },
] as const;

export function adminNextModuleDefinition(id: AdminNextModuleId) {
  const definition = adminNextModuleDefinitions.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown Admin Next module: ${id}`);
  return definition;
}
