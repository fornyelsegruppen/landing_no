import { notFound } from "next/navigation";
import { AdminNextRfCaseAddressContext } from "@/components/admin-next/admin-next-rf-case-address-context";
import { AdminNextRoofFusionUnifiedWorkbench } from "@/components/admin-next/admin-next-roof-fusion-unified-workbench";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";

const outline = [
  { x: 0.18, y: 0.2 },
  { x: 0.84, y: 0.1 },
  { x: 0.98, y: 0.82 },
  { x: 0.08, y: 0.82 },
] as const;

export default function AdminNextRfWorkbenchVisualFixture() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true"
  ) {
    notFound();
  }

  return (
    <AdminNextShell displayName="Demo administratorius" locale="lt">
      <AdminNextRoofFusionUnifiedWorkbench
        approvedOutline={outline}
        averageSlopeDegrees={27}
        caseAddressContext={
          <AdminNextRfCaseAddressContext
            address="Tordenskiolds gate 12, 0160 Oslo"
            caseReference="TF-1042"
            caseRevision={12}
            editHref="/admin-v2/cases/1042#measurement-section"
            locale="lt"
            measurementRevision={7}
          />
        }
        confidence="high"
        confidenceReason="Kontūras sutampa su bylos šaltiniu; prieš skaičiavimą operatorius patikrina stogo linijas."
        footprintPerimeterMeters={51.8}
        guardNotice="Apsaugota Preview · be įrašymo"
        horizontalAreaSquareMeters={142}
        initialLayers={{
          approvedOutline: true,
          skeleton: true,
          sourceOutline: true,
        }}
        lines={[
          {
            end: { x: 0.84, y: 0.1 },
            id: "ridge-1",
            kind: "ridge",
            start: { x: 0.18, y: 0.2 },
          },
          {
            end: { x: 0.66, y: 0.82 },
            id: "valley-1",
            kind: "valley",
            start: { x: 0.58, y: 0.14 },
          },
        ]}
        orthoAttribution="Vizualinė fixture · tikras ONE UI komponentas"
        orthoImageAlt="RF vizualinės regresijos stogo vaizdas"
        orthoImageHeight={628}
        orthoImageSrc="/gallery/takfornyelse/06-L-finished-house-roof.jpg"
        orthoImageWidth={1200}
        sourceOutline={outline}
        totalSurfaceAreaSquareMeters={159.4}
      />
    </AdminNextShell>
  );
}
