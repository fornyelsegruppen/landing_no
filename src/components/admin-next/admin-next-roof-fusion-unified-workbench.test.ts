import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminNextRoofFusionUnifiedWorkbench,
  DEFAULT_ROOF_FUSION_VIEWPORT,
  DEFAULT_ROOF_FUSION_LAYERS,
  MAX_ROOF_FUSION_ZOOM,
  MIN_ROOF_FUSION_ZOOM,
  ROOF_FUSION_STAGES,
  clampRoofFusionPoint,
  clampRoofFusionViewport,
  hasRoofFusionPanGestureMoved,
  panRoofFusionViewport,
  roofFusionEndpointConstraintMetric,
  roofFusionImagePointFromViewportPoint,
  roofFusionScreenStableMarkerRadii,
  shouldHandleRoofFusionZoomWheel,
  shouldSuppressRoofFusionCanvasClick,
  zoomRoofFusionViewportAt,
} from "./admin-next-roof-fusion-unified-workbench";
import {
  AdminNextRoofFusionPersistentWorkbench,
  localizedWorkbenchHeightBlocker,
} from "./admin-next-roof-fusion-persistent-workbench";

const sourceOutline = [
  { x: 0.16, y: 0.18 },
  { x: 0.84, y: 0.18 },
  { x: 0.92, y: 0.78 },
  { x: 0.12, y: 0.78 },
] as const;

describe("Admin Next unified Roof Fusion workbench", () => {
  it("exports a four-stage guided workflow and safe normalized-point helper", () => {
    expect(ROOF_FUSION_STAGES).toEqual([
      "outline",
      "skeleton",
      "slopes",
      "review",
    ]);
    expect(clampRoofFusionPoint({ x: -0.2, y: 1.4 })).toEqual({ x: 0, y: 1 });
    expect(DEFAULT_ROOF_FUSION_LAYERS.hoydedata).toBe(false);
    expect(DEFAULT_ROOF_FUSION_LAYERS.roofPlanes).toBe(false);
    expect(DEFAULT_ROOF_FUSION_LAYERS.skeleton).toBe(false);
  });

  it("bounds zoom and pan, and resets the complete viewport at 1x", () => {
    expect(
      clampRoofFusionViewport({ scale: 12, offsetX: -20, offsetY: 5 }),
    ).toEqual({
      scale: MAX_ROOF_FUSION_ZOOM,
      offsetX: 1 - MAX_ROOF_FUSION_ZOOM,
      offsetY: 0,
    });
    expect(
      zoomRoofFusionViewportAt({ scale: 3, offsetX: -1, offsetY: -0.5 }, 0.5),
    ).toEqual(DEFAULT_ROOF_FUSION_VIEWPORT);
    expect(
      panRoofFusionViewport(DEFAULT_ROOF_FUSION_VIEWPORT, {
        x: -0.5,
        y: -0.5,
      }),
    ).toEqual(DEFAULT_ROOF_FUSION_VIEWPORT);
    expect(MIN_ROOF_FUSION_ZOOM).toBe(1);
    expect(MAX_ROOF_FUSION_ZOOM).toBe(4);
  });

  it("keeps the image point under the zoom anchor and maps panned pointers back exactly", () => {
    const anchor = { x: 0.25, y: 0.75 };
    const zoomed = zoomRoofFusionViewportAt(
      DEFAULT_ROOF_FUSION_VIEWPORT,
      2,
      anchor,
    );

    expect(zoomed).toEqual({ scale: 2, offsetX: -0.25, offsetY: -0.75 });
    expect(roofFusionImagePointFromViewportPoint(anchor, zoomed)).toEqual(
      anchor,
    );
    expect(
      roofFusionImagePointFromViewportPoint(
        { x: 0.5, y: 0.5 },
        { scale: 2, offsetX: -0.5, offsetY: -0.25 },
      ),
    ).toEqual({ x: 0.5, y: 0.375 });
  });

  it("derives a pan-independent constant CSS-pixel endpoint tolerance", () => {
    expect(
      roofFusionEndpointConstraintMetric(
        { width: 1_000, height: 500 },
        DEFAULT_ROOF_FUSION_VIEWPORT,
      ),
    ).toEqual({
      xPixelsPerImageUnit: 1_000,
      yPixelsPerImageUnit: 500,
      maxDistancePixels: 14,
    });
    expect(
      roofFusionEndpointConstraintMetric(
        { width: 1_000, height: 500 },
        { scale: 3, offsetX: -1.7, offsetY: -0.4 },
      ),
    ).toEqual({
      xPixelsPerImageUnit: 3_000,
      yPixelsPerImageUnit: 1_500,
      maxDistancePixels: 14,
    });
  });

  it("leaves plain wheel scrolling alone and reserves Ctrl/Cmd-wheel for zoom", () => {
    expect(
      shouldHandleRoofFusionZoomWheel({ ctrlKey: false, metaKey: false }),
    ).toBe(false);
    expect(
      shouldHandleRoofFusionZoomWheel({ ctrlKey: true, metaKey: false }),
    ).toBe(true);
    expect(
      shouldHandleRoofFusionZoomWheel({ ctrlKey: false, metaKey: true }),
    ).toBe(true);
  });

  it("arbitrates a direct pan only after movement and suppresses its click", () => {
    const start = { clientX: 100, clientY: 100 };
    expect(
      hasRoofFusionPanGestureMoved(start, { clientX: 103, clientY: 103 }),
    ).toBe(false);
    expect(
      hasRoofFusionPanGestureMoved(start, { clientX: 106, clientY: 100 }),
    ).toBe(true);
    expect(shouldSuppressRoofFusionCanvasClick({ moved: false })).toBe(false);
    expect(shouldSuppressRoofFusionCanvasClick({ moved: true })).toBe(true);
  });

  it("keeps source geometry visibly immutable while providing one clear image surface", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        orthoImageSrc: "/preview/house-ortho.jpg",
        orthoImageWidth: 1920,
        orthoImageHeight: 1080,
        sourceOutline,
        horizontalAreaSquareMeters: 142,
        totalSurfaceAreaSquareMeters: 159.4,
        averageSlopeDegrees: 27,
      }),
    );

    expect(html).toContain('data-roof-fusion-workbench="unified"');
    expect(html).toContain("data-roof-fusion-canvas");
    expect(html).toContain("data-roof-fusion-viewport-controls");
    expect(html).toContain('data-roof-fusion-viewport-scale="1"');
    expect(html).toContain("Dabartinis vaizdo mastelis");
    expect(html).toContain("100%");
    expect(html).not.toContain(">Perstumti vaizdą<");
    expect(html).toContain("Ctrl/Cmd + ratukas");
    expect(html).toContain("Talpinti");
    expect(html).toContain('src="/preview/house-ortho.jpg"');
    expect(html).toContain("aspect-ratio:1920 / 1080");
    expect(html).toContain('preserveAspectRatio="none"');
    expect(html).toContain("©norgeibilder.no");
    expect(html).toContain('data-roof-fusion-layer="sourceOutline"');
    expect(html).toContain("data-roof-fusion-approved-outline-opacity-control");
    expect(html).toContain("Patvirtinto ploto spalvos ryškumas");
    expect(html).toContain("touch-pan-y");
    expect(html).toContain('data-roof-fusion-vertex-marker="0"');
    expect(html).toContain('rx="0.006"');
    expect(html).toContain("Šaltinio kontūras nekintamas");
    expect(html).toContain("142 m²");
    expect(html).toContain("159,4 m²");
    expect(html).toContain("27°");
    expect(html).not.toContain('data-roof-fusion-layer="hoydedata"');
    expect(html).not.toContain('data-roof-fusion-layer="roofPlanes"');
    expect(html).not.toContain('data-roof-fusion-layer="skeleton"');
  });

  it("keeps technical controls and the legacy fallback slot in a closed Advanced panel", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        advancedPanel: createElement("button", null, "Atnaujinti šaltinį"),
        orthoImageSrc: "/preview/house-ortho.jpg",
        sourceOutline,
      }),
    );

    const advancedStart = html.indexOf("data-roof-fusion-advanced");
    const advancedTagStart = html.lastIndexOf("<details", advancedStart);
    const advancedEnd = html.indexOf("</details>", advancedStart);
    const advanced = html.slice(advancedStart, advancedEnd);
    expect(advancedStart).toBeGreaterThan(-1);
    expect(
      html.slice(advancedTagStart, html.indexOf(">", advancedTagStart)),
    ).not.toContain(" open");
    expect(advanced).toContain("Advanced · techniniai sluoksniai ir kontrolės");
    expect(advanced).toContain("data-roof-fusion-layer-toggle");
    expect(advanced).toContain("Atnaujinti šaltinį");
    expect(advanced).toContain("data-roof-fusion-legacy-fallback-slot");
    expect(advanced).toContain("Senas rankinis skaičiavimas (fallback)");
  });

  it("localizes adapter blocker prose and never exposes unknown English reasons", () => {
    expect(
      localizedWorkbenchHeightBlocker(
        "[SKELETON_DANGLING_ENDPOINT] Endpoint is not attached.",
      ),
    ).toContain("Kraigo arba slėnio galas nesujungtas");
    expect(
      localizedWorkbenchHeightBlocker(
        "Manual ridge, valley, hip, and eave hints were used for explicit plane subdivision.",
      ),
    ).toBe(
      "Rankinės stogo linijos panaudotos paviršiams atskirti. Rezultatą būtina peržiūrėti.",
    );
    expect(
      localizedWorkbenchHeightBlocker("Unknown adapter failure in plane fit"),
    ).not.toContain("Unknown adapter failure");
  });

  it("renders Høydedata samples as small aspect-corrected points", () => {
    const atOneX = roofFusionScreenStableMarkerRadii(0.006, 4 / 3, 1);
    const atFourX = roofFusionScreenStableMarkerRadii(0.006, 4 / 3, 4);
    expect(atFourX.rx * 4).toBeCloseTo(atOneX.rx);
    expect(atFourX.ry * 4).toBeCloseTo(atOneX.ry);

    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        heightPoints: [{ point: { x: 0.5, y: 0.5 }, elevationMeters: 123 }],
        initialLayers: { hoydedata: true },
        orthoImageHeight: 750,
        orthoImageSrc: "/preview/house-ortho.jpg",
        orthoImageWidth: 1000,
        sourceOutline,
      }),
    );

    expect(html).toContain('data-roof-fusion-height-point="0"');
    expect(html).toContain('rx="0.0035"');
    expect(html).toContain('ry="0.004666666666666666"');
  });

  it("renders normalized roof planes, skeleton lines, obstacles, and explicit blockers when requested", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        orthoImageSrc: "/preview/house-ortho.jpg",
        sourceOutline,
        roofPlanes: [
          {
            id: "plane-a",
            points: [
              { x: 0.16, y: 0.18 },
              { x: 0.5, y: 0.3 },
              { x: 0.84, y: 0.18 },
            ],
            slopeDegrees: 26,
          },
        ],
        lines: [
          {
            id: "ridge-a",
            kind: "ridge",
            start: { x: 0.5, y: 0.3 },
            end: { x: 0.5, y: 0.7 },
          },
        ],
        obstacles: [
          { id: "chimney", point: { x: 0.65, y: 0.52 }, label: "Kaminas" },
        ],
        initialLayers: { roofPlanes: true, skeleton: true },
        blockers: ["Trūksta patvirtinto nuolydžio"],
        confidence: "low",
      }),
    );

    expect(html).toContain('data-roof-fusion-layer="roofPlanes"');
    expect(html).toContain('data-roof-fusion-layer="skeleton"');
    expect(html).toContain('data-roof-fusion-line-kind="ridge"');
    expect(html).toContain('data-roof-fusion-obstacle="chimney"');
    expect(html).toContain("Trūksta patvirtinto nuolydžio");
    expect(html).toContain("Pirmiausia išspręskite blokatorius");
    expect(html).toContain('disabled=""');
  });

  it("applies only the blockers for the active guided stage", () => {
    const outlineHtml = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        orthoImageSrc: "/preview/house-ortho.jpg",
        sourceOutline,
        stageBlockers: { review: ["Preview išsaugojimas dar neįjungtas"] },
      }),
    );
    const reviewHtml = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        initialStage: "review",
        orthoImageSrc: "/preview/house-ortho.jpg",
        sourceOutline,
        stageBlockers: { review: ["Preview išsaugojimas dar neįjungtas"] },
      }),
    );

    expect(outlineHtml).not.toContain("Preview išsaugojimas dar neįjungtas");
    expect(reviewHtml).toContain("Preview išsaugojimas dar neįjungtas");
    expect(reviewHtml).toContain('disabled=""');
  });

  it("keeps save, reload proof and height gating inside the approved one-window UI", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionPersistentWorkbench, {
        actorId: "7",
        caseId: "lead:13",
        horizontalAreaSquareMeters: 142,
        orthoImageAlt: "Test roof",
        sourceOutline,
        capture: {
          imageUrl: "/api/admin/media/91",
          mediaId: "91",
          sourceId: "norge-i-bilder:91",
          rawContentHash: "a".repeat(64),
          capturedAt: "2026-09-03T08:00:00.000Z",
          attribution: "©norgeibilder.no",
          geoReference: {
            crs: "EPSG:25833",
            extentTrust: "actual-visible-extent",
            bounds: {
              minEastingM: 500000,
              minNorthingM: 6640000,
              maxEastingM: 500020,
              maxNorthingM: 6640010,
            },
            imageWidth: 1920,
            imageHeight: 1080,
          },
        },
      }),
    );

    expect(html).toContain('data-roof-fusion-workbench="unified"');
    expect(html).toContain('data-roof-fusion-persistence="true"');
    expect(html).toContain("Išsaugoti ir patvirtinti reviziją");
    expect(html).toContain("Perkrauti");
    expect(html).not.toContain("pakeitimai šiame pjūvyje dar neišsaugomi");
  });
});
