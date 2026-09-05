import type { CaseNextActionCapability } from "@/lib/admin-v2/case-next-action-presentation";
import { previewEmailRecipientAllowlist } from "@/lib/messages/preview-email-recipient-policy";
import {
  featureReadiness,
  type Environment,
  type FeatureFlagName,
} from "@/lib/platform/features";
import type { UserRole } from "@/payload/access/roles";

type CapabilityRequirement = {
  features: readonly FeatureFlagName[];
  requiresPreviewRecipientPolicy?: true;
};

const requirements: Readonly<
  Record<CaseNextActionCapability, CapabilityRequirement>
> = {
  "case.read": { features: ["caseStateEngineV2"] },
  "case.reply.prepare": {
    features: ["caseStateEngineV2", "aiDrafts"],
  },
  "case.question.reply.prepare": {
    features: ["caseStateEngineV2", "aiDrafts"],
  },
  "message.approve_send": {
    features: ["caseStateEngineV2"],
    requiresPreviewRecipientPolicy: true,
  },
  "message.retry_send": {
    features: ["caseStateEngineV2"],
    requiresPreviewRecipientPolicy: true,
  },
  "message.closure.approve_send": {
    features: [
      "caseStateEngineV2",
      "communicationRoutingV2",
      "customerLifecycleV2",
    ],
    requiresPreviewRecipientPolicy: true,
  },
  "commercial.package.prepare": {
    features: ["caseStateEngineV2", "roofMeasurement", "customerQuotes"],
  },
  "commercial.package.approve_send": {
    features: ["caseStateEngineV2", "customerQuotes", "contractSigning"],
    requiresPreviewRecipientPolicy: true,
  },
  "measurement.review_approve": {
    features: [
      "caseStateEngineV2",
      "roofMeasurement",
      "measurementEvidenceV2",
    ],
  },
  "measurement.resolve": {
    features: [
      "caseStateEngineV2",
      "roofMeasurement",
      "measurementEvidenceV2",
    ],
  },
  "price.calculate": {
    features: ["caseStateEngineV2", "roofMeasurement", "customerQuotes"],
  },
  "quote.create": {
    features: ["caseStateEngineV2", "customerQuotes"],
  },
  "quote.approve": {
    features: ["caseStateEngineV2", "customerQuotes"],
  },
  "quote.issue": {
    features: ["caseStateEngineV2", "customerQuotes"],
  },
  "quote.read": {
    features: ["caseStateEngineV2", "customerQuotes"],
  },
  "quote.decline.resolve": {
    features: ["caseStateEngineV2", "customerQuotes", "customerLifecycleV2"],
  },
  "contract.company_sign": {
    features: ["caseStateEngineV2", "contractSigning"],
  },
  "case.cancellation.review": {
    features: [
      "caseStateEngineV2",
      "adminExceptionFlowsV2",
      "customerLifecycleV2",
    ],
  },
  "work_order.create": {
    features: ["caseStateEngineV2", "workerPortal"],
  },
  "work_order.assign": {
    features: ["caseStateEngineV2", "workerPortal"],
  },
  "work_order.schedule": {
    features: ["caseStateEngineV2", "workerPortal"],
  },
  "work_order.block.resolve": {
    features: ["caseStateEngineV2", "workerPortal", "adminExceptionFlowsV2"],
  },
  "work_order.read": {
    features: ["caseStateEngineV2", "workerPortal"],
  },
  "work_order.completion.review": {
    features: [
      "caseStateEngineV2",
      "workerPortal",
      "measurementEvidenceV2",
    ],
  },
};

const capabilityIds = Object.keys(requirements) as CaseNextActionCapability[];

export function resolvePreviewE2eOperatorCapabilities(input: {
  environment?: Environment;
  role: UserRole;
}): readonly CaseNextActionCapability[] {
  const environment = input.environment ?? process.env;
  if (
    environment.VERCEL_ENV !== "preview" ||
    environment.PREVIEW_E2E_OPERATOR_ACCESS !== "true" ||
    input.role !== "admin"
  ) {
    return [];
  }

  const recipientPolicyConfigured =
    previewEmailRecipientAllowlist(environment).size > 0;
  const readiness = new Map<FeatureFlagName, boolean>();
  const featureIsReady = (feature: FeatureFlagName) => {
    if (!readiness.has(feature)) {
      readiness.set(feature, featureReadiness(feature, environment).ready);
    }
    return readiness.get(feature) === true;
  };
  return capabilityIds.filter((capability) => {
    const requirement = requirements[capability];
    if (
      requirement.requiresPreviewRecipientPolicy &&
      !recipientPolicyConfigured
    ) {
      return false;
    }
    return requirement.features.every(featureIsReady);
  });
}
