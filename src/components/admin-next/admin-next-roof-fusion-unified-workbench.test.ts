import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminNextRoofFusionUnifiedWorkbench,
  DEFAULT_ROOF_FUSION_VIEWPORT,
  DEFAULT_ROOF_FUSION_LAYERS,
  MAX_ROOF_FUSION_ZOOM,
  MIN_ROOF_FUSION_ZOOM,
  ROOF_FUSION_PENDING_LINE_STROKE,
  ROOF_FUSION_ONE_CARD_STEPS,
  ROOF_FUSION_SKELETON_ENDPOINT_CENTER_RADIUS,
  ROOF_FUSION_SKELETON_ENDPOINT_RADIUS,
  ROOF_FUSION_SKELETON_HIT_RADIUS,
  ROOF_FUSION_SKELETON_HIT_STROKE,
  ROOF_FUSION_SKELETON_LINE_STROKE,
  ROOF_FUSION_STAGES,
  clampRoofFusionPoint,
  clampRoofFusionViewport,
  constrainRoofFusionDraggedEndpoint,
  hasRoofFusionPanGestureMoved,
  panRoofFusionViewport,
  roofFusionEndpointConstraintMetric,
  roofFusionImagePointFromViewportPoint,
  roofFusionLineJunctionTargets,
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
  it("exports the three-step one-card progress and safe normalized-point helper", () => {
    expect(ROOF_FUSION_ONE_CARD_STEPS).toEqual(["object", "refine", "result"]);
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

  it("keeps endpoint drag inside the roof and uses screen-space boundary and junction magnets", () => {
    const outline = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];
    const metricAtOneX = {
      xPixelsPerImageUnit: 1_000,
      yPixelsPerImageUnit: 500,
      maxDistancePixels: 14,
    };
    const metricAtThreeX = {
      xPixelsPerImageUnit: 3_000,
      yPixelsPerImageUnit: 1_500,
      maxDistancePixels: 14,
    };

    expect(
      constrainRoofFusionDraggedEndpoint(
        { x: 0.5, y: 0.5 },
        outline,
        [],
        metricAtOneX,
      ),
    ).toEqual({ x: 0.5, y: 0.5 });
    expect(
      constrainRoofFusionDraggedEndpoint(
        { x: 0.95, y: 0.5 },
        outline,
        [],
        metricAtOneX,
      ),
    ).toEqual({ x: 0.9, y: 0.5 });
    expect(
      constrainRoofFusionDraggedEndpoint(
        { x: 0.104, y: 0.5 },
        outline,
        [],
        metricAtThreeX,
      ),
    ).toEqual({ x: 0.1, y: 0.5 });
    expect(
      constrainRoofFusionDraggedEndpoint(
        { x: 0.504, y: 0.5 },
        outline,
        [{ x: 0.5, y: 0.5 }],
        metricAtThreeX,
      ),
    ).toEqual({ x: 0.5, y: 0.5 });

    const junctionTargets = roofFusionLineJunctionTargets(
      [
        {
          id: "horizontal",
          kind: "ridge",
          start: { x: 0.2, y: 0.5 },
          end: { x: 0.8, y: 0.5 },
        },
        {
          id: "vertical",
          kind: "valley",
          start: { x: 0.5, y: 0.2 },
          end: { x: 0.5, y: 0.8 },
        },
      ],
      undefined,
      { x: 0.504, y: 0.6 },
    );
    expect(junctionTargets).toContainEqual({ x: 0.5, y: 0.5 });
    expect(junctionTargets).toContainEqual({ x: 0.5, y: 0.6 });
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

  it("keeps technical controls out of the normal card until Advanced opens", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        advancedPanel: createElement("button", null, "Atnaujinti šaltinį"),
        orthoImageSrc: "/preview/house-ortho.jpg",
        sourceOutline,
      }),
    );

    expect(html).toContain("data-roof-fusion-advanced-trigger");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("data-roof-fusion-advanced-source-actions");
    expect(html).not.toContain("data-roof-fusion-layer-toggle");
    expect(html).not.toContain("Atnaujinti šaltinį");
    expect(html).not.toContain("data-roof-fusion-legacy-fallback-slot");
  });

  it("makes completed progress steps reachable while future steps stay unavailable", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        onChangeBuilding: () => undefined,
        orthoImageSrc: "/preview/house-ortho.jpg",
        sourceOutline,
      }),
    );

    expect(html).toContain("data-roof-fusion-one-card-progress");
    expect(html).toContain("data-roof-fusion-change-building");
    expect(html).toContain("Grįžti į žingsnį Objektas");
    expect(html).toContain(
      'data-roof-fusion-one-card-step="object" data-roof-fusion-one-card-step-state="reachable"',
    );
    expect(html).toContain(
      'data-roof-fusion-one-card-step="refine" data-roof-fusion-one-card-step-state="active" disabled=""',
    );
    expect(html).toContain(
      'data-roof-fusion-one-card-step="result" data-roof-fusion-one-card-step-state="future" disabled=""',
    );
    expect(html.indexOf("data-roof-fusion-change-building")).toBeLessThan(
      html.indexOf("data-roof-fusion-advanced-trigger"),
    );

    const reviewHtml = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        initialStage: "review",
        onChangeBuilding: () => undefined,
        onEditResult: () => undefined,
        orthoImageSrc: "/preview/house-ortho.jpg",
        sourceOutline,
      }),
    );
    expect(reviewHtml).toContain(
      'data-roof-fusion-one-card-step="object" data-roof-fusion-one-card-step-state="reachable"',
    );
    expect(reviewHtml).toContain(
      'data-roof-fusion-one-card-step="refine" data-roof-fusion-one-card-step-state="reachable"',
    );
    expect(reviewHtml).toContain(
      'data-roof-fusion-one-card-step="result" data-roof-fusion-one-card-step-state="active" disabled=""',
    );
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

  it("keeps saved skeleton strokes and endpoint markers compact at 100%, 300%, and max zoom", () => {
    const atOneX = roofFusionScreenStableMarkerRadii(
      ROOF_FUSION_SKELETON_ENDPOINT_RADIUS,
      16 / 9,
      1,
    );
    const atThreeX = roofFusionScreenStableMarkerRadii(
      ROOF_FUSION_SKELETON_ENDPOINT_RADIUS,
      16 / 9,
      3,
    );
    const atMaxZoom = roofFusionScreenStableMarkerRadii(
      ROOF_FUSION_SKELETON_ENDPOINT_RADIUS,
      16 / 9,
      MAX_ROOF_FUSION_ZOOM,
    );

    expect(atOneX.rx).toBe(0.003);
    expect(atThreeX.rx * 3).toBeCloseTo(atOneX.rx);
    expect(atThreeX.ry * 3).toBeCloseTo(atOneX.ry);
    expect(atMaxZoom.rx * MAX_ROOF_FUSION_ZOOM).toBeCloseTo(atOneX.rx);
    expect(atMaxZoom.ry * MAX_ROOF_FUSION_ZOOM).toBeCloseTo(atOneX.ry);
    expect(ROOF_FUSION_SKELETON_LINE_STROKE).toBe("1px");
    expect(ROOF_FUSION_PENDING_LINE_STROKE).toBe("1px");
    expect(ROOF_FUSION_SKELETON_ENDPOINT_CENTER_RADIUS).toBe(0.0015);
    expect(ROOF_FUSION_SKELETON_HIT_RADIUS).toBe(0.022);
    expect(ROOF_FUSION_SKELETON_HIT_STROKE).toBe("22px");
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
    expect(html).toContain('stroke-width="1px"');
    expect(html).toContain('data-roof-fusion-line-hit-target="ridge-a"');
    expect(html).toContain('stroke="transparent"');
    expect(html).toContain('stroke-width="22px"');
    expect(html).toContain('data-roof-fusion-line-endpoint="ridge-a:0"');
    expect(html).toContain(
      'data-roof-fusion-line-endpoint-hit-target="ridge-a:0"',
    );
    expect(html).toContain(
      'data-roof-fusion-line-endpoint-outline="ridge-a:0" fill="#fffdf7"',
    );
    expect(html).toContain(
      'data-roof-fusion-line-endpoint-center="ridge-a:0" fill="#e8a317"',
    );
    expect(html).toContain('rx="0.003"');
    expect(html).toContain('rx="0.0015"');
    expect(html).toContain('rx="0.022"');
    expect(html).toContain('data-roof-fusion-vertex-hit-target="0"');
    expect(html).toContain('rx="0.022"');
    expect(html).toContain('data-roof-fusion-obstacle="chimney"');
    expect(html).toContain("Trūksta patvirtinto nuolydžio");
    expect(html).toContain(
      "Paspaudus „Apskaičiuoti“ bus parodyti reikalingi sprendimai",
    );
    expect(html).toContain('data-roof-fusion-primary-action="calculate"');
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
    expect(reviewHtml).toContain("data-roof-fusion-preview-complete");
    expect(reviewHtml).toContain("Matavimo rezultatas parengtas peržiūrai");
    expect(reviewHtml).toContain("dar nenaudojamas kainodarai");
    expect(reviewHtml).not.toContain("Patvirtinti R4 matavimą");
    expect(reviewHtml).not.toContain("Pirmiausia išspręskite blokatorius");
    expect(reviewHtml).not.toContain(
      'data-roof-fusion-primary-action="review"',
    );
  });

  it("keeps save and reload controls outside the closed normal path", () => {
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
    expect(html).toContain("data-roof-fusion-advanced-trigger");
    expect(html).not.toContain('data-roof-fusion-persistence="true"');
    expect(html).not.toContain("Išsaugoti ir patvirtinti reviziją");
    expect(html).not.toContain(">Perkrauti<");
    expect(html).not.toContain("pakeitimai šiame pjūvyje dar neišsaugomi");
  });
});
