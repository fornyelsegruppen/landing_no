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
        caseReference={adminNextCaseWorkspaceFixture.reference}
        customer={adminNextCaseWorkspaceFixture.customer}
        locale="lt"
        measurement={measurement}
        source="fixture"
      />
    </AdminNextShell>
  );
}
