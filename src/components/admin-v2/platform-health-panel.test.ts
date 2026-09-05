import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import {
  buildPlatformHealth,
  type OperationalHealth,
} from "@/lib/platform/health";
import { buildReleaseGate } from "@/lib/platform/release-gate";
import { PlatformHealthPanel } from "./platform-health-panel";

const healthyOperations: OperationalHealth = {
  backup: {
    lastVerifiedAt: "2026-09-04T08:00:00.000Z",
    referenceConfigured: true,
  },
  email: { failed: 0, lastDeliveredAt: "2026-09-04T09:00:00.000Z" },
  jobs: {
    failed: 0,
    lastCompletedAt: "2026-09-04T09:30:00.000Z",
    overdue: 0,
    quotaWarnings: 0,
  },
  seo: { failed: 0, lastCompletedAt: "2026-09-04T07:00:00.000Z" },
};

function render(environment: Record<string, string | undefined>) {
  return renderToStaticMarkup(
    createElement(PlatformHealthPanel, {
      health: buildPlatformHealth(environment),
      locale: "lt",
      operational: healthyOperations,
      releaseGate: buildReleaseGate(environment),
      rollout: buildAdminNextRolloutView(environment),
    }),
  );
}

describe("PlatformHealthPanel", () => {
  it("separates current Preview health from the Production release decision", () => {
    const html = render({
      ADMIN_NEXT_MODE: "preview",
      FEATURE_ADMIN_EXCEPTION_FLOWS_V2: "true",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
      FEATURE_ROOF_FUSION_V1: "true",
      ROOF_FUSION_V1_QA_REFERENCE: "preview-qa",
      VERCEL_ENV: "preview",
    });
    const preview = html.indexOf('data-preview-health-status="attention"');
    const production = html.indexOf('data-production-release-gate="no_go"');

    expect(preview).toBeGreaterThan(-1);
    expect(production).toBeGreaterThan(preview);
    expect(html).toContain("Preview būklė dabar");
    expect(html).toContain("Production paleidimo patvirtinimai");
    expect(html).toContain("Veikianti Preview nėra Production patvirtinimas.");
  });

  it("does not call Preview ready merely because the environment requests Preview", () => {
    const html = render({
      ADMIN_NEXT_MODE: "preview",
      VERCEL_ENV: "preview",
    });

    expect(html).toContain('data-preview-health-status="attention"');
    expect(html).toContain("Dalis Preview dar ribojama");
    expect(html).not.toContain(
      "Preview moduliai paruošti kontroliuojamam testavimui",
    );
  });

  it("uses localized names while keeping gate codes inside expandable technical details", () => {
    const html = render({
      ADMIN_NEXT_MODE: "preview",
      FEATURE_ADMIN_EXCEPTION_FLOWS_V2: "true",
      FEATURE_CASE_STATE_ENGINE_V2: "true",
      FEATURE_ROOF_FUSION_V1: "true",
      ROOF_FUSION_V1_QA_REFERENCE: "preview-qa",
      STAGING_QA_REFERENCE: "staging-qa",
      RESTORE_TEST_REFERENCE: "restore-qa",
      PRODUCTION_OWNER_APPROVAL_REFERENCE: "owner-qa",
      VERCEL_ENV: "preview",
    });

    expect(html).toContain("Šiandienos darbų eilė");
    expect(html).toContain("Bylos darbo erdvė");
    expect(html).toContain("Elektroninis pasirašymas");
    expect(html).toContain(
      "Roof Fusion patvirtintas tik Preview ir negali būti įjungtas Production",
    );
    expect(html).toContain("Techninė informacija");
    expect(html).toContain("FEATURE_ROOF_FUSION_V1");
    expect(html).toContain("ROOF_FUSION_V1_PRODUCTION_ACTIVATION_FORBIDDEN");

    const productionStart = html.indexOf(
      'data-production-release-gate="no_go"',
    );
    const blockerDetails = html.indexOf("<details", productionStart);
    const technicalDetails = html.indexOf(
      "Techninė informacija",
      blockerDetails,
    );
    const firstTechnicalCode = html.indexOf(
      "FEATURE_ROOF_FUSION_V1",
      productionStart,
    );
    expect(technicalDetails).toBeGreaterThan(blockerDetails);
    expect(firstTechnicalCode).toBeGreaterThan(technicalDetails);
  });
});
