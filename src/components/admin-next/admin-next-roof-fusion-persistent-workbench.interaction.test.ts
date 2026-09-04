// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoofFusionWorkbenchDraftV1 } from "@/lib/roof-fusion/workbench-draft-contract-v1";
import { buildWorkbenchDraftFromUiV1 } from "@/lib/roof-fusion/workbench-ui-client-v1";
import {
  AdminNextRoofFusionPersistentWorkbench,
  type AdminNextRfDraftRecoveryPanel,
} from "./admin-next-roof-fusion-persistent-workbench";
import type { NorgeIBilderCaptureResult } from "./norgeibilder-capture-control";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import { buildApprovedGableRoofFixtureV1 } from "@/lib/roof-fusion/gable-roof-fixture-v1";
import { projectRoofFusionWorkbenchDetailedResultV1 } from "@/lib/roof-fusion/workbench-detailed-result-v1";
import {
  resolveRfDraftRecoveryDecision,
  RF_DRAFT_RECOVERY_CONTRACT_VERSION,
} from "@/lib/admin-next/rf-draft-recovery-contract";

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

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("AdminNextRoofFusionPersistentWorkbench interaction", () => {
  let root: Root;
  let container: HTMLDivElement;
  let latest: RoofFusionWorkbenchDraftV1 | null;
  let heightResponse: "error" | "blocked" | "review";
  let serverRecoveryDecision: AdminNextRfDraftRecoveryPanel["decision"] | null;

  const recoveryPanelFor = (
    activeCapture: NorgeIBilderCaptureResult,
    options?: Readonly<{
      addressRevision?: number;
      bindingAddressRevision?: number;
      recoveryBinding?: boolean;
      onContinueOld?: AdminNextRfDraftRecoveryPanel["onContinueOld"];
      onStartNew?: AdminNextRfDraftRecoveryPanel["onStartNew"];
    }>,
  ): AdminNextRfDraftRecoveryPanel | undefined => {
    if (!latest || !activeCapture.sourceId || !activeCapture.rawContentHash) {
      return undefined;
    }
    const draftReference = {
      id: latest.draftId,
      revision: latest.revision,
      hash: latest.draftHash,
    };
    const current = {
      case: {
        caseId: latest.caseId,
        addressRevision: options?.addressRevision ?? 7,
      },
      source: {
        id: activeCapture.sourceId,
        revision: 4,
        hash: activeCapture.rawContentHash,
      },
      snapshot: {
        id: "snapshot-lead-13",
        revision: 3,
        hash: "b".repeat(64),
      },
    };
    const decision = resolveRfDraftRecoveryDecision({
      version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
      vercelEnvironment: "preview",
      capabilities: ["roof_fusion.draft.continue", "roof_fusion.draft.create"],
      current,
      persistedDraft: {
        draft: draftReference,
        recoveryBinding:
          options?.recoveryBinding === false
            ? null
            : {
                version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
                case: {
                  caseId: latest.caseId,
                  addressRevision: options?.bindingAddressRevision ?? 7,
                },
                draft: draftReference,
                source: {
                  id: latest.source.sourceId,
                  revision: 4,
                  hash: latest.source.sourceContentHash,
                },
                snapshot: current.snapshot,
              },
      },
    });
    return {
      decision,
      locale: "lt",
      onContinueOld: options?.onContinueOld ?? vi.fn(),
      onStartNew: options?.onStartNew ?? vi.fn(),
    };
  };

  const renderWorkbench = (
    activeCapture = capture,
    activeHeightSurface?: KartverketHeightSurfaceV1,
    draftRecovery?: AdminNextRfDraftRecoveryPanel | null,
  ) => {
    const recovery =
      draftRecovery === undefined
        ? recoveryPanelFor(activeCapture)
        : (draftRecovery ?? undefined);
    return createElement(AdminNextRoofFusionPersistentWorkbench, {
      actorId: "7",
      capture: activeCapture,
      caseId: "lead:13",
      horizontalAreaSquareMeters: 142,
      orthoImageAlt: "Test roof",
      sourceOutline,
      heightSurface: activeHeightSurface,
      draftRecovery: recovery,
    });
  };

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

  const openAdvanced = async () => {
    if (container.querySelector("[data-roof-fusion-advanced]")) return;
    await click("[data-roof-fusion-advanced-trigger]");
  };

  const closeAdvanced = async () => {
    if (!container.querySelector("[data-roof-fusion-advanced]")) return;
    await click("[data-roof-fusion-advanced-close]");
  };

  const continueLatestDraft = async () => {
    await openAdvanced();
    await click('[data-rf-draft-recovery-action="continue_old"]');
    await closeAdvanced();
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
    serverRecoveryDecision = null;
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
            ? new Response(
                JSON.stringify({
                  draft: latest,
                  ...(serverRecoveryDecision
                    ? { recoveryDecision: serverRecoveryDecision }
                    : {}),
                }),
                {
                  headers: { "content-type": "application/json" },
                  status: 200,
                },
              )
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
                        ? [
                            "[SKELETON_DANGLING_ENDPOINT] Endpoint is not attached to the boundary.",
                          ]
                        : [
                            "Manual ridge, valley, hip, and eave hints were used for explicit plane subdivision.",
                          ],
                  },
                  metrics:
                    heightResponse === "review"
                      ? { averageSlopeDegrees: 27 }
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
  });

  it("does not hydrate a loaded draft before an exact Continue old decision", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });

    expect(
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points"),
    ).toBe("0.1,0.1 0.9,0.1 0.9,0.9 0.1,0.9");
    expect(renderedLines()).toHaveLength(0);

    await continueLatestDraft();

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

  it("uses the server-owned recovery decision when the real callsite enables recovery", async () => {
    serverRecoveryDecision = recoveryPanelFor(capture)!.decision;
    await act(async () => {
      root.render(
        createElement(AdminNextRoofFusionPersistentWorkbench, {
          actorId: "7",
          capture,
          caseId: "lead:13",
          draftRecoveryLocale: "lt",
          horizontalAreaSquareMeters: 142,
          orthoImageAlt: "Test roof",
          sourceOutline,
        }),
      );
      await flushAsyncWork();
    });
    await openAdvanced();

    expect(renderedLines()).toHaveLength(0);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([url]) =>
            String(url).includes("sourceId=norge-capture-91") &&
            String(url).includes(`sourceHash=${"a".repeat(64)}`),
        ),
    ).toBe(true);
    await click('[data-rf-draft-recovery-action="continue_old"]');
    await closeAdvanced();
    await click('[data-roof-fusion-stage-tab="skeleton"]');
    expect(renderedLines()).toHaveLength(1);
  });

  it("renders the exact-binding recovery decision in the persistent utility rail and forwards exact intents", async () => {
    const onContinueOld = vi.fn();
    const onStartNew = vi.fn();
    const recovery = recoveryPanelFor(capture, {
      onContinueOld,
      onStartNew,
    })!;

    await act(async () => {
      root.render(renderWorkbench(capture, undefined, recovery));
      await flushAsyncWork();
    });
    await openAdvanced();

    const persistence = container.querySelector(
      "[data-roof-fusion-persistence]",
    );
    expect(persistence).not.toBeNull();
    expect(
      persistence?.querySelector('[data-rf-commercial-use="forbidden"]'),
    ).not.toBeNull();

    expect(renderedLines()).toHaveLength(0);
    await click('[data-rf-draft-recovery-action="continue_old"]');
    expect(
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points"),
    ).toBe("0.4,0.3 0.6,0.3 0.6,0.7 0.4,0.7");
    await click('[data-rf-draft-recovery-action="start_new"]');
    expect(
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points"),
    ).toBe("0.1,0.1 0.9,0.1 0.9,0.9 0.1,0.9");

    expect(onContinueOld).toHaveBeenCalledWith(
      recovery.decision.continueOld.intent,
    );
    expect(onStartNew).toHaveBeenCalledWith(recovery.decision.startNew.intent);
  });

  it("keeps a legacy draft with no recovery binding out of geometry and offers only Start new", async () => {
    const onContinueOld = vi.fn();
    const onStartNew = vi.fn();
    const recovery = recoveryPanelFor(capture, {
      recoveryBinding: false,
      onContinueOld,
      onStartNew,
    })!;

    await act(async () => {
      root.render(renderWorkbench(capture, undefined, recovery));
      await flushAsyncWork();
    });
    await openAdvanced();

    expect(renderedLines()).toHaveLength(0);
    expect(container.textContent).toContain(
      "neturi patikrinamo adreso ir snapshot susiejimo",
    );
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-rf-draft-recovery-action="continue_old"]',
      )?.disabled,
    ).toBe(true);
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      true,
    );

    await click('[data-rf-draft-recovery-action="start_new"]');

    expect(onContinueOld).not.toHaveBeenCalled();
    expect(onStartNew).toHaveBeenCalledOnce();
    expect(renderedLines()).toHaveLength(0);
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      false,
    );
  });

  it("rejects an exact decision when the API loads a different draft revision", async () => {
    const onContinueOld = vi.fn();
    const mismatchedDraft = {
      id: "uat-lead-13-r2-other",
      revision: 2,
      hash: "f".repeat(64),
    };
    const current = {
      case: { caseId: "lead:13", addressRevision: 7 },
      source: {
        id: capture.sourceId!,
        revision: 4,
        hash: capture.rawContentHash!,
      },
      snapshot: {
        id: "snapshot-lead-13",
        revision: 3,
        hash: "b".repeat(64),
      },
    };
    const decision = resolveRfDraftRecoveryDecision({
      version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
      vercelEnvironment: "preview",
      capabilities: ["roof_fusion.draft.continue", "roof_fusion.draft.create"],
      current,
      persistedDraft: {
        draft: mismatchedDraft,
        recoveryBinding: {
          version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
          case: current.case,
          draft: mismatchedDraft,
          source: current.source,
          snapshot: current.snapshot,
        },
      },
    });

    await act(async () => {
      root.render(
        renderWorkbench(capture, undefined, {
          decision,
          locale: "lt",
          onContinueOld,
          onStartNew: vi.fn(),
        }),
      );
      await flushAsyncWork();
    });
    await openAdvanced();
    await click('[data-rf-draft-recovery-action="continue_old"]');

    expect(onContinueOld).not.toHaveBeenCalled();
    expect(renderedLines()).toHaveLength(0);
    expect(
      container
        .querySelector('[data-roof-fusion-layer="approvedOutline"]')
        ?.getAttribute("points"),
    ).toBe("0.1,0.1 0.9,0.1 0.9,0.9 0.1,0.9");
    expect(container.textContent).toContain(
      "nesutampa su faktiškai įkelta revizija",
    );
  });

  it("fails closed when an old draft is loaded without a recovery decision", async () => {
    await act(async () => {
      root.render(renderWorkbench(capture, undefined, null));
      await flushAsyncWork();
    });
    await openAdvanced();

    expect(renderedLines()).toHaveLength(0);
    expect(container.textContent).toContain(
      "neturi šiame workbench patikrinto recovery susiejimo",
    );
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      true,
    );
    expect(
      container.querySelector("[data-roof-fusion-confirm-source-reset]"),
    ).toBeNull();
  });

  it("fails closed instead of carrying annotations across a changed source", async () => {
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
    await openAdvanced();

    expect(renderedLines()).toHaveLength(0);
    expect(container.textContent).toContain("Ankstesnis juodraštis paseno");
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-rf-draft-recovery-action="continue_old"]',
      )?.disabled,
    ).toBe(true);
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      true,
    );

    await click('[data-rf-draft-recovery-action="start_new"]');

    expect(renderedLines()).toHaveLength(0);
    expect(container.textContent).toContain("ankstesnė revizija nepanaudota");
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      false,
    );
  });

  it("offers only authorized Start new for a stale mismatched capture", async () => {
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

    expect(container.textContent).toContain("Ankstesnis juodraštis paseno");
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      true,
    );
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-rf-draft-recovery-action="continue_old"]',
      )?.disabled,
    ).toBe(true);
    expect(latest?.revision).toBe(1);

    await click('[data-rf-draft-recovery-action="start_new"]');

    expect(container.textContent).toContain("ankstesnė revizija nepanaudota");
    expect(buttonWithText("Išsaugoti ir patvirtinti reviziją")?.disabled).toBe(
      false,
    );
    expect(latest?.revision).toBe(1);
  });

  it("runs save and calculation behind one action and advances only after success", async () => {
    await act(async () => {
      root.render(renderWorkbench(capture, heightSurface));
      await flushAsyncWork();
    });
    await continueLatestDraft();
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("outline");
    expect(container.textContent).toContain("Šaltinių tapatybė");
    expect(container.textContent).not.toContain(
      "Workbench height calculation could not be prepared",
    );
    await closeAdvanced();

    heightResponse = "blocked";
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("outline");
    expect(container.textContent).toContain("SKELETON_DANGLING_ENDPOINT");
    expect(container.textContent).toContain(
      "Kraigo arba slėnio galas nesujungtas",
    );
    expect(container.textContent).not.toContain("Endpoint is not attached");
    await closeAdvanced();

    heightResponse = "review";
    await act(async () => {
      buttonWithText("Apskaičiuoti")!.click();
      await flushAsyncWork();
    });

    expect(stage()).toBe("review");
    expect(container.textContent).toContain("27°");
    expect(container.textContent).toContain(
      "Matavimo rezultatas parengtas peržiūrai",
    );
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

  it("keeps Advanced modal keyboard focus contained and restores it on Escape", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });

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

  it("snaps a near valley endpoint at 100% and preserves pending on far/zero rejection", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });
    await continueLatestDraft();
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

  it("snaps a slightly-inside ridge at 300% and undoes only the last line", async () => {
    await act(async () => {
      root.render(renderWorkbench(capture, heightSurface));
      await flushAsyncWork();
    });
    await continueLatestDraft();
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
    expect(container.textContent).toContain(
      "Taškas magnetiškai pritrauktas prie patvirtinto kontūro (14 px)",
    );

    await click("[data-roof-fusion-undo-last-line]");

    expect(renderedLines()).toHaveLength(1);
    expect(
      renderedLines().item(0).getAttribute("data-roof-fusion-line-kind"),
    ).toBe("ridge");
    expect(stage()).toBe("skeleton");
    expect(container.textContent).toContain("300%");
    expect(container.textContent).toContain(
      "Paskutinė kraigo arba slėnio linija pašalinta",
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
    await continueLatestDraft();
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
    expect(renderedLines().item(1).getAttribute("stroke-width")).toBe("0.5px");
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
    expect(renderedLines().item(1).getAttribute("stroke-width")).toBe("0.5px");
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

  it("lets the guarded old manual fallback reach review without a height surface", async () => {
    await act(async () => {
      root.render(renderWorkbench());
      await flushAsyncWork();
    });
    await openAdvanced();
    await click('[data-rf-draft-recovery-action="start_new"]');

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
    expect(container.textContent).toContain(
      "Matavimo rezultatas parengtas peržiūrai",
    );
    expect(
      container.querySelector('[data-roof-fusion-primary-action="calculate"]'),
    ).toBeNull();
  });
});
