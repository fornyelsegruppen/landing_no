import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminNextRoofFusionUnifiedWorkbench,
  DEFAULT_ROOF_FUSION_VIEWPORT,
  DEFAULT_ROOF_FUSION_LAYERS,
  MAX_ROOF_FUSION_ZOOM,
  MIN_ROOF_FUSION_ZOOM,
  ROOF_FUSION_GEOMETRY_TOKENS,
  ROOF_FUSION_PENDING_LINE_STROKE,
  ROOF_FUSION_ONE_CARD_STEPS,
  ROOF_FUSION_SKELETON_ENDPOINT_CENTER_RADIUS,
  ROOF_FUSION_SKELETON_ENDPOINT_RADIUS,
  ROOF_FUSION_SKELETON_HIT_RADIUS,
  ROOF_FUSION_SKELETON_HIT_STROKE,
  ROOF_FUSION_SKELETON_LINE_STROKE,
  ROOF_FUSION_STAGES,
  type RoofFusionLine,
  clampRoofFusionPoint,
  clampRoofFusionViewport,
  constrainRoofFusionDraggedEndpoint,
  connectRoofFusionDanglingEndpointsToNewLine,
  fitRoofFusionViewportToOutline,
  hasRoofFusionPanGestureMoved,
  localizedRoofFusionTechnicalText,
  moveRoofFusionConnectedEndpoint,
  panRoofFusionViewport,
  roofFusionEndpointConstraintMetric,
  roofFusionDanglingEndpoints,
  roofFusionImagePointFromViewportPoint,
  roofFusionLineJunctionTargets,
  roofFusionPlaneDisplayId,
  roofFusionPlaneLabelPlacements,
  roofFusionScreenStableMarkerRadii,
  roofFusionStationaryEndpointDragLines,
  shouldHandleRoofFusionZoomWheel,
  shouldSuppressRoofFusionCanvasClick,
  snapRoofFusionSkeletonPoint,
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
  it("connects the actual Odins vei r25 ridge/valley clicks in drawing order and repairs its old draft with one drag", () => {
    const outline = [
      { x: 0.5349501180273156, y: 0.6709705910619288 },
      { x: 0.56036194370136, y: 0.5030668324509597 },
      { x: 0.5109408769629995, y: 0.47946692632177124 },
      { x: 0.5091722795847071, y: 0.4911525311332555 },
      { x: 0.4660793442743157, y: 0.4705194570100101 },
      { x: 0.4526751246022685, y: 0.5590839938396398 },
      { x: 0.4955247696476256, y: 0.5795644983433225 },
      { x: 0.48528102062778306, y: 0.6473425933781126 },
    ];
    const raw: RoofFusionLine[] = [
      {
        id: "ridge1",
        kind: "ridge",
        start: { x: 0.45894191618119184, y: 0.5176779659514785 },
        end: { x: 0.5285076215973281, y: 0.5464369444286505 },
      },
      {
        id: "ridge2",
        kind: "ridge",
        start: { x: 0.5377396721809237, y: 0.49226408132585137 },
        end: { x: 0.513678744144037, y: 0.6608516237538664 },
      },
      {
        id: "valley1",
        kind: "valley",
        start: { x: 0.5087573204580227, y: 0.4909538470014218 },
        end: { x: 0.5248951252107841, y: 0.5449435116314864 },
      },
      {
        id: "valley2",
        kind: "valley",
        start: { x: 0.5289918599715379, y: 0.5535573182178278 },
        end: { x: 0.49470353255691285, y: 0.5849982399864578 },
      },
    ];
    const metric = {
      xPixelsPerImageUnit: 891.987976,
      yPixelsPerImageUnit: 500.695618,
      maxDistancePixels: 14,
    };
    let drawn: readonly RoofFusionLine[] = [];
    for (const line of raw) {
      const captured = {
        ...line,
        start: snapRoofFusionSkeletonPoint(line.start, outline, drawn, metric)
          .point,
        end: snapRoofFusionSkeletonPoint(line.end, outline, drawn, metric)
          .point,
      };
      drawn = connectRoofFusionDanglingEndpointsToNewLine(
        drawn,
        captured,
        outline,
        metric,
      ).lines;
    }
    expect(roofFusionDanglingEndpoints(drawn, outline)).toEqual([]);
    expect(drawn).toHaveLength(4);
    expect(drawn[0].end).not.toEqual(raw[0].end);
    expect(drawn[2].end).toEqual(drawn[0].end);
    expect(drawn[3].start).toEqual(drawn[0].end);
    expect(
      roofFusionDanglingEndpoints(raw, outline).map(({ lineId, endpoint }) => ({
        lineId,
        endpoint,
      })),
    ).toEqual([{ lineId: "ridge1", endpoint: "end" }]);
    const stationaryTargets = roofFusionStationaryEndpointDragLines(
      raw,
      "ridge1",
      "end",
    );
    expect(stationaryTargets.map((line) => line.id)).not.toContain("valley1");
    const snappedDrag = snapRoofFusionSkeletonPoint(
      raw[0].end,
      outline,
      stationaryTargets,
      metric,
    );
    expect(snappedDrag.point).toEqual(raw[3].start);
    const repaired = moveRoofFusionConnectedEndpoint(
      raw,
      "ridge1",
      "end",
      snappedDrag.point,
    );
    expect(roofFusionDanglingEndpoints(repaired, outline)).toEqual([]);
  });
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

  it("fits a small roof bbox into screen space with stable padding", () => {
    const fitted = fitRoofFusionViewportToOutline(
      [
        { x: 0.42, y: 0.38 },
        { x: 0.58, y: 0.38 },
        { x: 0.58, y: 0.62 },
        { x: 0.42, y: 0.62 },
      ],
      { width: 880, height: 495 },
    );

    expect(fitted.scale).toBeGreaterThan(2);
    expect(fitted.scale).toBeLessThanOrEqual(MAX_ROOF_FUSION_ZOOM);
    expect(fitted.offsetX + 0.42 * fitted.scale).toBeGreaterThan(0.05);
    expect(fitted.offsetX + 0.58 * fitted.scale).toBeLessThan(0.95);
    expect(fitted.offsetY + 0.38 * fitted.scale).toBeGreaterThan(0.05);
    expect(fitted.offsetY + 0.62 * fitted.scale).toBeLessThan(0.95);

    const narrowFitted = fitRoofFusionViewportToOutline(
      [
        { x: 0.42, y: 0.38 },
        { x: 0.58, y: 0.38 },
        { x: 0.58, y: 0.62 },
        { x: 0.42, y: 0.62 },
      ],
      { width: 480, height: 360 },
    );
    expect(narrowFitted.offsetY + 0.38 * narrowFitted.scale).toBeGreaterThan(
      0.25,
    );
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

  it("reuses the exact ridge junction for two valleys instead of making nearby T junctions", () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const ridges = [
      {
        id: "horizontal",
        kind: "ridge" as const,
        start: { x: 0.1, y: 0.5 },
        end: { x: 0.5, y: 0.5 },
      },
      {
        id: "vertical",
        kind: "ridge" as const,
        start: { x: 0.5, y: 0.1 },
        end: { x: 0.5, y: 0.9 },
      },
    ];
    for (const scale of [1, 1.8, 3, 4]) {
      const metric = roofFusionEndpointConstraintMetric(
        { width: 480, height: 270 },
        { scale, offsetX: 0, offsetY: 0 },
      );
      const first = snapRoofFusionSkeletonPoint(
        {
          x: 0.5 - 5 / metric.xPixelsPerImageUnit,
          y: 0.5 + 4 / metric.yPixelsPerImageUnit,
        },
        outline,
        ridges,
        metric,
      );
      const second = snapRoofFusionSkeletonPoint(
        {
          x: 0.5 + 4 / metric.xPixelsPerImageUnit,
          y: 0.5 - 5 / metric.yPixelsPerImageUnit,
        },
        outline,
        [
          ...ridges,
          {
            id: "valley-1",
            kind: "valley",
            start: first.point,
            end: { x: 0.25, y: 0.9 },
          },
        ],
        metric,
      );
      expect(first).toEqual({ point: { x: 0.5, y: 0.5 }, target: "junction" });
      expect(second).toEqual(first);
    }
  });

  it("projects a diagonal ridge in displayed pixels on a wide canvas", () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const metric = {
      xPixelsPerImageUnit: 1_000,
      yPixelsPerImageUnit: 250,
      maxDistancePixels: 14,
    };
    const snap = snapRoofFusionSkeletonPoint(
      { x: 0.5, y: 0.55 },
      outline,
      [
        {
          id: "diagonal",
          kind: "ridge",
          start: { x: 0.1, y: 0.1 },
          end: { x: 0.9, y: 0.9 },
        },
      ],
      metric,
    );
    expect(snap.target).toBe("line");
    expect(snap.point.x).toBeCloseTo(0.5029411764705882);
    expect(snap.point.y).toBeCloseTo(snap.point.x);
    expect(snap.point.x).not.toBeCloseTo(0.525);
  });

  it("prioritizes the concave outline vertex over a nearby boundary projection", () => {
    const outline = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.5, y: 0.9 },
      { x: 0.5, y: 0.5 },
      { x: 0.1, y: 0.5 },
    ];
    const snapped = snapRoofFusionSkeletonPoint(
      { x: 0.504, y: 0.514 },
      outline,
      [],
      {
        xPixelsPerImageUnit: 1_000,
        yPixelsPerImageUnit: 500,
        maxDistancePixels: 14,
      },
    );
    expect(snapped).toEqual({ point: { x: 0.5, y: 0.5 }, target: "outline" });
  });

  it("moves a shared ridge/valley node together and carries branches on the edited carrier", () => {
    const lines = [
      {
        id: "ridge",
        kind: "ridge" as const,
        start: { x: 0.2, y: 0.5 },
        end: { x: 0.8, y: 0.5 },
      },
      {
        id: "branch",
        kind: "valley" as const,
        start: { x: 0.5, y: 0.5 },
        end: { x: 0.4, y: 0.8 },
      },
      {
        id: "shared",
        kind: "ridge" as const,
        start: { x: 0.8, y: 0.5 },
        end: { x: 0.8, y: 0.9 },
      },
      {
        id: "unconnected",
        kind: "valley" as const,
        start: { x: 0.5, y: 0.501 },
        end: { x: 0.6, y: 0.8 },
      },
    ];
    const moved = moveRoofFusionConnectedEndpoint(lines, "ridge", "end", {
      x: 0.8,
      y: 0.3,
    });
    expect(moved[0].end).toEqual({ x: 0.8, y: 0.3 });
    expect(moved[2].start).toEqual(moved[0].end);
    expect(moved[1].start.x).toBeCloseTo(0.5);
    expect(moved[1].start.y).toBeCloseTo(0.4);
    expect(moved[1].end).toEqual(lines[1].end);
    expect(moved[3]).toEqual(lines[3]);
    expect(lines[0].end).toEqual({ x: 0.8, y: 0.5 });
  });

  it("identifies only truly unattached endpoints, accepting exact T junctions and boundary contacts", () => {
    const outline = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];
    const lines = [
      {
        id: "ridge",
        kind: "ridge" as const,
        start: { x: 0.1, y: 0.5 },
        end: { x: 0.9, y: 0.5 },
      },
      {
        id: "valley",
        kind: "valley" as const,
        start: { x: 0.5, y: 0.5 },
        end: { x: 0.5, y: 0.9 },
      },
      {
        id: "near",
        kind: "valley" as const,
        start: { x: 0.4, y: 0.500001 },
        end: { x: 0.3, y: 0.7 },
      },
    ];
    expect(roofFusionDanglingEndpoints(lines.slice(0, 2), outline)).toEqual([]);
    expect(
      roofFusionDanglingEndpoints(lines, outline).map(
        ({ lineId, endpoint }) => ({ lineId, endpoint }),
      ),
    ).toEqual([
      { lineId: "near", endpoint: "start" },
      { lineId: "near", endpoint: "end" },
    ]);
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        sourceOutline: outline,
        lines,
        initialStage: "skeleton",
        initialLayers: { skeleton: true },
        orthoImageSrc: "/preview/roof.jpg",
      }),
    );
    expect(html).toContain('data-roof-fusion-dangling-endpoint="near:start"');
    expect(html).toContain('data-roof-fusion-dangling-endpoint="near:end"');
    expect(html).not.toContain('data-roof-fusion-dangling-endpoint="ridge:');
    expect(html).toContain("Neprijungtų galų: 2");
    expect(html).toContain("Sąlaja 2, galas 1: neprijungtas");
  });

  it("keeps reverse magnets bounded and never flattens a floating line into a duplicate carrier", () => {
    const outline = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];
    const metric = {
      xPixelsPerImageUnit: 1_000,
      yPixelsPerImageUnit: 1_000,
      maxDistancePixels: 14,
    };
    const carrier: RoofFusionLine = {
      id: "carrier",
      kind: "ridge",
      start: { x: 0.1, y: 0.5 },
      end: { x: 0.9, y: 0.5 },
    };
    const floating: RoofFusionLine = {
      id: "floating",
      kind: "valley",
      start: { x: 0.2, y: 0.49 },
      end: { x: 0.8, y: 0.49 },
    };
    const preview = connectRoofFusionDanglingEndpointsToNewLine(
      [floating],
      carrier,
      outline,
      metric,
    );
    expect(preview.attachments).toHaveLength(1);
    expect(preview.lines[0].end).toEqual(floating.end);
    expect(floating.start.y).toBe(0.49);
    const connected: RoofFusionLine = {
      id: "connected",
      kind: "ridge",
      start: { x: 0.2, y: 0.1 },
      end: floating.start,
    };
    expect(
      connectRoofFusionDanglingEndpointsToNewLine(
        [floating, connected],
        carrier,
        outline,
        metric,
      ).attachments.every(
        (attachment) => !samePointForTest(attachment.from, floating.start),
      ),
    ).toBe(true);
    const far: RoofFusionLine = {
      ...floating,
      start: { x: 0.2, y: 0.45 },
      end: { x: 0.8, y: 0.45 },
    };
    expect(
      connectRoofFusionDanglingEndpointsToNewLine(
        [far],
        carrier,
        outline,
        metric,
      ).attachments,
    ).toEqual([]);
    function samePointForTest(
      first: { x: number; y: number },
      second: { x: number; y: number },
    ) {
      return first.x === second.x && first.y === second.y;
    }
  });

  it("recomputes branches at the intersection of two carriers when one carrier endpoint moves", () => {
    const outline = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];
    const lines: RoofFusionLine[] = [
      {
        id: "horizontal",
        kind: "ridge",
        start: { x: 0.1, y: 0.5 },
        end: { x: 0.9, y: 0.5 },
      },
      {
        id: "vertical",
        kind: "ridge",
        start: { x: 0.5, y: 0.1 },
        end: { x: 0.5, y: 0.9 },
      },
      {
        id: "valley-a",
        kind: "valley",
        start: { x: 0.5, y: 0.5 },
        end: { x: 0.9, y: 0.9 },
      },
      {
        id: "valley-b",
        kind: "valley",
        start: { x: 0.5, y: 0.5 },
        end: { x: 0.1, y: 0.9 },
      },
    ];
    const moved = moveRoofFusionConnectedEndpoint(lines, "horizontal", "end", {
      x: 0.9,
      y: 0.3,
    });
    expect(moved[2].start.x).toBeCloseTo(0.5);
    expect(moved[2].start.y).toBeCloseTo(0.4);
    expect(moved[3].start).toEqual(moved[2].start);
    expect(moved[1]).toEqual(lines[1]);
    expect(roofFusionDanglingEndpoints(moved, outline)).toEqual([]);
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
      'data-roof-fusion-one-card-step="refine" data-roof-fusion-one-card-step-state="active"',
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
      'data-roof-fusion-one-card-step="result" data-roof-fusion-one-card-step-state="active"',
    );
  });

  it("localizes adapter blocker prose and never exposes unknown English reasons", () => {
    expect(
      localizedWorkbenchHeightBlocker(
        "[SKELETON_DANGLING_ENDPOINT] Endpoint is not attached.",
      ),
    ).toContain("Kraigo arba sąlajos galas nesujungtas");
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
    expect(ROOF_FUSION_SKELETON_LINE_STROKE).toBe("2px");
    expect(ROOF_FUSION_PENDING_LINE_STROKE).toBe("2px");
    expect(ROOF_FUSION_SKELETON_ENDPOINT_CENTER_RADIUS).toBe(0.0015);
    expect(ROOF_FUSION_SKELETON_HIT_RADIUS).toBe(0.022);
    expect(ROOF_FUSION_SKELETON_HIT_STROKE).toBe("22px");
  });

  it("reflows all skeleton actions without horizontal scrolling at a 1280x720 CSS viewport", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        initialStage: "skeleton",
        lines: [
          {
            id: "ridge-a",
            kind: "ridge",
            start: { x: 0.3, y: 0.5 },
            end: { x: 0.7, y: 0.5 },
          },
        ],
        orthoImageHeight: 720,
        orthoImageSrc: "/preview/house-ortho.jpg",
        orthoImageWidth: 1280,
        sourceOutline,
      }),
    );

    const canvasIndex = html.indexOf("data-roof-fusion-canvas-shell");
    const toolbarIndex = html.indexOf(
      'data-roof-fusion-skeleton-toolbar="canvas-overlay"',
    );
    expect(canvasIndex).toBeGreaterThan(-1);
    expect(toolbarIndex).toBeGreaterThan(canvasIndex);
    expect(html).toContain("absolute top-2 right-2 left-2");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("sm:grid-cols-4");
    expect(html).toContain("min-h-11 min-w-0");
    expect(html).toContain("Atšaukti paskutinę");
    expect(html).toContain("Perbraižyti linijas");
    expect(html).toContain(
      'aria-label="Perbraižyti visas kraigų ir sąlajų linijas"',
    );
    expect(html.match(/data-roof-fusion-undo-last-line/g)).toHaveLength(1);
    expect(html).toContain('data-roof-fusion-responsive-layout="refine"');
    expect(html).toContain("md:flex-row");
    expect(html).toContain("md:w-[300px]");
  });

  it("keeps the narrow toolbar keyboard reachable in two rows with 44px actions", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        initialStage: "skeleton",
        lines: [
          {
            id: "ridge-a",
            kind: "ridge",
            start: { x: 0.3, y: 0.5 },
            end: { x: 0.7, y: 0.5 },
          },
        ],
        orthoImageHeight: 720,
        orthoImageSrc: "/preview/house-ortho.jpg",
        orthoImageWidth: 960,
        sourceOutline,
      }),
    );

    expect(html).toContain('aria-label="Kraigų ir sąlajų žymėjimo įrankiai"');
    expect(html).toContain("grid grid-cols-2");
    expect(html).not.toContain("overflow-x");
    expect(html.match(/min-h-11 min-w-0/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Žymėti kraigą"');
    expect(html).toContain('aria-label="Žymėti sąlają"');
    expect(html).toContain("title=");
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
          {
            id: "valley-a",
            kind: "valley",
            start: { x: 0.3, y: 0.4 },
            end: { x: 0.7, y: 0.6 },
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
    expect(html).toContain('stroke-width="2px"');
    expect(html).toContain('data-roof-fusion-line-hit-target="ridge-a"');
    expect(html).toContain('stroke="transparent"');
    expect(html).toContain('stroke-width="22px"');
    expect(html).toContain('data-roof-fusion-line-endpoint="ridge-a:0"');
    expect(html).toContain(
      'data-roof-fusion-line-endpoint-hit-target="ridge-a:0"',
    );
    expect(html).toContain(
      `data-roof-fusion-line-endpoint-outline="ridge-a:0" fill="${ROOF_FUSION_GEOMETRY_TOKENS.ridge}"`,
    );
    expect(html).toContain(
      'data-roof-fusion-line-endpoint-center="ridge-a:0" fill="#fffdf7"',
    );
    expect(html).toContain('data-roof-fusion-line-kind="valley"');
    expect(html).toContain('stroke-dasharray="6px 5px"');
    expect(html).toContain("data-roof-fusion-geometry-legend");
    expect(html).not.toContain('stroke="#07101d"');
    expect(html).not.toContain('stroke="#0b111a"');
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

  it("renders a compact responsive result with stable accessible plane keys and localized details", () => {
    const planes = [
      {
        id: "surface-a",
        displayId: "A",
        label: "Šiaurės rytų šlaitas",
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.55, y: 0.2 },
          { x: 0.5, y: 0.7 },
        ],
        areaSquareMeters: 51.3,
        slopeDegrees: 27,
      },
      {
        id: "surface-b",
        displayId: "B",
        label: "Pietvakarių šlaitas",
        points: [
          { x: 0.45, y: 0.2 },
          { x: 0.8, y: 0.2 },
          { x: 0.5, y: 0.7 },
        ],
        areaSquareMeters: 49.8,
        slopeDegrees: 31,
      },
    ];
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUnifiedWorkbench, {
        averageSlopeDegrees: 29,
        confidenceReason:
          "Areas and pitches are preliminary because the shared topology requires human review.",
        footprintPerimeterMeters: 42.1,
        initialLayers: { roofPlanes: true },
        initialStage: "review",
        orthoImageHeight: 500,
        orthoImageSrc: "/preview/house-ortho.jpg",
        orthoImageWidth: 1000,
        resultIdentity: {
          draftHash: "a".repeat(64),
          measurementMethod: "manual_workbench",
          revision: 4,
          snapshotHash: "b".repeat(64),
          snapshotId: "snapshot-4",
        },
        resultState: "current",
        reviewStatus: "review_required",
        roofPlanes: planes,
        sourceOutline,
        horizontalAreaSquareMeters: 87.1,
        preliminaryHorizontalAreaSquareMeters: 86.7,
        totalSurfaceAreaSquareMeters: 101.1,
      }),
    );

    expect(html).toContain("xl:sticky");
    expect(html).toContain("grid-cols-2");
    expect(html).toContain('data-roof-fusion-horizontal-result="true"');
    expect(html).toContain("Horizontalus plotas");
    expect(html).toContain("87,1 m²");
    expect(html).toContain("nuo OSM preliminaraus +0,4 m²");
    expect(html).toContain("data-roof-fusion-area-provenance");
    expect(html).toContain("kanoninės EPSG:25833");
    expect(html).toContain("OSM preliminarus kontūras buvo 86,7 m²");
    expect(html).toContain('data-roof-fusion-plane-label="surface-a"');
    expect(html).toContain("A · 51,3 m²");
    expect(html).toContain("A · Šiaurės rytų šlaitas");
    expect(html).toContain('aria-label="A · Šiaurės rytų šlaitas"');
    expect(html).toContain('stroke-width="22px"');
    expect(html).toContain('data-roof-fusion-roof-plane-outer="surface-a"');
    expect(html).toContain('data-roof-fusion-roof-plane-inner="surface-a"');
    expect(html).toContain("Matavimo informacija");
    expect(html).toContain("Rankinis RF žymėjimas");
    expect(html).toContain("Plotai ir nuolydžiai yra preliminarūs");
    expect(html).not.toContain("Areas and pitches are preliminary");
    expect(html).toContain("Perkėlimas į pasiūlymą dar neįjungtas");
    expect(html).toContain("data-roof-fusion-offer-transfer-boundary");
    expect(roofFusionPlaneDisplayId(0)).toBe("A");
    expect(roofFusionPlaneDisplayId(25)).toBe("Z");
    expect(roofFusionPlaneDisplayId(26)).toBe("AA");
    const placements = roofFusionPlaneLabelPlacements(planes, 1);
    expect(placements.get("surface-a")).not.toEqual(
      placements.get("surface-b"),
    );
    expect(
      localizedRoofFusionTechnicalText(
        "Areas and pitches are preliminary because they derive from fitted planes.",
      ),
    ).not.toMatch(/Areas|pitches/u);
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
        resultState: "current",
        reviewStatus: "review_required",
        sourceOutline,
        stageBlockers: { review: ["Preview išsaugojimas dar neįjungtas"] },
      }),
    );

    expect(outlineHtml).not.toContain("Preview išsaugojimas dar neįjungtas");
    expect(reviewHtml).toContain("Preview išsaugojimas dar neįjungtas");
    expect(reviewHtml).toContain("data-roof-fusion-preview-complete");
    expect(reviewHtml).toContain("Parengta rankinei peržiūrai");
    expect(reviewHtml).toContain("Rezultatas nėra perduotas kainodarai");
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

    expect(html).toContain('data-roof-fusion-restored-draft-gate="loading"');
    expect(html).not.toContain('data-roof-fusion-workbench="unified"');
    expect(html).not.toContain('data-roof-fusion-persistence="true"');
    expect(html).not.toContain("Išsaugoti ir patvirtinti reviziją");
    expect(html).not.toContain(">Perkrauti<");
    expect(html).not.toContain("pakeitimai šiame pjūvyje dar neišsaugomi");
  });
});
