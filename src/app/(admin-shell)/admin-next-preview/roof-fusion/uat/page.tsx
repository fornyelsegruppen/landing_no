import { notFound } from "next/navigation";
import type { PayloadRequest } from "payload";
import {
  AdminNextRoofFusionUatControl,
  type RoofFusionUatActionState,
} from "@/components/admin-next/admin-next-roof-fusion-uat-control";
import { parseAdminNextR4CaseIdentityV1 } from "@/lib/admin-next/r4-read-adapter";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import { PayloadRoofSnapshotRepositoryV1 } from "@/lib/roof-fusion/payload-repository-v1";
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
    const caseReference = String(formData.get("caseReference") ?? "")
      .trim()
      .toUpperCase();
    const identity = parseAdminNextR4CaseIdentityV1(caseReference);
    if (!identity) notFound();

    const payload = await getPayload();
    const authenticatedUser = user as PayloadRequest["user"];
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

  return (
    <AdminNextRoofFusionUatControl
      action={prepareR4Uat}
      defaultCaseReference="TF-13"
      locale={user.interfaceLanguage}
    />
  );
}
