import { notFound } from "next/navigation";
import { AdminNextR4MeasurementReview } from "@/components/admin-next/admin-next-r4-measurement-review";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

export default function AdminNextR4VisualFixture() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true"
  ) {
    notFound();
  }
  const measurement = adminNextCaseWorkspaceFixture.measurementReview;
  if (!measurement) notFound();

  return (
    <AdminNextShell displayName="Demo administratorius" locale="lt">
      <AdminNextR4MeasurementReview
        address={adminNextCaseWorkspaceFixture.address}
        addressEditHref="/admin-v2/cases/1042#measurement-section"
        caseRevision={12}
        caseReference={adminNextCaseWorkspaceFixture.reference}
        customer={adminNextCaseWorkspaceFixture.customer}
        locale="lt"
        measurement={measurement}
        measurementRevision={7}
        owner={adminNextCaseWorkspaceFixture.owner.name}
        returnTo="/admin-next-preview/cases/TF-1042?tab=measurement#case-evidence-title"
        source="fixture"
      />
    </AdminNextShell>
  );
}
