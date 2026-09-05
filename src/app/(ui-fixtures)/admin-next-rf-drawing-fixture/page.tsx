import { notFound } from "next/navigation";
import { AdminNextRoofFusionPersistentWorkbench } from "@/components/admin-next/admin-next-roof-fusion-persistent-workbench";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";

/** Deterministic local-only input; no live capture, account, or case data. */
export default function AdminNextRfDrawingFixture() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true"
  ) {
    notFound();
  }

  const geoReference = {
    crs: "EPSG:25833" as const,
    extentTrust: "actual-visible-extent" as const,
    bounds: {
      minEastingM: 500_000,
      minNorthingM: 6_640_000,
      maxEastingM: 500_030,
      maxNorthingM: 6_640_030,
    },
    // Non-square display deliberately exercises CSS-pixel snapping metrics.
    imageWidth: 1200,
    imageHeight: 800,
  };
  const normalize = ([x, y]: readonly number[]) => ({
    x: (x + 9) / 30,
    y: (21 - y) / 30,
  });
  const sourceOutline = [
    [0, 0],
    [12, 0],
    [12, 12],
    [6, 12],
    [6, 6],
    [0, 6],
  ].map(normalize);
  const domElevationM: number[] = [];
  const heightAboveTerrainM: number[] = [];
  for (let row = 0; row < 60; row += 1) {
    const y = 21 - (row + 0.5) * 0.5;
    for (let column = 0; column < 60; column += 1) {
      const x = -9 + (column + 0.5) * 0.5;
      const z =
        10 -
        0.5 *
          (x < 6
            ? Math.abs(y - 3)
            : x >= 9 || y < 0 || y > 6
              ? Math.abs(x - 9)
              : Math.min(Math.abs(x - 9), Math.abs(y - 3)));
      domElevationM.push(100 + z);
      heightAboveTerrainM.push(z);
    }
  }
  const heightSurface: KartverketHeightSurfaceV1 = {
    schemaVersion: "kartverket-height-surface.v1",
    provider: "Kartverket Nasjonal detaljert høydemodell WCS",
    coordinateSystem: "EPSG:25833",
    bbox: geoReference.bounds,
    grid: {
      width: 60,
      height: 60,
      cellWidthM: 0.5,
      cellHeightM: 0.5,
      rowOrder: "north_to_south",
    },
    values: {
      domElevationM,
      dtmElevationM: Array(3600).fill(100),
      heightAboveTerrainM,
    },
    quality: {
      status: "usable",
      coverageRatio: 1,
      validSamples: 3600,
      totalSamples: 3600,
      maxHeightAboveTerrainM: 10,
      reasons: ["Synthetic browser regression"],
    },
    provenance: {
      retrievedAt: "2026-09-05T12:00:00.000Z",
      domCoverageId: "nhm_dom_topo_25833",
      dtmCoverageId: "nhm_dtm_topo_25833",
      domContentSha256: "b".repeat(64),
      dtmContentSha256: "c".repeat(64),
      resolutionM: 0.5,
      license: "Norsk lisens for offentlige data (NLOD) 2.0",
      attribution: "Kartverket",
    },
  };
  const image =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#263442"/><path d="M360 560H840V240H600V400H360Z" fill="#465466"/></svg>';

  return (
    <main className="mx-auto max-w-[1100px] p-4" data-rf-browser-fixture>
      <AdminNextRoofFusionPersistentWorkbench
        actorId="7"
        caseId="lead:rf-browser-fixture"
        capture={{
          imageUrl: `data:image/svg+xml,${encodeURIComponent(image)}`,
          mediaId: "rf-browser-image",
          sourceId: "rf-browser-synthetic-capture",
          rawContentHash: "a".repeat(64),
          attribution: "Synthetic browser test",
          capturedAt: "2026-09-05T12:00:00.000Z",
          geoReference,
        }}
        heightSurface={heightSurface}
        horizontalAreaSquareMeters={108}
        orthoImageAlt="Synthetic L roof"
        sourceFootprintId="rf-browser-synthetic-footprint"
        sourceOutline={sourceOutline}
      />
    </main>
  );
}
