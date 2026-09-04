// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoofFusionWorkbenchDraftV1 } from "@/lib/roof-fusion/workbench-draft-contract-v1";
import { buildWorkbenchDraftFromUiV1 } from "@/lib/roof-fusion/workbench-ui-client-v1";
import {
  AdminNextRoofFusionPersistentWorkbench,
  roofFusionDetailedResultPlanes,
} from "./admin-next-roof-fusion-persistent-workbench";
import type { RoofFusionPoint } from "./admin-next-roof-fusion-unified-workbench";
import type { NorgeIBilderCaptureResult } from "./norgeibilder-capture-control";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import { buildApprovedGableRoofFixtureV1 } from "@/lib/roof-fusion/gable-roof-fixture-v1";
import { projectRoofFusionWorkbenchDetailedResultV1 } from "@/lib/roof-fusion/workbench-detailed-result-v1";

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

function detailedResultFixture() {
  const result = projectRoofFusionWorkbenchDetailedResultV1(
    buildApprovedGableRoofFixtureV1().approvedSnapshot,
  );
  return {
    ...result,
    vertices: result.vertices.map((vertex) => ({
      ...vertex,
      xM: vertex.xM + 500_005,
      yM: vertex.yM + 6_640_001,
    })),
  };
}

let autoResumeRestoredDraft = true;

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const resume = document.querySelector<HTMLButtonElement>(
    "[data-roof-fusion-resume-restored-draft]",
  );
  if (autoResumeRestoredDraft && resume) {
    resume.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("AdminNextRoofFusionPersistentWorkbench interaction", () => {
  let root: Root;
  let container: HTMLDivElement;
  let latest: RoofFusionWorkbenchDraftV1 | null;
  let heightResponse: "error" | "blocked" | "review";
  let deferHeightResponse: boolean;
  let releaseHeightResponse: (() => void) | null;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  const renderWorkbench = (
    activeCapture = capture,
    activeHeightSurface?: KartverketHeightSurfaceV1,
    activeSourceFootprintId?: string,
    activeSourceOutline: readonly RoofFusionPoint[] = sourceOutline,
    preliminaryHorizontalAreaSquareMeters = 142,
  ) =>
    createElement(AdminNextRoofFusionPersistentWorkbench, {
      actorId: "7",
      capture: activeCapture,
      caseId: "lead:13",
      horizontalAreaSquareMeters: preliminaryHorizontalAreaSquareMeters,
      orthoImageAlt: "Test roof",
      sourceOutline: activeSourceOutline,
      sourceFootprintId: activeSourceFootprintId,
      heightSurface: activeHeightSurface,
    });

  const useLegacyCaptureAliasDraft = async () => {
    latest = await buildWorkbenchDraftFromUiV1({
      actorId: "7",
      approvedOutline: persistedOutline,
      caseId: "lead:13",
      createdAt: "2026-09-03T08:00:00.000Z",
      draftId: "uat-lead-13-r1-legacy-alias",
      evidence: {
        attribution: capture.attribution!,
        georeference: geoReference,
        imageId: capture.mediaId,
        sourceContentHash: capture.rawContentHash!,
        sourceId: capture.sourceId!,
      },
      idempotencyKey: "workbench:lead:13:r1:legacy-alias",
      lines: persistedLines,
      revision: 1,
      sourceFootprintId: capture.sourceId!,
      sourceOutline,
    });
  };

  const stage = () =>
    container
      .querySelector("[data-roof-fusion-workbench]")
      ?.getAttribute("data-roof-fusion-stage");

  const renderedLines = () =>
    container.querySelectorAll("[data-roof-fusion-line-kind]");

  const click = async (selector: string) => {
    let button = container.querySelector<HTMLButtonElement>(selector);
    const resume = container.querySelector<HTMLButtonElement>(
      "[data-roof-fusion-resume-restored-draft]",
    );
    if (!button && autoResumeRestoredDraft && resume) {
      await act(async () => resume.click());
      button = container.querySelector<HTMLButtonElement>(selector);
    }
    expect(button).not.toBeNull();
    await act(async () => button!.click());
  };

  const buttonWithText = (text: string) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes(text),
    );

  const openAdvanced = async () => {
    if (container.querySelector("[data-roof-fusion-advanced]")) return;
    await click("[data-roof-fusion-advanced-trigger]");
  };

  const closeAdvanced = async () => {
    if (!container.querySelector("[data-roof-fusion-advanced]")) return;
    await click("[data-roof-fusion-advanced-close]");
  };

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
    autoResumeRestoredDraft = true;
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
    deferHeightResponse = false;
    releaseHeightResponse = null;
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
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
          if (deferHeightResponse) {
            await new Promise<void>((resolve) => {
              releaseHeightResponse = resolve;
            });
          }
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
                  draftHash: latest?.draftHash,
                  status:
                    heightResponse === "blocked"
                      ? "blocked"
                      : "review_required",
                  pricingReady: false,
                  summary: {
                    blockers:
                      heightResponse === "blocked"
                        ? [
                            "[SKELETON_DANGLING_ENDPOINT] Endpoint is not attached to the boundary.",
                          ]
                        : [
                            "Manual ridge, valley, hip, and eave hints were used for explicit plane subdivision.",
                          ],
                  },
                  metrics:
                    heightResponse === "review"
                      ? {
                          averageSlopeDegrees: 27,
                          footprintPerimeterMeters: 41,
                          horizontalAreaSquareMeters: 87.1,
                          totalSurfaceAreaSquareMeters: 95.6,
                        }
                      : {},
                  detailedResult:
                    heightResponse === "review"
                      ? detailedResultFixture()
                      : undefined,
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
    delete (HTMLElement.prototype as { scrollIntoView?: unknown })
      .scrollIntoView;
  });

  it("keeps A/B plane labels stable when the adapter surface order changes", () => {
    const detailed = detailedResultFixture();
    const ordered = roofFusionDetailedResultPlanes(detailed, geoReference);
    const reversed = roofFusionDetailedResultPlanes(
      { ...detailed, surfaces: [...detailed.surfaces].reverse() },
      geoReference,
    );
    expect(
      Object.fromEntries(ordered.map((plane) => [plane.id, plane.displayId])),
    ).toEqual(
      Object.fromEntries(reversed.map((plane) => [plane.id, plane.displayId])),
    );
    expect(ordered.map((plane) => plane.displayId)).toEqual(["A", "B"]);
  });

  it("shows the canonical 87.1 m² result with compact OSM provenance and sends bound calculation evidence", async () => {
    heightResponse = "review";
    latest = await buildWorkbenchDraftFromUiV1({
      actorId: "7",
      approvedOutline: persistedOutline,
      caseId: "lead:13",
      createdAt: "2026-09-03T08:00:00.000Z",
      draftId: "uat-lead-13-r1-area-provenance",
      evidence: {
        attribution: capture.attribution!,
        georeference: geoReference,
        imageId: capture.mediaId,
        sourceContentHash: capture.rawContentHash!,
        sourceId: capture.sourceId!,
      },
      idempotencyKey: "workbench:lead:13:r1:area-provenance",
      lines: persistedLines,
      revision: 1,
      sourceFootprintId: "osm:way/123",
      sourceOutline,
    });
    await act(async () => {
      root.render(
        renderWorkbench(
          capture,
          heightSurface,
          "osm:way/123",
          sourceOutline,
          86.7,
        ),
      );
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("review");
    expect(container.textContent).toContain("Horizontalus plotas");
    expect(container.textContent).toContain("87,1 m²");
    expect(container.textContent).toContain("nuo OSM preliminaraus +0,4 m²");
    expect(container.textContent).not.toContain("86,7 m²87,1 m²");
    const heightCall = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url]) =>
          String(url) === "/api/admin/roof-fusion/workbench-height-adapter",
      );
    const heightBody = JSON.parse(String(heightCall?.[1]?.body)) as {
      draftHash: string;
      orthophoto: { rawContentHash: string; sourceId: string };
    };
    expect(latest?.geometry.sourceFootprint.sourceId).toBe("osm:way/123");
    expect(heightBody.draftHash).toBe(latest?.draftHash);
    expect(heightBody.orthophoto).toMatchObject({
      rawContentHash: capture.rawContentHash,
      sourceId: capture.sourceId,
    });
  });

  it("hides the previous candidate's canonical result as soon as another footprint is selected", async () => {
    heightResponse = "review";
    latest = await buildWorkbenchDraftFromUiV1({
      actorId: "7",
      approvedOutline: persistedOutline,
      caseId: "lead:13",
      createdAt: "2026-09-03T08:00:00.000Z",
      draftId: "uat-lead-13-r1-building-a-result",
      evidence: {
        attribution: capture.attribution!,
        georeference: geoReference,
        imageId: capture.mediaId,
        sourceContentHash: capture.rawContentHash!,
        sourceId: capture.sourceId!,
      },
      idempotencyKey: "workbench:lead:13:r1:building-a-result",
      lines: persistedLines,
      revision: 1,
      sourceFootprintId: "osm:A",
      sourceOutline,
    });
    await act(async () => {
      root.render(
        renderWorkbench(capture, heightSurface, "osm:A", sourceOutline, 86.7),
      );
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });
    expect(stage()).toBe("review");
    expect(container.textContent).toContain("87,1 m²");

    const buildingBOutline = [
      { x: 0.15, y: 0.15 },
      { x: 0.85, y: 0.15 },
      { x: 0.85, y: 0.85 },
      { x: 0.15, y: 0.85 },
    ] as const;
    await act(async () => {
      root.render(
        renderWorkbench(capture, heightSurface, "osm:B", buildingBOutline, 42),
      );
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="outline"]');

    expect(stage()).toBe("outline");
    expect(container.textContent).not.toContain("87,1 m²");
    expect(
      container.querySelectorAll("[data-roof-fusion-plane-label]"),
    ).toHaveLength(0);
    await openAdvanced();
    expect(container.textContent).toContain("stogo kontūro tapatybė nesutampa");
  });

  it("focuses and scrolls after explicit calculate and step navigation while preserving zoom and marking", async () => {
    heightResponse = "review";
    await act(async () => {
      root.render(renderWorkbench(capture, heightSurface));
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    await click('[aria-label="Didinti vaizdą"]');
    await click('[aria-label="Didinti vaizdą"]');
    await click('[aria-label="Didinti vaizdą"]');
    await click('[aria-label="Didinti vaizdą"]');
    expect(container.textContent).toContain("300%");
    scrollIntoViewMock.mockClear();

    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });
    expect(stage()).toBe("review");
    expect(
      container.querySelector("[data-roof-fusion-active-anchor='result']"),
    ).toBe(document.activeElement);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });

    scrollIntoViewMock.mockClear();
    await click('[data-roof-fusion-one-card-step="result"]');
    expect(document.activeElement).toBe(
      container.querySelector("[data-roof-fusion-active-heading]"),
    );
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
    scrollIntoViewMock.mockClear();

    await click("[data-roof-fusion-edit-result]");
    expect(stage()).toBe("skeleton");
    expect(
      container.querySelector("[data-roof-fusion-active-anchor='editor']"),
    ).toBe(document.activeElement);
    expect(container.textContent).toContain("300%");
    expect(renderedLines()).toHaveLength(1);
    expect(document.activeElement).toBe(
      container.querySelector("[data-roof-fusion-active-heading]"),
    );
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });

    scrollIntoViewMock.mockClear();
    await click('[data-roof-fusion-one-card-step="refine"]');
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(
      container
        .querySelector("[data-roof-fusion-active-heading]")
        ?.classList.contains("scroll-mt-36"),
    ).toBe(true);
  });

  it("blocks editing until the operator resumes the exact restored draft identity", async () => {
    autoResumeRestoredDraft = false;
    const restoredIdentity = latest
      ? { draftId: latest.draftId, draftHash: latest.draftHash }
      : null;
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });

    expect(
      container.querySelector("[data-roof-fusion-restored-draft-prompt]"),
    ).not.toBeNull();
    expect(container.textContent).toContain("Tęsti ankstesnį matavimą");
    expect(container.textContent).toContain("Pradėti naują matavimą");
    expect(container.textContent).toContain("kraigų: 1 · sąlajų: 0");
    expect(container.querySelector("[data-roof-fusion-canvas]")).toBeNull();

    scrollIntoViewMock.mockClear();
    await click("[data-roof-fusion-resume-restored-draft]");
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
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
    expect(
      container.querySelector("[data-roof-fusion-restored-draft-prompt]"),
    ).toBeNull();
    expect(renderedLines()).toHaveLength(1);
    expect(latest).toMatchObject(restoredIdentity!);
    expect(container.textContent).toContain(
      "Preview · revizija išsaugota ir pakartotinai patvirtinta",
    );
  });

  it("ignores a late draft response after the active footprint load changes", async () => {
    autoResumeRestoredDraft = false;
    const olderDraft = latest!;
    const newerDraft = await buildWorkbenchDraftFromUiV1({
      actorId: "7",
      approvedOutline: sourceOutline,
      caseId: "lead:13",
      createdAt: "2026-09-04T09:00:00.000Z",
      draftId: "uat-lead-13-r2-building-b",
      evidence: {
        attribution: capture.attribution!,
        georeference: geoReference,
        imageId: capture.mediaId,
        sourceContentHash: capture.rawContentHash!,
        sourceId: capture.sourceId!,
      },
      idempotencyKey: "workbench:lead:13:r2:building-b",
      lines: [],
      revision: 2,
      sourceFootprintId: "osm:B",
      sourceOutline,
      supersedes: {
        draftId: olderDraft.draftId,
        revision: olderDraft.revision,
        draftHash: olderDraft.draftHash,
        state: olderDraft.state,
      },
    });
    let resolveOlder: ((response: Response) => void) | undefined;
    let loadCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (
          !String(input).startsWith("/api/admin/roof-fusion/workbench-draft?")
        ) {
          throw new Error(`Unexpected request: ${String(input)}`);
        }
        loadCount += 1;
        if (loadCount === 1) {
          return await new Promise<Response>((resolve) => {
            resolveOlder = resolve;
          });
        }
        return new Response(JSON.stringify({ draft: newerDraft }), {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      }),
    );

    await act(async () => {
      root.render(renderWorkbench(capture, undefined, "osm:A"));
      await Promise.resolve();
    });
    await act(async () => {
      root.render(renderWorkbench(capture, undefined, "osm:B"));
      await flushAsyncWork();
    });
    expect(container.textContent).toContain("r2 · kraigų: 0");

    await act(async () => {
      resolveOlder?.(
        new Response(JSON.stringify({ draft: olderDraft }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      );
      await flushAsyncWork();
    });
    expect(container.textContent).toContain("r2 · kraigų: 0");
    expect(container.textContent).not.toContain("r1 · kraigų: 1");
  });

  it("starts a new identity without old lines or another capture and reloads deterministically", async () => {
    autoResumeRestoredDraft = false;
    const previousDraft = latest!;
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });

    await click("[data-roof-fusion-start-new-draft]");
    expect(renderedLines()).toHaveLength(0);
    expect(
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points"),
    ).toBe("0.1,0.1 0.9,0.1 0.9,0.9 0.1,0.9");
    expect(latest?.geometry.skeletonEdges).toHaveLength(1);
    expect(container.textContent).toContain(
      "ankstesnė r1 išsaugota istorijoje",
    );
    expect(container.textContent).toContain("Preview · naujas matavimas");

    await openAdvanced();
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      false,
    );
    await act(async () => {
      buttonWithText("Išsaugoti ir patvirtinti reviziją")!.click();
      await flushAsyncWork();
    });
    await vi.waitFor(() => expect(latest?.revision).toBe(2));
    expect(latest).toMatchObject({
      revision: 2,
      supersedesDraftId: previousDraft.draftId,
      geometry: { skeletonEdges: [] },
    });
    expect(latest?.draftId).not.toBe(previousDraft.draftId);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) => String(url).includes("norgeibilder")),
    ).toBe(false);

    await act(async () => {
      buttonWithText("Perkrauti")!.click();
      await flushAsyncWork();
    });
    expect(
      container.querySelector("[data-roof-fusion-restored-draft-prompt]"),
    ).toBeNull();
    expect(renderedLines()).toHaveLength(0);
    expect(container.textContent).toContain(
      "Preview · revizija išsaugota ir pakartotinai patvirtinta",
    );
  });

  it("auto-fits the selected roof once and preserves manual zoom across draft hydration", async () => {
    const originalBounds = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute("data-roof-fusion-canvas-shell")) {
        return {
          bottom: 495,
          height: 495,
          left: 0,
          right: 880,
          top: 0,
          width: 880,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } satisfies DOMRect;
      }
      return originalBounds.call(this);
    };
    try {
      const compactSourceOutline = [
        { x: 0.4, y: 0.35 },
        { x: 0.6, y: 0.35 },
        { x: 0.6, y: 0.65 },
        { x: 0.4, y: 0.65 },
      ] as const;
      await act(async () => {
        root.render(
          renderWorkbench(capture, undefined, undefined, compactSourceOutline),
        );
        await flushAsyncWork();
      });
      await click('[data-roof-fusion-stage-tab="outline"]');
      const zoomPercent = () =>
        Number.parseInt(
          container
            .querySelector("[data-roof-fusion-zoom-percent]")
            ?.textContent?.replace("%", "") ?? "0",
          10,
        );
      const fittedZoom = zoomPercent();
      expect(fittedZoom).toBeGreaterThan(100);

      await click('[aria-label="Didinti vaizdą"]');
      const manualZoom = zoomPercent();
      expect(manualZoom).toBeGreaterThan(fittedZoom);

      await openAdvanced();
      await act(async () => {
        buttonWithText("Perkrauti")!.click();
        await flushAsyncWork();
      });
      expect(zoomPercent()).toBe(manualZoom);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalBounds;
    }
  });

  it("rolls a touch endpoint drag back on pointercancel without dirtying the confirmed revision", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="skeleton"]');
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

    const ridge = () =>
      container.querySelector<SVGLineElement>(
        '[data-roof-fusion-line-kind="ridge"]',
      );
    const endpoint = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-line-endpoint-hit-target]",
    );
    expect(endpoint).not.toBeNull();
    expect(ridge()?.getAttribute("x1")).toBe("0.45");
    expect(container.textContent).toContain(
      "Preview · revizija išsaugota ir pakartotinai patvirtinta",
    );

    await act(async () => {
      endpoint!.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 350,
          clientY: 250,
          isPrimary: true,
          pointerId: 40,
          pointerType: "touch",
        }),
      );
      endpoint!.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          button: 0,
          clientX: 0,
          clientY: 250,
          isPrimary: true,
          pointerId: 40,
          pointerType: "touch",
        }),
      );
    });

    expect(ridge()?.getAttribute("x1")).toBe("0.4");
    expect(container.textContent).toContain(
      "Preview · revizija išsaugota ir pakartotinai patvirtinta",
    );
    const movedEndpoint = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-line-endpoint-hit-target]",
    );
    await act(async () => {
      movedEndpoint!.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          button: 0,
          clientX: 0,
          clientY: 250,
          isPrimary: true,
          pointerId: 40,
          pointerType: "touch",
        }),
      );
    });

    expect(ridge()?.getAttribute("x1")).toBe("0.45");
    expect(container.textContent).toContain(
      "Linijos galinio taško keitimas atšauktas",
    );
    expect(container.textContent).toContain(
      "Preview · revizija išsaugota ir pakartotinai patvirtinta",
    );
    expect(latest?.geometry.skeletonEdges).toHaveLength(1);
  });

  it("commits a fenced touch endpoint drag only on pointerup", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="skeleton"]');
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

    const endpoint = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-line-endpoint-hit-target]",
    );
    const ridge = () =>
      container.querySelector<SVGLineElement>(
        '[data-roof-fusion-line-kind="ridge"]',
      );
    expect(endpoint).not.toBeNull();
    expect(ridge()?.getAttribute("x1")).toBe("0.45");
    await act(async () => {
      endpoint!.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 350,
          clientY: 250,
          isPrimary: true,
          pointerId: 41,
          pointerType: "touch",
        }),
      );
      endpoint!.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          button: 0,
          clientX: 0,
          clientY: 250,
          isPrimary: true,
          pointerId: 41,
          pointerType: "touch",
        }),
      );
    });

    expect(ridge()?.getAttribute("x1")).toBe("0.4");
    expect(latest?.geometry.skeletonEdges).toHaveLength(1);
    expect(container.textContent).toContain(
      "Preview · revizija išsaugota ir pakartotinai patvirtinta",
    );
    const movedEndpoint = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-line-endpoint-hit-target]",
    );
    await act(async () => {
      movedEndpoint!.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX: 0,
          clientY: 250,
          isPrimary: true,
          pointerId: 41,
          pointerType: "touch",
        }),
      );
    });
    expect(ridge()?.getAttribute("x1")).toBe("0.4");
    expect(container.textContent).toContain(
      "Linijos galinis taškas patikslintas",
    );
    expect(container.textContent).toContain("Preview · neišsaugoti pakeitimai");
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).toBeNull();
  });

  it("carries persisted annotations across a same-footprint capture refresh", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="outline"]');
    const fetchMock = vi.mocked(fetch);
    const draftLoadCount = () =>
      fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/api/admin/roof-fusion/workbench-draft?"),
      ).length;
    expect(draftLoadCount()).toBe(1);
    const approvedOutline = () =>
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points");
    const persistedPoints = approvedOutline();
    const firstVertex = container.querySelector<SVGGElement>(
      '[data-roof-fusion-vertex="0"]',
    );
    expect(firstVertex).not.toBeNull();
    await act(async () => {
      firstVertex!.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
      );
    });
    const dirtyPoints = approvedOutline();
    expect(dirtyPoints).not.toBe(persistedPoints);
    const refreshedCapture = {
      ...capture,
      sourceId: "norge-capture-92",
      rawContentHash: "d".repeat(64),
      capturedAt: "2026-09-04T00:05:00.000Z",
    };

    await act(async () => {
      root.render(renderWorkbench(refreshedCapture, heightSurface));
      await flushAsyncWork();
    });
    expect(draftLoadCount()).toBe(1);
    expect(approvedOutline()).toBe(dirtyPoints);
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    await openAdvanced();

    expect(renderedLines()).toHaveLength(1);
    expect(
      container.querySelector<HTMLButtonElement>(
        "[data-roof-fusion-undo-last-line]",
      )?.disabled,
    ).toBe(false);
    expect(container.textContent).toContain(
      "Ankstesnės rankinės anotacijos perkeltos",
    );
    expect(container.textContent).toContain("Preview · neišsaugoti pakeitimai");

    await act(async () => {
      buttonWithText("Išsaugoti ir patvirtinti reviziją")!.click();
      await vi.waitFor(() => expect(latest?.revision).toBe(2));
      await flushAsyncWork();
    });

    expect(latest?.revision).toBe(2);
    expect(latest?.source.sourceId).toBe(refreshedCapture.sourceId);
    expect(latest?.geometry.skeletonEdges).toHaveLength(1);
    expect(stage()).toBe("skeleton");
  });

  it("blocks a mismatched capture from clearing annotations until explicit confirmation", async () => {
    const mismatchedCapture = {
      ...capture,
      sourceId: "norge-capture-other",
      rawContentHash: "e".repeat(64),
      geoReference: {
        ...geoReference,
        bounds: {
          ...geoReference.bounds,
          minEastingM: geoReference.bounds.minEastingM + 100,
          maxEastingM: geoReference.bounds.maxEastingM + 100,
        },
      },
    };
    await act(async () => {
      root.render(renderWorkbench(mismatchedCapture, heightSurface));
      await flushAsyncWork();
    });
    await openAdvanced();

    expect(container.textContent).toContain("Rankinės anotacijos neišvalytos");
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      true,
    );
    expect(
      container.querySelector("[data-roof-fusion-confirm-source-reset]"),
    ).not.toBeNull();
    expect(latest?.revision).toBe(1);

    await click("[data-roof-fusion-confirm-source-reset]");

    expect(container.textContent).toContain(
      "ankstesnės rankinės anotacijos pašalintos tik iš naujos neišsaugotos geometrijos",
    );
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      false,
    );
    expect(latest?.revision).toBe(1);
  });

  it("does not hydrate another building's explicitly identified geometry from the same address capture", async () => {
    latest = await buildWorkbenchDraftFromUiV1({
      actorId: "7",
      approvedOutline: persistedOutline,
      caseId: "lead:13",
      createdAt: "2026-09-03T08:00:00.000Z",
      draftId: "uat-lead-13-r1-building-a",
      evidence: {
        attribution: capture.attribution!,
        georeference: geoReference,
        imageId: capture.mediaId,
        sourceContentHash: capture.rawContentHash!,
        sourceId: capture.sourceId!,
      },
      idempotencyKey: "workbench:lead:13:r1:building-a",
      lines: persistedLines,
      revision: 1,
      sourceFootprintId: "osm:A",
      sourceOutline,
    });

    await act(async () => {
      root.render(renderWorkbench(capture, heightSurface, "osm:B"));
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="outline"]');

    expect(
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points"),
    ).toBe("0.1,0.1 0.9,0.1 0.9,0.9 0.1,0.9");
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    expect(renderedLines()).toHaveLength(0);
    await openAdvanced();

    expect(container.textContent).toContain("stogo kontūro tapatybė nesutampa");
    expect(container.textContent).toContain("Rankinės anotacijos neišvalytos");
    expect(
      container.querySelector("[data-roof-fusion-confirm-source-reset]"),
    ).not.toBeNull();
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      true,
    );

    const heightRequestCount = () =>
      vi
        .mocked(fetch)
        .mock.calls.filter(
          ([input]) =>
            String(input) === "/api/admin/roof-fusion/workbench-height-adapter",
        ).length;
    expect(heightRequestCount()).toBe(0);
    await closeAdvanced();
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });
    expect(heightRequestCount()).toBe(0);
    expect(stage()).toBe("skeleton");
    expect(
      container.querySelector("[data-roof-fusion-confirm-source-reset]"),
    ).not.toBeNull();
  });

  it("does not let a legacy capture-ID alias transfer to a building with different footprint geometry", async () => {
    await useLegacyCaptureAliasDraft();
    const buildingBOutline = [
      { x: 0.15, y: 0.15 },
      { x: 0.85, y: 0.15 },
      { x: 0.85, y: 0.85 },
      { x: 0.15, y: 0.85 },
    ] as const;

    await act(async () => {
      root.render(
        renderWorkbench(capture, heightSurface, "osm:B", buildingBOutline),
      );
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="outline"]');

    expect(
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points"),
    ).toBe("0.15,0.15 0.85,0.15 0.85,0.85 0.15,0.85");
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    expect(renderedLines()).toHaveLength(0);
    await openAdvanced();
    expect(container.textContent).toContain("stogo kontūro tapatybė nesutampa");
    expect(
      container.querySelector("[data-roof-fusion-confirm-source-reset]"),
    ).not.toBeNull();
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      true,
    );
  });

  it("transfers a legacy capture-ID alias only after matching footprint geometry and requires re-save", async () => {
    await useLegacyCaptureAliasDraft();
    await act(async () => {
      root.render(renderWorkbench(capture, heightSurface, "osm:B"));
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="outline"]');

    expect(
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points"),
    ).toBe("0.4,0.3 0.6,0.3 0.6,0.7 0.4,0.7");
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    expect(renderedLines()).toHaveLength(1);
    await openAdvanced();
    expect(container.textContent).toContain(
      "Ankstesnės rankinės anotacijos perkeltos",
    );
    expect(container.textContent).toContain("Preview · neišsaugoti pakeitimai");
    expect(
      container.querySelector("[data-roof-fusion-confirm-source-reset]"),
    ).toBeNull();
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      false,
    );
  });

  it("runs save and calculation behind one action and advances only after success", async () => {
    await act(async () => {
      root.render(renderWorkbench(capture, heightSurface));
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="outline"]');
    scrollIntoViewMock.mockClear();
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("outline");
    expect(container.textContent).toContain("Šaltinių tapatybė");
    expect(container.textContent).not.toContain(
      "Workbench height calculation could not be prepared",
    );
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    await closeAdvanced();

    scrollIntoViewMock.mockClear();
    heightResponse = "blocked";
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("outline");
    expect(container.textContent).toContain("SKELETON_DANGLING_ENDPOINT");
    expect(container.textContent).toContain(
      "Kraigo arba sąlajos galas nesujungtas",
    );
    expect(container.textContent).not.toContain("Endpoint is not attached");
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    await closeAdvanced();

    scrollIntoViewMock.mockClear();
    heightResponse = "review";
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("review");
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
    expect(container.textContent).toContain("27°");
    expect(container.textContent).toContain("Parengta rankinei peržiūrai");
    expect(container.textContent).not.toContain("review_required");
    expect(container.textContent).not.toContain("Manual ridge");
    const surfaceRows = container.querySelectorAll(
      "[data-roof-fusion-surface-result]",
    );
    expect(surfaceRows).toHaveLength(2);
    expect(
      container.querySelector('[data-roof-fusion-roof-plane="surface-south"]'),
    ).not.toBeNull();
    expect(surfaceRows.item(0).getAttribute("aria-pressed")).toBe("true");
    await act(async () => (surfaceRows.item(1) as HTMLButtonElement).click());
    expect(surfaceRows.item(0).getAttribute("aria-pressed")).toBe("false");
    expect(surfaceRows.item(1).getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Pietinis šlaitas");
    expect(container.textContent).toContain("Šiaurinis šlaitas");
    expect(container.textContent).toContain("A · Šiaurinis šlaitas");
    expect(container.textContent).toContain("B · Pietinis šlaitas");
    expect(
      container.querySelectorAll("[data-roof-fusion-plane-label]"),
    ).toHaveLength(2);
    await openAdvanced();

    const fallback = container.querySelector<HTMLElement>(
      "[data-roof-fusion-legacy-fallback]",
    );
    const fallbackButton = fallback?.querySelector<HTMLButtonElement>(
      "[data-roof-fusion-select-legacy-fallback]",
    );
    expect(fallbackButton?.disabled).toBe(true);
    await act(async () =>
      fallback!
        .querySelector<HTMLInputElement>("input[type='checkbox']")!
        .click(),
    );
    const reason = fallback!.querySelector<HTMLTextAreaElement>("textarea")!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      valueSetter?.call(reason, "Aukščio modelį užstoja medžiai");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(fallbackButton?.disabled).toBe(false);
    await act(async () => fallbackButton!.click());
    expect(container.textContent).toContain(
      "Preview · aktyvus senas rankinis fallback",
    );

    await act(async () => {
      buttonWithText("Išsaugoti ir patvirtinti reviziją")!.click();
      await flushAsyncWork();
    });
    expect(JSON.stringify(latest)).not.toContain("legacy_manual_pitch");
    await act(async () => {
      buttonWithText("Perkrauti")!.click();
      await flushAsyncWork();
    });
    expect(
      container.querySelector("[data-roof-fusion-legacy-fallback-active]"),
    ).toBeNull();
  });

  it("hides stale plane values after geometry changes and gates them until the matching draft recalculates", async () => {
    heightResponse = "review";
    await act(async () => {
      root.render(renderWorkbench(capture, heightSurface));
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });
    expect(stage()).toBe("review");
    expect(
      container.querySelectorAll("[data-roof-fusion-plane-label]"),
    ).toHaveLength(2);
    const previousDraftHash = latest?.draftHash;

    const canvasShell = container.querySelector<HTMLDivElement>(
      "[data-roof-fusion-canvas-shell]",
    );
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
    const endpoint = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-line-endpoint-hit-target]",
    );
    expect(endpoint).not.toBeNull();
    await act(async () => {
      endpoint!.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 450,
          clientY: 250,
          isPrimary: true,
          pointerId: 73,
        }),
      );
      endpoint!.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          button: 0,
          clientX: 460,
          clientY: 250,
          isPrimary: true,
          pointerId: 73,
        }),
      );
    });
    const movedEndpoint = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-line-endpoint-hit-target]",
    );
    await act(async () => {
      movedEndpoint!.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX: 460,
          clientY: 250,
          isPrimary: true,
          pointerId: 73,
        }),
      );
    });

    expect(
      container
        .querySelector("[data-roof-fusion-workbench]")
        ?.getAttribute("data-roof-fusion-result-state"),
    ).toBe("stale");
    expect(container.textContent).toContain("Rezultatą reikia atnaujinti");
    expect(container.textContent).toContain("ankstesni plotai paslėpti");
    expect(container.textContent).not.toContain("142 m²");
    expect(
      container.querySelectorAll("[data-roof-fusion-plane-label]"),
    ).toHaveLength(0);
    expect(container.textContent).not.toContain("46,2 m²");

    deferHeightResponse = true;
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-roof-fusion-refresh-result]")!
        .click();
    });
    await vi.waitFor(() =>
      expect(
        container
          .querySelector("[data-roof-fusion-review-gate]")
          ?.getAttribute("data-roof-fusion-review-gate"),
      ).toBe("updating"),
    );
    expect(container.textContent).toContain("Atnaujinama…");
    expect(
      container.querySelectorAll("[data-roof-fusion-plane-label]"),
    ).toHaveLength(0);

    deferHeightResponse = false;
    await act(async () => {
      releaseHeightResponse?.();
      await flushAsyncWork();
    });
    await vi.waitFor(() =>
      expect(
        container
          .querySelector("[data-roof-fusion-workbench]")
          ?.getAttribute("data-roof-fusion-result-state"),
      ).toBe("current"),
    );
    expect(latest?.draftHash).not.toBe(previousDraftHash);
    expect(
      container.querySelectorAll("[data-roof-fusion-plane-label]"),
    ).toHaveLength(2);
  });

  it("keeps Advanced modal keyboard focus contained and restores it on Escape", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });
    await click('[data-roof-fusion-stage-tab="outline"]');

    const trigger = container.querySelector<HTMLButtonElement>(
      "[data-roof-fusion-advanced-trigger]",
    );
    await openAdvanced();
    expect(
      container.querySelector("[data-roof-fusion-advanced]"),
    ).not.toBeNull();
    expect(
      document.activeElement?.getAttribute("data-roof-fusion-advanced-close"),
    ).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
      await flushAsyncWork();
    });

    expect(container.querySelector("[data-roof-fusion-advanced]")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("snaps a near sąlaja endpoint at 100% and preserves pending on far/zero rejection", async () => {
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
    expect(container.textContent).toContain("Nubrėžta: 1 sąlaja");
    expect(
      container
        .querySelector('[data-roof-fusion-line-mode="valley"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("false");
    expect(buttonWithText("Dar viena sąlaja")).toBeDefined();
    await clickCanvasAt(500);
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).toBeNull();
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
      "Antras kraigo arba sąlajos taškas turi skirtis nuo pirmojo",
    );
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).not.toBeNull();
    expect(renderedLines()).toHaveLength(3);
    expect(stage()).toBe("skeleton");
  });

  it("snaps a slightly-inside ridge at 300% and undoes only the last line", async () => {
    await act(async () => {
      root.render(renderWorkbench(capture, heightSurface));
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

    // At 3x, x=.404 and x=.596 are each 12 CSS px inside the boundary.
    await activateCanvasPoint(212);
    expect(
      container
        .querySelector("[data-roof-fusion-pending-line-point]")
        ?.getAttribute("cx"),
    ).toBe("0.4");
    await activateCanvasPoint(788);
    expect(renderedLines()).toHaveLength(2);
    expect(container.textContent).toContain("Nubrėžta: 2 kraigai");
    expect(
      container
        .querySelector('[data-roof-fusion-line-mode="ridge"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("false");

    await click("[data-roof-fusion-undo-last-line]");

    expect(renderedLines()).toHaveLength(1);
    expect(
      renderedLines().item(0).getAttribute("data-roof-fusion-line-kind"),
    ).toBe("ridge");
    expect(stage()).toBe("skeleton");
    expect(container.textContent).toContain("300%");
    expect(container.textContent).toContain(
      "Paskutinė kraigo arba sąlajos linija pašalinta",
    );
    expect(
      container.querySelector('img[src="/api/admin/media/91"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Preview · neišsaugoti pakeitimai");

    await openAdvanced();
    await act(async () => {
      buttonWithText("Išsaugoti ir patvirtinti reviziją")!.click();
      await flushAsyncWork();
    });
    expect(latest?.geometry.skeletonEdges).toHaveLength(1);
    expect(latest?.source.sourceId).toBe(capture.sourceId);
    expect(stage()).toBe("skeleton");
    expect(container.textContent).toContain("300%");
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
    expect(renderedLines().item(1).getAttribute("stroke-width")).toBe("2px");
    expect(
      container.querySelectorAll("[data-roof-fusion-line-endpoint]"),
    ).toHaveLength(4);
    const endpointOutline = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-line-endpoint-outline]",
    );
    const endpointCenter = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-line-endpoint-center]",
    );
    const endpointHitTarget = container.querySelector<SVGEllipseElement>(
      "[data-roof-fusion-line-endpoint-hit-target]",
    );
    expect(Number(endpointOutline?.getAttribute("rx")) * 3).toBeCloseTo(0.003);
    expect(endpointOutline?.getAttribute("fill")).toBe("#f4b63f");
    expect(Number(endpointCenter?.getAttribute("rx")) * 3).toBeCloseTo(0.0015);
    expect(endpointCenter?.getAttribute("fill")).toBe("#fffdf7");
    expect(Number(endpointHitTarget?.getAttribute("rx")) * 3).toBeCloseTo(
      0.022,
    );
    expect(endpointHitTarget?.getAttribute("pointer-events")).toBe("all");
    expect(
      container
        .querySelector("[data-roof-fusion-line-hit-target]")
        ?.getAttribute("stroke-width"),
    ).toBe("22px");
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

    scrollIntoViewMock.mockClear();
    await openAdvanced();
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
    expect(container.textContent).toContain("Revizija saugiai išsaugota");
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
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    await click('[data-roof-fusion-line-mode="ridge"]');
    await captureLine(350, 650);
    expect(renderedLines()).toHaveLength(3);
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).toBeNull();
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
      "Preview · revizija išsaugota ir pakartotinai patvirtinta",
    );
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

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
    expect(stage()).toBe("skeleton");
    expect(
      container.querySelector('[data-roof-fusion-line-kind="valley"]'),
    ).not.toBeNull();
  });

  it("lets the guarded old manual fallback reach review without a height surface", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });
    await openAdvanced();

    const fallbackButton = buttonWithText(
      "Naudoti rankinį rezultatą peržiūrai",
    );
    expect(fallbackButton).toBeDefined();
    expect(fallbackButton!.disabled).toBe(false);
    await act(async () => fallbackButton!.click());
    expect(container.textContent).toContain(
      "Preview · aktyvus senas rankinis fallback",
    );

    await closeAdvanced();
    const primary = container.querySelector<HTMLButtonElement>(
      '[data-roof-fusion-primary-action="calculate"]',
    );
    expect(primary).not.toBeNull();
    expect(primary!.disabled).toBe(false);
    await act(async () => primary!.click());

    expect(stage()).toBe("review");
    expect(container.textContent).toContain(
      "Aktyvus senas rankinis nuolydžio fallback",
    );
    expect(
      container.querySelector("[data-roof-fusion-preview-complete]"),
    ).not.toBeNull();
    expect(container.textContent).toContain("Parengta peržiūrai");
    expect(
      container.querySelector('[data-roof-fusion-primary-action="calculate"]'),
    ).toBeNull();
  });
});
