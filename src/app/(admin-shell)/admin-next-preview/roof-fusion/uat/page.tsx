import { notFound } from "next/navigation";
import type { PayloadRequest } from "payload";
import {
  AdminNextRoofFusionUatControl,
  type RoofFusionAddressLookupState,
  type RoofFusionHeightAnalysisState,
  type RoofFusionUatActionState,
} from "@/components/admin-next/admin-next-roof-fusion-uat-control";
import { parseAdminNextR4CaseIdentityV1 } from "@/lib/admin-next/r4-read-adapter";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import { KartverketAddressProvider } from "@/lib/providers/kartverket-address-provider";
import {
  KartverketHeightDataError,
  KartverketHeightDataProvider,
} from "@/lib/providers/kartverket-hoydedata-provider";
import { OpenStreetMapBuildingProvider } from "@/lib/providers/osm-building-provider";
import {
  buildRoofFusionHeightSurfacePreviewV1,
  RoofFusionHeightSurfacePreviewError,
} from "@/lib/roof-fusion/hoydedata-surface-preview-v1";
import { buildHeightSurfaceVisualizationV1 } from "@/lib/roof-fusion/hoydedata-surface-visualization-v1";
import { PayloadRoofSnapshotRepositoryV1 } from "@/lib/roof-fusion/payload-repository-v1";
import { buildRoofFusionOsmFootprintPreviewV1 } from "@/lib/roof-fusion/osm-footprint-preview-v1";
import {
  assertRoofFusionPreviewEnabledV1,
  PayloadRoofFusionCaseAuthorizationV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";
import { prepareRoofFusionPreviewUatGoldenV1 } from "@/lib/roof-fusion/preview-uat-golden-v1";

export default async function AdminNextRoofFusionUatPage() {
  if (process.env.VERCEL_ENV !== "preview") notFound();

  const user = await requireAdminUser();
  const access = resolveAdminNextPreviewAccess(
    buildAdminNextRolloutView(),
    "roofWorkbench",
  );
  if (access.kind !== "allow_preview") notFound();

  async function prepareR4Uat(
    _previousState: RoofFusionUatActionState,
    formData: FormData,
  ): Promise<RoofFusionUatActionState> {
    "use server";

    assertRoofFusionPreviewEnabledV1(process.env);
    const actionUser = await requireAdminUser();
    const caseReference = String(formData.get("caseReference") ?? "")
      .trim()
      .toUpperCase();
    const identity = parseAdminNextR4CaseIdentityV1(caseReference);
    if (!identity) notFound();

    const payload = await getPayload();
    const authenticatedUser = actionUser as PayloadRequest["user"];
    const authorization = new PayloadRoofFusionCaseAuthorizationV1(payload);
    await authorization.assertAdminCaseAccess(
      identity.roofFusionCaseId,
      authenticatedUser,
    );
    const result = await prepareRoofFusionPreviewUatGoldenV1({
      repository: new PayloadRoofSnapshotRepositoryV1(payload),
      leadId: identity.leadId,
    });
    return {
      kind: "success",
      previewHref: `/admin-next-preview/cases/${identity.caseReference}/measurements/${result.snapshot.snapshotId}?uatStatus=${result.status}`,
      snapshot: result.snapshot,
      status: result.status,
    };
  }

  async function lookupRealAddress(
    _previousState: RoofFusionAddressLookupState,
    formData: FormData,
  ): Promise<RoofFusionAddressLookupState> {
    "use server";

    assertRoofFusionPreviewEnabledV1(process.env);
    await requireAdminUser();
    const query = String(formData.get("addressQuery") ?? "")
      .trim()
      .replace(/\s+/gu, " ");
    if (query.length < 4 || query.length > 180) {
      return { kind: "error", code: "INVALID_ADDRESS" };
    }

    try {
      const addresses = await new KartverketAddressProvider().searchAddress(
        query,
      );
      const address = addresses[0];
      if (!address) return { kind: "error", code: "ADDRESS_NOT_FOUND" };

      const candidates =
        await new OpenStreetMapBuildingProvider().findBuildings({
          latitude: address.latitude,
          longitude: address.longitude,
        });
      if (!candidates.length) {
        return {
          kind: "error",
          code: "BUILDING_NOT_FOUND",
          resolvedAddress: address.label,
        };
      }

      const retrievedAt = new Date().toISOString();
      const enginePreviews = candidates.map((candidate) => {
        try {
          return {
            kind: "success" as const,
            candidateId: candidate.id,
            summary: buildRoofFusionOsmFootprintPreviewV1({
              address,
              candidate,
              retrievedAt,
            }).summary,
          };
        } catch {
          return {
            kind: "error" as const,
            candidateId: candidate.id,
          };
        }
      });

      return {
        kind: "success",
        address,
        candidates,
        enginePreviews,
      };
    } catch {
      return { kind: "error", code: "PROVIDER_UNAVAILABLE" };
    }
  }

  async function analyzeHeightSurface(
    _previousState: RoofFusionHeightAnalysisState,
    formData: FormData,
  ): Promise<RoofFusionHeightAnalysisState> {
    "use server";

    assertRoofFusionPreviewEnabledV1(process.env);
    await requireAdminUser();
    const query = String(formData.get("addressQuery") ?? "")
      .trim()
      .replace(/\s+/gu, " ");
    const candidateId = String(formData.get("candidateId") ?? "").trim();
    if (
      query.length < 4 ||
      query.length > 180 ||
      !/^(?:way|relation)\/[1-9][0-9]*$/u.test(candidateId)
    ) {
      return { kind: "error", code: "INVALID_SELECTION" };
    }

    try {
      // Re-resolve both public sources server-side. The client-selected ID is
      // accepted only when it still belongs to this address lookup.
      const addresses = await new KartverketAddressProvider().searchAddress(
        query,
      );
      const address = addresses[0];
      if (!address) return { kind: "error", code: "INVALID_SELECTION" };
      const candidates =
        await new OpenStreetMapBuildingProvider().findBuildings({
          latitude: address.latitude,
          longitude: address.longitude,
        });
      const candidate = candidates.find((item) => item.id === candidateId);
      if (!candidate) return { kind: "error", code: "INVALID_SELECTION" };
      const surface = await new KartverketHeightDataProvider().getSurface({
        polygon: candidate.polygon,
      });
      const preview = buildRoofFusionHeightSurfacePreviewV1({
        address,
        candidate,
        surface,
      });
      const visualization = await buildHeightSurfaceVisualizationV1({
        surface,
        candidate,
        segmentation: preview.segmentation ?? undefined,
      });
      return {
        kind: "success",
        candidateId,
        summary: preview.summary,
        visualization,
      };
    } catch (error) {
      if (error instanceof RoofFusionHeightSurfacePreviewError) {
        return { kind: "error", code: "ROOF_NOT_DETECTED" };
      }
      if (error instanceof KartverketHeightDataError) {
        return { kind: "error", code: "HEIGHT_DATA_UNAVAILABLE" };
      }
      return { kind: "error", code: "HEIGHT_DATA_UNAVAILABLE" };
    }
  }

  return (
    <AdminNextRoofFusionUatControl
      action={prepareR4Uat}
      addressLookupAction={lookupRealAddress}
      defaultCaseReference="TF-13"
      heightAnalysisAction={analyzeHeightSurface}
      locale={user.interfaceLanguage}
    />
  );
}
