// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoofFusionWorkbenchDraftV1 } from "@/lib/roof-fusion/workbench-draft-contract-v1";
import { buildWorkbenchDraftFromUiV1 } from "@/lib/roof-fusion/workbench-ui-client-v1";
import { AdminNextRoofFusionPersistentWorkbench } from "./admin-next-roof-fusion-persistent-workbench";
import type { NorgeIBilderCaptureResult } from "./norgeibilder-capture-control";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";

const geoReference = {
  crs: "EPSG:25833" as const,
  extentTrust: "actual-visible-extent" as const,
  bounds: {
    minEastingM: 500_000,
    minNorthingM: 6_640_000,
    maxEastingM: 500_020,
    maxNorthingM: 6_640_010,
  },
  imageWidth: 1_000,
  imageHeight: 500,
};

const sourceOutline = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
] as const;

const persistedOutline = [
  { x: 0.4, y: 0.3 },
  { x: 0.6, y: 0.3 },
  { x: 0.6, y: 0.7 },
  { x: 0.4, y: 0.7 },
] as const;

const persistedLines = [
  {
    id: "saved-ridge",
    kind: "ridge" as const,
    start: { x: 0.45, y: 0.5 },
    end: { x: 0.55, y: 0.5 },
  },
] as const;

const capture: NorgeIBilderCaptureResult = {
  imageUrl: "/api/admin/media/91",
  mediaId: "91",
  sourceId: "norge-capture-91",
  rawContentHash: "a".repeat(64),
  attribution: "©norgeibilder.no",
  capturedAt: "2026-09-03T08:00:00.000Z",
  geoReference,
};

const heightSurface = {
  schemaVersion: "kartverket-height-surface.v1",
  provider: "Kartverket Nasjonal detaljert høydemodell WCS",
  coordinateSystem: "EPSG:25833",
  bbox: geoReference.bounds,
  grid: {
    width: 1,
    height: 1,
    cellWidthM: 20,
    cellHeightM: 10,
    rowOrder: "north_to_south",
  },
  values: {
    domElevationM: [110],
    dtmElevationM: [100],
    heightAboveTerrainM: [10],
  },
  quality: {
    status: "usable",
    coverageRatio: 1,
    validSamples: 1,
    totalSamples: 1,
    maxHeightAboveTerrainM: 10,
    reasons: ["Fixture"],
  },
  provenance: {
    retrievedAt: "2026-09-03T08:00:00.000Z",
    domCoverageId: "nhm_dom_topo_25833",
    dtmCoverageId: "nhm_dtm_topo_25833",
    domContentSha256: "b".repeat(64),
    dtmContentSha256: "c".repeat(64),
    resolutionM: 1,
    license: "Norsk lisens for offentlige data (NLOD) 2.0",
    attribution: "Kartverket",
  },
} satisfies KartverketHeightSurfaceV1;

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("AdminNextRoofFusionPersistentWorkbench interaction", () => {
  let root: Root;
  let container: HTMLDivElement;
  let latest: RoofFusionWorkbenchDraftV1 | null;
  let heightResponse: "error" | "blocked" | "review";

  const renderWorkbench = (
    activeCapture = capture,
    activeHeightSurface?: KartverketHeightSurfaceV1,
  ) =>
    createElement(AdminNextRoofFusionPersistentWorkbench, {
      actorId: "7",
      capture: activeCapture,
      caseId: "lead:13",
      horizontalAreaSquareMeters: 142,
      orthoImageAlt: "Test roof",
      sourceOutline,
      heightSurface: activeHeightSurface,
    });

  const stage = () =>
    container
      .querySelector("[data-roof-fusion-workbench]")
      ?.getAttribute("data-roof-fusion-stage");

  const renderedLines = () =>
    container.querySelectorAll("[data-roof-fusion-line-kind]");

  const click = async (selector: string) => {
    const button = container.querySelector<HTMLButtonElement>(selector);
    expect(button).not.toBeNull();
    await act(async () => button!.click());
  };

  const buttonWithText = (text: string) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes(text),
    );

  const dispatchCanvasPointerActivation = async (clientX: number) => {
    const canvas = container.querySelector<SVGSVGElement>(
      "[data-roof-fusion-canvas]",
    );
    expect(canvas).not.toBeNull();
    await act(async () => {
      canvas!.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX,
          clientY: 200,
          isPrimary: true,
          pointerId: 1,
        }),
      );
    });
    await act(async () => {
      canvas!.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX,
          clientY: 200,
          isPrimary: true,
          pointerId: 1,
        }),
      );
    });
  };

  const dispatchCanvasClick = async (clientX: number) => {
    const canvas = container.querySelector<SVGSVGElement>(
      "[data-roof-fusion-canvas]",
    );
    expect(canvas).not.toBeNull();
    await act(async () => {
      canvas!.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX,
          clientY: 200,
        }),
      );
    });
  };

  const activateCanvasPoint = async (clientX: number) => {
    await dispatchCanvasPointerActivation(clientX);
    await dispatchCanvasClick(clientX);
  };

  const panCanvas = async (fromX: number, toX: number) => {
    const canvas = container.querySelector<SVGSVGElement>(
      "[data-roof-fusion-canvas]",
    );
    expect(canvas).not.toBeNull();
    await act(async () => {
      canvas!.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: fromX,
          clientY: 250,
          isPrimary: true,
          pointerId: 2,
        }),
      );
    });
    await act(async () => {
      canvas!.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          button: 0,
          clientX: toX,
          clientY: 250,
          isPrimary: true,
          pointerId: 2,
        }),
      );
    });
    await act(async () => {
      canvas!.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX: toX,
          clientY: 250,
          isPrimary: true,
          pointerId: 2,
        }),
      );
    });
  };

  const captureLine = async (startX: number, endX: number) => {
    await activateCanvasPoint(startX);
    await activateCanvasPoint(endX);
  };

  beforeEach(async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    latest = await buildWorkbenchDraftFromUiV1({
      actorId: "7",
      approvedOutline: persistedOutline,
      caseId: "lead:13",
      createdAt: "2026-09-03T08:00:00.000Z",
      draftId: "uat-lead-13-r1",
      evidence: {
        attribution: capture.attribution!,
        georeference: geoReference,
        imageId: capture.mediaId,
        sourceContentHash: capture.rawContentHash!,
        sourceId: capture.sourceId!,
      },
      idempotencyKey: "workbench:lead:13:r1:test",
      lines: persistedLines,
      revision: 1,
      sourceOutline,
    });
    heightResponse = "error";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/admin/roof-fusion/workbench-draft") {
          const request = JSON.parse(String(init?.body)) as {
            draft: RoofFusionWorkbenchDraftV1;
          };
          latest = request.draft;
          return new Response(
            JSON.stringify({
              status: "applied",
              confirmation: { status: "applied" },
            }),
            { headers: { "content-type": "application/json" }, status: 200 },
          );
        }
        if (url.startsWith("/api/admin/roof-fusion/workbench-draft?")) {
          return latest
            ? new Response(JSON.stringify({ draft: latest }), {
                headers: { "content-type": "application/json" },
                status: 200,
              })
            : new Response(JSON.stringify({ code: "DRAFT_NOT_FOUND" }), {
                headers: { "content-type": "application/json" },
                status: 404,
              });
        }
        if (url === "/api/admin/roof-fusion/workbench-height-adapter") {
          return heightResponse === "error"
            ? new Response(
                JSON.stringify({
                  code: "SOURCE_INTEGRITY_INVALID",
                  error: "Šaltinių tapatybė nesutampa.",
                }),
                {
                  headers: { "content-type": "application/json" },
                  status: 422,
                },
              )
            : new Response(
                JSON.stringify({
                  status:
                    heightResponse === "blocked"
                      ? "blocked"
                      : "review_required",
                  pricingReady: false,
                  summary: {
                    blockers:
                      heightResponse === "blocked"
                        ? ["[SKELETON_DANGLING_ENDPOINT] Pataisykite kraigą."]
                        : ["Peržiūra privaloma"],
                  },
                  metrics:
                    heightResponse === "review"
                      ? { averageSlopeDegrees: 27 }
                      : {},
                }),
                {
                  headers: { "content-type": "application/json" },
                  status: 200,
                },
              );
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("hydrates approved geometry and a saved line after the latest draft loads asynchronously", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });

    expect(
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points"),
    ).toBe("0.4,0.3 0.6,0.3 0.6,0.7 0.4,0.7");

    await click('[data-roof-fusion-stage-tab="skeleton"]');
    expect(renderedLines()).toHaveLength(1);
    expect(
      renderedLines().item(0).getAttribute("data-roof-fusion-line-kind"),
    ).toBe("ridge");
  });

  it("keeps the slopes stage on calculation failure and advances only after success", async () => {
    await act(async () => {
      root.render(renderWorkbench(capture, heightSurface));
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="slopes"]');

    await act(async () => {
      buttonWithText("Apskaičiuoti nuolydžius")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("slopes");
    expect(container.textContent).toContain("Šaltinių tapatybė nesutampa");

    heightResponse = "blocked";
    await act(async () => {
      buttonWithText("Apskaičiuoti nuolydžius")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("slopes");
    expect(container.textContent).toContain("SKELETON_DANGLING_ENDPOINT");

    heightResponse = "review";
    await act(async () => {
      buttonWithText("Apskaičiuoti nuolydžius")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("review");
    expect(container.textContent).toContain("27°");
  });

  it("snaps a near valley endpoint at 100% and preserves pending on far/zero rejection", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    await click('[data-roof-fusion-line-mode="valley"]');

    const canvas = container.querySelector<SVGSVGElement>(
      "[data-roof-fusion-canvas]",
    );
    const canvasShell = container.querySelector<HTMLDivElement>(
      "[data-roof-fusion-canvas-shell]",
    );
    expect(canvas).not.toBeNull();
    expect(canvasShell).not.toBeNull();
    canvasShell!.getBoundingClientRect = () =>
      ({
        bottom: 500,
        height: 500,
        left: 0,
        right: 1_000,
        top: 0,
        width: 1_000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) satisfies DOMRect;

    const clickCanvasAt = activateCanvasPoint;

    await clickCanvasAt(388);
    expect(
      container
        .querySelector("[data-roof-fusion-pending-line-point]")
        ?.getAttribute("cx"),
    ).toBe("0.4");
    expect(container.textContent).toContain(
      "Taškas magnetiškai pritrauktas prie patvirtinto kontūro (14 px)",
    );
    await clickCanvasAt(600);
    expect(
      container.querySelector('[data-roof-fusion-line-kind="valley"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-roof-fusion-line-kind="ridge"]'),
    ).not.toBeNull();
    expect(renderedLines()).toHaveLength(2);

    await click('[data-roof-fusion-line-mode="ridge"]');
    await clickCanvasAt(10);
    expect(container.textContent).toContain("SKELETON_ENDPOINT_OUTSIDE_MASS");
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).toBeNull();
    expect(renderedLines()).toHaveLength(2);

    await clickCanvasAt(500);
    const pendingBeforeRejection = container
      .querySelector("[data-roof-fusion-pending-line-point]")
      ?.getAttribute("cx");
    await clickCanvasAt(10);
    expect(container.textContent).toContain("SKELETON_ENDPOINT_OUTSIDE_MASS");
    expect(container.textContent).toContain(
      "Patikslinkite kontūrą arba pasirinkite tašką jo viduje",
    );
    expect(
      container
        .querySelector("[data-roof-fusion-pending-line-point]")
        ?.getAttribute("cx"),
    ).toBe(pendingBeforeRejection);
    expect(renderedLines()).toHaveLength(3);

    await clickCanvasAt(500);
    expect(container.textContent).toContain("SKELETON_ZERO_LENGTH");
    expect(container.textContent).toContain(
      "Antras kraigo arba slėnio taškas turi skirtis nuo pirmojo",
    );
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).not.toBeNull();
    expect(renderedLines()).toHaveLength(3);
    expect(stage()).toBe("skeleton");
  });

  it("rehydrates on save and explicit reload without resetting skeleton stage or zoom", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    await click('[data-roof-fusion-line-mode="ridge"]');

    const canvasShell = container.querySelector<HTMLDivElement>(
      "[data-roof-fusion-canvas-shell]",
    );
    expect(canvasShell).not.toBeNull();
    canvasShell!.getBoundingClientRect = () =>
      ({
        bottom: 500,
        height: 500,
        left: 0,
        right: 1_000,
        top: 0,
        width: 1_000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) satisfies DOMRect;

    await click('[aria-label="Didinti vaizdą"]');
    await click('[aria-label="Didinti vaizdą"]');
    await click('[aria-label="Didinti vaizdą"]');
    await click('[aria-label="Didinti vaizdą"]');
    expect(container.textContent).toContain("300%");
    await panCanvas(500, 600);

    await dispatchCanvasPointerActivation(288);
    const pendingMarker = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-pending-line-point]",
    );
    expect(pendingMarker).not.toBeNull();
    expect(pendingMarker!.getAttribute("cx")).toBe("0.4");
    expect(Number(pendingMarker!.getAttribute("rx"))).toBeLessThan(0.002);
    expect(renderedLines().item(1).getAttribute("stroke-width")).toBe("2px");
    expect(container.textContent).toContain(
      "Taškas magnetiškai pritrauktas prie patvirtinto kontūro (14 px)",
    );
    await dispatchCanvasClick(288);
    expect(renderedLines()).toHaveLength(2);

    await dispatchCanvasPointerActivation(700);
    expect(renderedLines()).toHaveLength(2);
    expect(renderedLines().item(1).getAttribute("x1")).not.toBe(
      renderedLines().item(1).getAttribute("x2"),
    );
    expect(renderedLines().item(1).getAttribute("stroke-width")).toBe("3px");
    expect(
      container.querySelectorAll("[data-roof-fusion-line-endpoint]"),
    ).toHaveLength(4);
    await dispatchCanvasClick(700);
    expect(renderedLines()).toHaveLength(2);
    expect(
      Array.from(renderedLines()).some(
        (line) =>
          line.getAttribute("x1") === "0.4" ||
          line.getAttribute("x2") === "0.4",
      ),
    ).toBe(true);
    expect(stage()).toBe("skeleton");
    expect(container.textContent).toContain("Preview · neišsaugoti pakeitimai");

    const saveButton = buttonWithText("Išsaugoti ir patvirtinti reviziją");
    expect(saveButton).toBeDefined();
    expect(saveButton!.disabled).toBe(false);
    await act(async () => saveButton!.click());
    await act(async () => {
      await vi.waitFor(() =>
        expect(
          vi
            .mocked(fetch)
            .mock.calls.some(
              ([url, init]) =>
                String(url) === "/api/admin/roof-fusion/workbench-draft" &&
                init?.method === "POST",
            ),
        ).toBe(true),
      );
      await flushAsyncWork();
    });
    expect(container.textContent).toContain("CAS revizija išsaugota");
    expect(renderedLines()).toHaveLength(2);
    expect(
      Array.from(renderedLines()).some(
        (line) =>
          line.getAttribute("x1") === "0.4" ||
          line.getAttribute("x2") === "0.4",
      ),
    ).toBe(true);
    expect(stage()).toBe("skeleton");
    expect(container.textContent).toContain("300%");

    await captureLine(350, 650);
    expect(renderedLines()).toHaveLength(3);
    expect(container.textContent).toContain("Preview · neišsaugoti pakeitimai");

    await act(async () => {
      buttonWithText("Perkrauti")!.click();
      await flushAsyncWork();
    });
    expect(renderedLines()).toHaveLength(2);
    expect(
      Array.from(renderedLines()).some(
        (line) =>
          line.getAttribute("x1") === "0.4" ||
          line.getAttribute("x2") === "0.4",
      ),
    ).toBe(true);
    expect(stage()).toBe("skeleton");
    expect(container.textContent).toContain("300%");
    expect(container.textContent).toContain(
      "Preview · CAS revizija išsaugota ir reload patvirtinta",
    );

    await click('[data-roof-fusion-line-mode="valley"]');
    await captureLine(400, 600);
    expect(
      container.querySelector('[data-roof-fusion-line-kind="valley"]'),
    ).not.toBeNull();
    expect(stage()).toBe("skeleton");
    expect(container.textContent).toContain("300%");

    latest = null;
    await act(async () => {
      root.render(
        renderWorkbench({
          ...capture,
          sourceId: "norge-capture-92",
          rawContentHash: "b".repeat(64),
        }),
      );
      await flushAsyncWork();
    });
    expect(stage()).toBe("outline");
  });
});
