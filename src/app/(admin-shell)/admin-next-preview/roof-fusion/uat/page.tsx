import { notFound } from "next/navigation";
import { headers } from "next/headers";
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
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { KartverketAddressProvider } from "@/lib/providers/kartverket-address-provider";
import { KartverketHeightDataProvider } from "@/lib/providers/kartverket-hoydedata-provider";
import { OpenStreetMapBuildingProvider } from "@/lib/providers/osm-building-provider";
import { buildRoofFusionHeightSurfacePreviewV1 } from "@/lib/roof-fusion/hoydedata-surface-preview-v1";
import { buildHeightSurfaceVisualizationV1 } from "@/lib/roof-fusion/hoydedata-surface-visualization-v1";
import { PayloadRoofSnapshotRepositoryV1 } from "@/lib/roof-fusion/payload-repository-v1";
import { buildRoofFusionOsmFootprintPreviewV1 } from "@/lib/roof-fusion/osm-footprint-preview-v1";
import {
  assertRoofFusionPreviewEnabledV1,
  PayloadRoofFusionCaseAuthorizationV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";
import { prepareRoofFusionPreviewUatGoldenV1 } from "@/lib/roof-fusion/preview-uat-golden-v1";
import {
  mapRoofFusionHeightActionFailureV1,
  type RoofFusionHeightActionPhaseV1,
} from "@/lib/roof-fusion/preview-height-action-failure-v1";

export const maxDuration = 60;

function manualRidgeFromFormV1(formData: FormData) {
  const names = ["ridgeFromX", "ridgeFromY", "ridgeToX", "ridgeToY"] as const;
  const values = names.map((name) => formData.get(name));
  if (values.every((value) => value === null)) return undefined;
  if (
    values.some(
      (value) =>
        typeof value !== "string" ||
        !/^(?:0|1|0?\.\d+|1\.0+)$/u.test(value.trim()),
    )
  ) {
    return null;
  }
  const parsed = values.map((value) => Number(value)) as [
    number,
    number,
    number,
    number,
  ];
  if (
    parsed.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  ) {
    return null;
  }
  return [
    { x: parsed[0], y: parsed[1] },
    { x: parsed[2], y: parsed[3] },
  ] as const;
}

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

    const actionDeadlineAtMs = Date.now() + 50_000;
    assertRoofFusionPreviewEnabledV1(process.env);
    await requireAdminUser();
    const correlationId = correlationIdFromHeaders(await headers());
    const fail = (phase: RoofFusionHeightActionPhaseV1, error: unknown) => {
      const mapped = mapRoofFusionHeightActionFailureV1(
        phase,
        error,
        correlationId,
      );
      console.warn(mapped.diagnostic.event, mapped.diagnostic);
      return mapped.state;
    };
    const query = String(formData.get("addressQuery") ?? "")
      .trim()
      .replace(/\s+/gu, " ");
    const candidateId = String(formData.get("candidateId") ?? "").trim();
    const manualRidge = manualRidgeFromFormV1(formData);
    if (
      query.length < 4 ||
      query.length > 180 ||
      !/^(?:way|relation)\/[1-9][0-9]*$/u.test(candidateId) ||
      manualRidge === null
    ) {
      return { kind: "error", code: "INVALID_SELECTION" };
    }

    // Re-resolve both public sources server-side. The client-selected ID is
    // accepted only when it still belongs to this address lookup. A timeout
    // here happens before Høydedata is read and must not be labeled as a
    // height-provider failure.
    let addresses;
    try {
      addresses = await new KartverketAddressProvider().searchAddress(query);
    } catch (error) {
      return fail("address_revalidation", error);
    }
    const address = addresses[0];
    if (!address) return { kind: "error", code: "INVALID_SELECTION" };
    let candidates;
    try {
      candidates = await new OpenStreetMapBuildingProvider().findBuildings({
        latitude: address.latitude,
        longitude: address.longitude,
      });
    } catch (error) {
      return fail("building_revalidation", error);
    }
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate) return { kind: "error", code: "INVALID_SELECTION" };

    let surface;
    try {
      surface = await new KartverketHeightDataProvider().getSurface({
        polygon: candidate.polygon,
        cacheMode: "no-store",
        deadlineAtMs: actionDeadlineAtMs,
      });
    } catch (error) {
      return fail("height_fetch", error);
    }

    try {
      const preview = buildRoofFusionHeightSurfacePreviewV1({
        address,
        candidate,
        surface,
        ...(manualRidge ? { manualRidge } : {}),
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
        surface,
      };
    } catch (error) {
      return fail("height_processing", error);
    }
  }

  return (
    <AdminNextRoofFusionUatControl
      action={prepareR4Uat}
      actorId={String(user.id)}
      addressLookupAction={lookupRealAddress}
      defaultCaseReference="TF-13"
      heightAnalysisAction={analyzeHeightSurface}
      locale={user.interfaceLanguage}
    />
  );
}
