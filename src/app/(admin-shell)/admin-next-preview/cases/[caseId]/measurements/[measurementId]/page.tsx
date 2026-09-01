import { notFound, redirect } from "next/navigation";
import type { PayloadRequest } from "payload";
import { AdminNextR4MeasurementReview } from "@/components/admin-next/admin-next-r4-measurement-review";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";
import {
  adminNextFixtureR4Adapter,
  createAdminNextRoofFusionR4Adapter,
  loadAdminNextR4WithMissingCanonicalFallback,
  parseAdminNextR4CaseIdentityV1,
} from "@/lib/admin-next/r4-read-adapter";
import { appendAdminNextR4LeadPhotoEvidence } from "@/lib/admin-next/r4-evidence-photo-adapter";
import { resolveAdminNextServerRead } from "@/lib/admin-next/server-read-resolver";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import { parseLeadPhotoUrls } from "@/lib/lead-photo-token";
import { PayloadRoofSnapshotRepositoryV1 } from "@/lib/roof-fusion/payload-repository-v1";
import {
  AdminRoofFusionPreviewReadAdapterV1,
  PayloadRoofFusionCaseAuthorizationV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";

type Params = Promise<{ caseId: string; measurementId: string }>;

export default async function AdminNextR4MeasurementPage({
  params,
}: {
  params: Params;
}) {
  const user = await requireAdminUser();
  const rollout = buildAdminNextRolloutView();
  const access = resolveAdminNextPreviewAccess(rollout, "roofWorkbench");
  if (access.kind === "legacy_fallback") redirect(access.href);

  const { caseId, measurementId } = await params;
  const payload = await getPayload();
  const canonical = createAdminNextRoofFusionR4Adapter(
    new AdminRoofFusionPreviewReadAdapterV1(
      new PayloadRoofSnapshotRepositoryV1(payload),
      new PayloadRoofFusionCaseAuthorizationV1(payload),
    ),
    user as PayloadRequest["user"],
  );
  const selection = resolveAdminNextServerRead({
    moduleId: "roofWorkbench",
    rollout,
    role: user.role,
    canonical,
    fixture: adminNextFixtureR4Adapter,
  });
  if (selection.kind === "legacy_fallback") redirect(selection.href);
  const result =
    selection.kind === "canonical_read"
      ? await loadAdminNextR4WithMissingCanonicalFallback({
          canonical: selection.adapter,
          fixture: adminNextFixtureR4Adapter,
          caseReference: caseId,
          measurementReference: measurementId,
        })
      : await selection.adapter.load(caseId, measurementId);

  if (result.status === "not_found") notFound();

  let customer = adminNextCaseWorkspaceFixture.customer;
  let address = adminNextCaseWorkspaceFixture.address;
  let owner = adminNextCaseWorkspaceFixture.owner.name;
  let measurement = result.value;
  if (result.source === "canonical") {
    const identity = parseAdminNextR4CaseIdentityV1(caseId);
    if (!identity) notFound();
    const lead = await payload.findByID({
      collection: "leads",
      id: identity.leadId,
      depth: 1,
      overrideAccess: true,
    });
    customer = lead.name;
    address = [lead.address, lead.postal, lead.city]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(", ");
    if (lead.assignedTo && typeof lead.assignedTo === "object") {
      owner = lead.assignedTo.displayName || lead.assignedTo.email;
    }
    measurement = appendAdminNextR4LeadPhotoEvidence({
      measurement,
      leadId: identity.leadId,
      photoCount: parseLeadPhotoUrls(lead.photoUrls).length,
      capturedAt: lead.updatedAt,
      locale: user.interfaceLanguage,
    });
  }

  return (
    <AdminNextR4MeasurementReview
      address={address}
      caseReference={caseId}
      customer={customer}
      locale={user.interfaceLanguage}
      measurement={measurement}
      owner={owner}
      source={result.source}
    />
  );
}
