import { notFound } from "next/navigation";
import { AdminNextR4MeasurementReview } from "@/components/admin-next/admin-next-r4-measurement-review";
import { AdminNextRfOfferBridgeAction } from "@/components/admin-next/admin-next-rf-offer-bridge-action";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

const allowedStates = ["address_review", "offer_review"] as const;
type FixtureState = (typeof allowedStates)[number];

function isFixtureState(value: string): value is FixtureState {
  return allowedStates.some((state) => state === value);
}

export default async function AdminNextR4VisualFixture({
  searchParams,
}: {
  searchParams?: Promise<{ state?: string | string[] }>;
}) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true"
  ) {
    notFound();
  }
  const requestedState = (await searchParams)?.state;
  const state =
    typeof requestedState === "string" ? requestedState : "address_review";
  if (!isFixtureState(state)) notFound();

  const baseMeasurement = adminNextCaseWorkspaceFixture.measurementReview;
  const measurement =
    state === "offer_review" && baseMeasurement
      ? {
          ...baseMeasurement,
          state: "verified" as const,
          reviewEdges: [],
          verificationGates: baseMeasurement.verificationGates.map((gate) => ({
            ...gate,
            detail:
              gate.id === "review_edges"
                ? "0 conflict edge(s)"
                : "Fixture verification passed",
            state: "verified" as const,
          })),
        }
      : baseMeasurement;
  if (!measurement) notFound();

  return (
    <AdminNextShell displayName="Demo administratorius" locale="lt">
      <div data-r4-mutation-fixture={state}>
        <AdminNextR4MeasurementReview
          address="Lyngveien 28A, 1182 Oslo"
          addressCorrection={{
            caseId: 1042,
            currentAddress: {
              city: "Oslo",
              houseNumber: "28A",
              postalCode: "1182",
              street: "Lyngveien",
            },
            expectedAddressRevision: 7,
            expectedCaseRevision: 12,
          }}
          caseRevision={12}
          caseReference={adminNextCaseWorkspaceFixture.reference}
          customer={adminNextCaseWorkspaceFixture.customer}
          locale="lt"
          measurement={measurement}
          measurementRevision={7}
          offerAction={
            state === "offer_review" ? (
              <AdminNextRfOfferBridgeAction
                addressRevision={7}
                caseId="lead:1042"
                caseRevision={12}
                locale="lt"
                snapshot={{
                  inputHash: "b".repeat(64),
                  renderHash: "c".repeat(64),
                  revision: 7,
                  snapshotHash: "a".repeat(64),
                  snapshotId: "roof-case-1042-r7",
                }}
              />
            ) : undefined
          }
          owner={adminNextCaseWorkspaceFixture.owner.name}
          returnTo="/admin-next-preview/cases/TF-1042?tab=measurement#case-evidence-title"
          source="fixture"
        />
      </div>
    </AdminNextShell>
  );
}
