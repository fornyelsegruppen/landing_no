import { notFound } from "next/navigation";
import { AdminNextFieldVisit } from "@/components/admin-next/admin-next-field-visit";
import { parseAdminNextFieldVisitState } from "@/lib/admin-next/field-visit-contract";
import { buildAdminNextFieldVisitFixture } from "@/lib/admin-next/field-visit-fixture";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminNextFieldVisitVisualFixture({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true"
  ) {
    notFound();
  }
  const params = await searchParams;
  const state = parseAdminNextFieldVisitState(params.state);

  return (
    <AdminNextFieldVisit
      locale="lt"
      stateHrefBase="/admin-next-field-visit-fixture"
      visit={buildAdminNextFieldVisitFixture(state)}
    />
  );
}
