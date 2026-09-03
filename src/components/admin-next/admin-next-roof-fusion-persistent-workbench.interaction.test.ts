// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWorkbenchDraftFromUiV1 } from "@/lib/roof-fusion/workbench-ui-client-v1";
import { AdminNextRoofFusionPersistentWorkbench } from "./admin-next-roof-fusion-persistent-workbench";
import type { NorgeIBilderCaptureResult } from "./norgeibilder-capture-control";
import type { RoofFusionWorkbenchDraftV1 } from "@/lib/roof-fusion/workbench-draft-contract-v1";

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

const capture: NorgeIBilderCaptureResult = {
  imageUrl: "/api/admin/media/91",
  mediaId: "91",
  sourceId: "norge-capture-91",
  rawContentHash: "a".repeat(64),
  attribution: "©norgeibilder.no",
  capturedAt: "2026-09-03T08:00:00.000Z",
  geoReference,
};

describe("AdminNextRoofFusionPersistentWorkbench interaction", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("keeps the skeleton stage and captured ridge after a confirmed draft becomes dirty", async () => {
    const confirmedDraft = await buildWorkbenchDraftFromUiV1({
      actorId: "7",
      approvedOutline: sourceOutline,
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
      lines: [],
      revision: 1,
      sourceOutline,
    });
    let latest: RoofFusionWorkbenchDraftV1 | null = confirmedDraft;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (!url.startsWith("/api/admin/roof-fusion/workbench-draft?")) {
          throw new Error(`Unexpected request: ${url}`);
        }
        return latest
          ? new Response(JSON.stringify({ draft: latest }), {
              headers: { "content-type": "application/json" },
              status: 200,
            })
          : new Response(JSON.stringify({ code: "DRAFT_NOT_FOUND" }), {
              headers: { "content-type": "application/json" },
              status: 404,
            });
      }),
    );

    const render = (activeCapture: NorgeIBilderCaptureResult) =>
      createElement(AdminNextRoofFusionPersistentWorkbench, {
        actorId: "7",
        capture: activeCapture,
        caseId: "lead:13",
        horizontalAreaSquareMeters: 142,
        orthoImageAlt: "Test roof",
        sourceOutline,
      });

    await act(async () => {
      root.render(render(capture));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const skeletonTab = container.querySelector<HTMLButtonElement>(
      '[data-roof-fusion-stage-tab="skeleton"]',
    );
    expect(skeletonTab).not.toBeNull();
    await act(async () => skeletonTab!.click());

    const ridgeMode = container.querySelector<HTMLButtonElement>(
      '[data-roof-fusion-line-mode="ridge"]',
    );
    expect(ridgeMode).not.toBeNull();
    await act(async () => ridgeMode!.click());

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

    await act(async () => {
      canvas!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 300, clientY: 200 }),
      );
    });
    await act(async () => {
      canvas!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 700, clientY: 200 }),
      );
    });

    expect(
      container
        .querySelector("[data-roof-fusion-workbench]")
        ?.getAttribute("data-roof-fusion-stage"),
    ).toBe("skeleton");
    expect(
      container.querySelector('[data-roof-fusion-line-kind="ridge"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Preview · neišsaugoti pakeitimai");

    latest = null;
    await act(async () => {
      root.render(
        render({
          ...capture,
          sourceId: "norge-capture-92",
          rawContentHash: "b".repeat(64),
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      container
        .querySelector("[data-roof-fusion-workbench]")
        ?.getAttribute("data-roof-fusion-stage"),
    ).toBe("outline");
  });
});
