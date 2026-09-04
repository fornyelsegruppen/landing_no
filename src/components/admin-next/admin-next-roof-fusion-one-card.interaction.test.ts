// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RealAddressResult,
  type RoofFusionHeightAnalysisState,
} from "./admin-next-roof-fusion-uat-control";
import type {
  NorgeIBilderCaptureApi,
  NorgeIBilderCaptureResult,
} from "./norgeibilder-capture-control";

const address = {
  id: "0301-1-2-0-0-Lyngveien 28A",
  label: "Lyngveien 28A, 1182 OSLO",
  postalCode: "1182",
  city: "OSLO",
  latitude: 59.91138,
  longitude: 10.7494,
  source: "Kartverket",
};

const polygon = [
  { latitude: 59.9113, longitude: 10.7493 },
  { latitude: 59.9113, longitude: 10.7495 },
  { latitude: 59.9115, longitude: 10.7495 },
  { latitude: 59.9115, longitude: 10.7493 },
];

const garagePolygon = [
  { latitude: 59.91122, longitude: 10.74952 },
  { latitude: 59.91122, longitude: 10.74962 },
  { latitude: 59.9113, longitude: 10.74962 },
  { latitude: 59.9113, longitude: 10.74952 },
];

describe("Roof Fusion one-card Preview flow", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (
          String(input).startsWith("/api/admin/roof-fusion/workbench-draft?")
        ) {
          return new Response(JSON.stringify({ code: "DRAFT_NOT_FOUND" }), {
            headers: { "content-type": "application/json" },
            status: 404,
          });
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("automatically captures the address image, exposes every building polygon, and binds the chosen building to one workbench", async () => {
    const capturedResult: NorgeIBilderCaptureResult = {
      address,
      addressLabel: address.label,
      attribution: "©norgeibilder.no",
      capturedAt: "2026-09-04T09:00:00.000Z",
      geoReference: {
        crs: "EPSG:25833" as const,
        extentTrust: "actual-visible-extent" as const,
        bounds: {
          minEastingM: 0,
          minNorthingM: 0,
          maxEastingM: 10_000_000,
          maxNorthingM: 10_000_000,
        },
        imageWidth: 1_000,
        imageHeight: 500,
      },
      imageUrl: "/api/admin/media/91",
      rawContentHash: "a".repeat(64),
      sourceId: "norge-i-bilder:91",
    };
    let resolveCapture: (result: NorgeIBilderCaptureResult) => void = () => {};
    const captureApi = vi.fn<NorgeIBilderCaptureApi>((request) => {
      void request;
      return new Promise<NorgeIBilderCaptureResult>((resolve) => {
        resolveCapture = resolve;
      });
    });
    let resolveHeight: (result: {
      kind: "error";
      code: "HEIGHT_DATA_UNAVAILABLE";
    }) => void = () => {};
    const heightAnalysisAction = vi.fn(
      (previousState: RoofFusionHeightAnalysisState, formData: FormData) => {
        void previousState;
        void formData;
        return new Promise<{
          kind: "error";
          code: "HEIGHT_DATA_UNAVAILABLE";
        }>((resolve) => {
          resolveHeight = resolve;
        });
      },
    );
    await act(async () => {
      root.render(
        createElement(RealAddressResult, {
          actorId: "7",
          captureApi,
          caseReference: "TF-13",
          heightAnalysisAction,
          leadId: 13,
          locale: "lt",
          result: {
            kind: "success" as const,
            address,
            candidates: [
              {
                id: "way/123",
                label: "house · 87 m²",
                polygon,
                horizontalAreaSquareMeters: 87,
                distanceToAddressMeters: 0,
                containsAddress: true,
                confidence: "high" as const,
                confidenceReasoning: "Address point is inside",
                source: "OpenStreetMap building footprint via Overpass API",
                sourceUrl: "https://www.openstreetmap.org/way/123",
                license: "Open Database License (ODbL) 1.0",
                credits: "© OpenStreetMap contributors",
              },
              {
                id: "way/456",
                label: "garage · 42 m²",
                polygon: garagePolygon,
                horizontalAreaSquareMeters: 42,
                distanceToAddressMeters: 12,
                containsAddress: false,
                confidence: "medium" as const,
                confidenceReasoning: "Near the address point",
                source: "OpenStreetMap building footprint via Overpass API",
                sourceUrl: "https://www.openstreetmap.org/way/456",
                license: "Open Database License (ODbL) 1.0",
                credits: "© OpenStreetMap contributors",
              },
            ],
            enginePreviews: [
              {
                kind: "success" as const,
                candidateId: "way/123",
                summary: {
                  schemaVersion: "roof-fusion-osm-preview.v1" as const,
                  candidateId: "way/123",
                  contractStatus: "valid" as const,
                  reviewState: "review_required" as const,
                  qualityStatus: "review_required" as const,
                  measurementClass: "preliminary" as const,
                  pricingReady: false as const,
                  blockers: ["ROOF_PLANES_REQUIRED" as const],
                  engineHorizontalAreaSquareMeters: 87,
                  providerHorizontalAreaSquareMeters: 87,
                  areaDeltaPercent: 0,
                  footprintPerimeterMeters: 40,
                  calculationHash: "b".repeat(64),
                  snapshotHash: "c".repeat(64),
                  renderHash: "d".repeat(64),
                },
              },
            ],
          },
        }),
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(captureApi).toHaveBeenCalledTimes(1);
    expect(captureApi.mock.calls[0]?.[0]).toMatchObject({ leadId: 13 });
    expect(captureApi.mock.calls[0]?.[0].clickId).toEqual(expect.any(String));
    const loadingOverlay = container.querySelector(
      "[data-roof-fusion-ortho-loading]",
    );
    expect(loadingOverlay?.getAttribute("role")).toBe("status");
    expect(loadingOverlay?.getAttribute("aria-live")).toBe("polite");
    expect(loadingOverlay?.textContent).toContain("Kraunamas ortofoto…");
    expect(
      container
        .querySelector("[data-roof-fusion-ortho-canvas]")
        ?.getAttribute("aria-busy"),
    ).toBe("true");
    await act(async () => {
      resolveCapture(capturedResult);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const buildingSelection = await vi.waitFor(() => {
      const selection = container.querySelector(
        "[data-roof-fusion-building-selection]",
      );
      expect(selection, container.textContent ?? "").not.toBeNull();
      return selection!;
    });
    expect(buildingSelection.textContent).toContain("©norgeibilder.no");
    expect(
      container.querySelector("[data-roof-fusion-ortho-loading]"),
    ).toBeNull();
    expect(
      container
        .querySelector("[data-roof-fusion-ortho-canvas]")
        ?.getAttribute("aria-busy"),
    ).toBe("false");

    const candidateTargets = Array.from(
      buildingSelection.querySelectorAll<SVGGElement>(
        "[data-roof-fusion-building-candidate]",
      ),
    );
    expect(
      candidateTargets.map((target) =>
        target.getAttribute("data-roof-fusion-building-candidate"),
      ),
    ).toEqual(["way/123", "way/456"]);
    for (const target of candidateTargets) {
      expect(target.getAttribute("role")).toBe("button");
      expect(target.getAttribute("tabindex")).toBe("0");
      expect(target.getAttribute("aria-label")).toMatch(/^Pasirinkti pastatą:/);
      expect(target.querySelector("polygon")).not.toBeNull();
    }

    const captureButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.includes("Gauti vaizdą iš Norge"));
    expect(captureButton).toBeDefined();
    const standaloneCapture = captureButton!.closest<HTMLElement>(
      "[data-norgeibilder-capture='single-case']",
    );
    expect(standaloneCapture?.dataset.norgeibilderCaptureMode).toBe(
      "unified-hidden",
    );
    expect(standaloneCapture?.classList.contains("hidden")).toBe(true);
    expect(heightAnalysisAction).not.toHaveBeenCalled();

    const selectedPolygonPoints = candidateTargets[1]
      ?.querySelector("polygon")
      ?.getAttribute("points");

    await act(async () => {
      candidateTargets[1]!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() =>
      expect(
        container.querySelector("[data-roof-fusion-workbench='unified']"),
        container.textContent ?? "",
      ).not.toBeNull(),
    );
    await vi.waitFor(() =>
      expect(heightAnalysisAction).toHaveBeenCalledTimes(1),
    );
    const heightRequest = heightAnalysisAction.mock.calls[0]?.[1];
    expect(heightRequest).toBeInstanceOf(FormData);
    expect(heightRequest!.get("candidateId")).toBe("way/456");
    expect(
      container.querySelector("[data-roof-fusion-automatic-height='loading']"),
    ).not.toBeNull();
    expect(
      container
        .querySelector("[data-roof-fusion-layer='sourceOutline']")
        ?.getAttribute("points"),
    ).toBe(selectedPolygonPoints);

    expect(standaloneCapture?.classList.contains("hidden")).toBe(true);

    await act(async () => {
      resolveHeight({
        kind: "error",
        code: "HEIGHT_DATA_UNAVAILABLE",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      container.querySelector("[data-roof-fusion-automatic-height='error']"),
    ).not.toBeNull();
    expect(standaloneCapture?.classList.contains("hidden")).toBe(true);
    expect(captureButton!.isConnected).toBe(true);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-roof-fusion-stage-tab="skeleton"]',
        )!
        .click();
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-roof-fusion-line-mode="ridge"]',
        )!
        .click();
    });
    const canvas = container.querySelector<HTMLElement>(
      "[data-roof-fusion-canvas]",
    )!;
    const outlinePoints = selectedPolygonPoints!
      .split(" ")
      .map((pair) => pair.split(",").map(Number));
    const insidePoint = {
      x:
        outlinePoints.reduce((sum, point) => sum + point[0], 0) /
        outlinePoints.length,
      y:
        outlinePoints.reduce((sum, point) => sum + point[1], 0) /
        outlinePoints.length,
    };
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 500,
        height: 500,
        left: 0,
        right: 1_000,
        top: 0,
        width: 1_000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    await act(async () => {
      canvas.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: insidePoint.x * 1_000,
          clientY: insidePoint.y * 500,
        }),
      );
    });
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).not.toBeNull();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          "[data-roof-fusion-advanced-trigger]",
        )!
        .click();
    });
    const visibleRefresh = container
      .querySelector("[data-roof-fusion-advanced]")
      ?.querySelector<HTMLButtonElement>(
        "[data-roof-fusion-refresh-norge-capture]",
      );
    expect(visibleRefresh).not.toBeNull();
    await act(async () => {
      visibleRefresh!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(captureApi).toHaveBeenCalledTimes(2);
    expect(
      container
        .querySelector("[data-roof-fusion-ortho-canvas]")
        ?.getAttribute("aria-busy"),
    ).toBe("true");
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).not.toBeNull();
    expect(
      container
        .querySelector("[data-roof-fusion-workbench='unified']")
        ?.parentElement?.getAttribute("aria-hidden"),
    ).toBe("true");

    const refreshedCapture = {
      ...capturedResult,
      capturedAt: "2026-09-04T09:05:00.000Z",
      rawContentHash: "e".repeat(64),
      sourceId: "norge-i-bilder:92",
    };
    await act(async () => {
      resolveCapture(refreshedCapture);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() =>
      expect(
        container
          .querySelector("[data-roof-fusion-workbench='unified']")
          ?.parentElement?.getAttribute("aria-hidden"),
      ).toBe("false"),
    );
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-roof-fusion-stage='skeleton']"),
    ).not.toBeNull();
    expect(heightAnalysisAction).toHaveBeenCalledTimes(2);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-roof-fusion-advanced] [aria-label="Uždaryti Advanced nustatymus"]',
        )!
        .click();
    });

    const changeBuilding = container.querySelector<HTMLButtonElement>(
      "[data-roof-fusion-change-building]",
    );
    expect(changeBuilding?.textContent).toContain("← Keisti pastatą");
    expect(
      container
        .querySelector("[data-roof-fusion-one-card-progress]")
        ?.parentElement?.contains(changeBuilding!),
    ).toBe(true);
    await act(async () => {
      changeBuilding!.click();
    });
    expect(captureApi).toHaveBeenCalledTimes(2);
    expect(heightAnalysisAction).toHaveBeenCalledTimes(2);
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).not.toBeNull();

    await act(async () => {
      captureButton!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(captureApi).toHaveBeenCalledTimes(3);
    expect(
      container
        .querySelector("[data-roof-fusion-ortho-canvas]")
        ?.getAttribute("aria-busy"),
    ).toBe("true");
    expect(
      container.querySelector("[data-roof-fusion-ortho-loading]")?.textContent,
    ).toContain("Kraunamas ortofoto…");
    expect(
      container.querySelector('[alt^="Anksčiau gautas stogo vaizdas"]'),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-roof-fusion-building-selection]"),
    ).toBeNull();
    expect(
      container.querySelector("[data-roof-fusion-building-candidate]"),
    ).toBeNull();
    expect(
      container.querySelector("[data-roof-fusion-building-list]"),
    ).toBeNull();
    expect(
      container.querySelector("[data-roof-fusion-building-list-option]"),
    ).toBeNull();

    await act(async () => {
      resolveCapture({
        ...refreshedCapture,
        capturedAt: "2026-09-04T09:10:00.000Z",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const reselection = container.querySelector(
      "[data-roof-fusion-building-selection]",
    );
    expect(reselection).not.toBeNull();
    expect(
      container
        .querySelector("[data-roof-fusion-ortho-canvas]")
        ?.getAttribute("aria-busy"),
    ).toBe("false");
    const previousSelection = reselection?.querySelector<SVGGElement>(
      '[data-roof-fusion-building-candidate="way/456"]',
    );
    const nextSelection = reselection?.querySelector<SVGGElement>(
      '[data-roof-fusion-building-candidate="way/123"]',
    );
    expect(previousSelection?.getAttribute("aria-pressed")).toBe("true");
    expect(nextSelection?.getAttribute("aria-pressed")).toBe("false");
    await act(async () => nextSelection!.focus());
    expect(previousSelection?.getAttribute("aria-pressed")).toBe("true");
    expect(heightAnalysisAction).toHaveBeenCalledTimes(2);

    await act(async () => {
      previousSelection!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-roof-fusion-stage='skeleton']"),
    ).not.toBeNull();
    expect(heightAnalysisAction).toHaveBeenCalledTimes(3);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[data-roof-fusion-change-building]")!
        .click();
    });
    const changedCandidate = container.querySelector<SVGGElement>(
      '[data-roof-fusion-building-candidate="way/123"]',
    );

    await act(async () => {
      changedCandidate!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() =>
      expect(heightAnalysisAction).toHaveBeenCalledTimes(4),
    );
    expect(heightAnalysisAction.mock.calls[3]?.[1].get("candidateId")).toBe(
      "way/123",
    );
    expect(
      container.querySelector("[data-roof-fusion-pending-line-point]"),
    ).toBeNull();
  });

  it("clears the orthophoto loading overlay when capture fails", async () => {
    let rejectCapture: (reason: Error) => void = () => {};
    const captureApi = vi.fn<NorgeIBilderCaptureApi>((request) => {
      void request;
      return new Promise<NorgeIBilderCaptureResult>((_resolve, reject) => {
        rejectCapture = reject;
      });
    });
    const heightAnalysisAction = vi.fn(
      async (
        previousState: RoofFusionHeightAnalysisState,
        formData: FormData,
      ) => {
        void previousState;
        void formData;
        return { kind: "idle" as const };
      },
    );

    await act(async () => {
      root.render(
        createElement(RealAddressResult, {
          actorId: "7",
          captureApi,
          caseReference: "TF-13",
          heightAnalysisAction,
          leadId: 13,
          locale: "lt",
          result: {
            kind: "success" as const,
            address,
            candidates: [
              {
                id: "way/123",
                label: "house · 87 m²",
                polygon,
                horizontalAreaSquareMeters: 87,
                distanceToAddressMeters: 0,
                containsAddress: true,
                confidence: "high" as const,
                confidenceReasoning: "Address point is inside",
                source: "OpenStreetMap building footprint via Overpass API",
                sourceUrl: "https://www.openstreetmap.org/way/123",
                license: "Open Database License (ODbL) 1.0",
                credits: "© OpenStreetMap contributors",
              },
            ],
            enginePreviews: [],
          },
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(captureApi).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector("[data-roof-fusion-ortho-loading]")?.textContent,
    ).toContain("Kraunamas ortofoto…");

    await act(async () => {
      rejectCapture(new Error("capture unavailable"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await vi.waitFor(() =>
      expect(
        container.querySelector("[data-roof-fusion-ortho-loading]"),
      ).toBeNull(),
    );
    expect(
      container
        .querySelector("[data-roof-fusion-ortho-canvas]")
        ?.getAttribute("aria-busy"),
    ).toBe("false");
    expect(
      container
        .querySelector("[data-norgeibilder-capture='single-case']")
        ?.classList.contains("hidden"),
    ).toBe(false);
    expect(heightAnalysisAction).not.toHaveBeenCalled();
  });

  it("shows a localized capture retry when image evidence fails source validation", async () => {
    let resolveCapture: (result: NorgeIBilderCaptureResult) => void = () => {};
    const captureApi = vi.fn<NorgeIBilderCaptureApi>((request) => {
      void request;
      return new Promise<NorgeIBilderCaptureResult>((resolve) => {
        resolveCapture = resolve;
      });
    });
    const heightAnalysisAction = vi.fn(
      async (
        previousState: RoofFusionHeightAnalysisState,
        formData: FormData,
      ) => {
        void previousState;
        void formData;
        return { kind: "idle" as const };
      },
    );

    await act(async () => {
      root.render(
        createElement(RealAddressResult, {
          actorId: "7",
          captureApi,
          caseReference: "TF-13",
          heightAnalysisAction,
          leadId: 13,
          locale: "lt",
          result: {
            kind: "success" as const,
            address,
            candidates: [
              {
                id: "way/123",
                label: "house · 87 m²",
                polygon,
                horizontalAreaSquareMeters: 87,
                distanceToAddressMeters: 0,
                containsAddress: true,
                confidence: "high" as const,
                confidenceReasoning: "Address point is inside",
                source: "OpenStreetMap building footprint via Overpass API",
                sourceUrl: "https://www.openstreetmap.org/way/123",
                license: "Open Database License (ODbL) 1.0",
                credits: "© OpenStreetMap contributors",
              },
            ],
            enginePreviews: [],
          },
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(captureApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCapture({
        address,
        addressLabel: address.label,
        capturedAt: "2026-09-04T09:00:00.000Z",
        imageUrl: "/api/admin/media/invalid-91",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const retry = await vi.waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>(
        "[data-roof-fusion-ortho-retry]",
      );
      expect(button, container.textContent ?? "").not.toBeNull();
      return button!;
    });
    expect(retry.textContent).toContain("Pakartoti ortofoto gavimą");
    expect(retry.closest("[role='alert']")?.textContent).toContain(
      "Høydedata dar nebuvo skaitomi",
    );
    expect(
      container.querySelector("[data-roof-fusion-ortho-loading]"),
    ).toBeNull();
    expect(
      container
        .querySelector("[data-roof-fusion-ortho-canvas]")
        ?.getAttribute("aria-busy"),
    ).toBe("false");

    await act(async () => {
      retry.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(captureApi).toHaveBeenCalledTimes(2);
    expect(
      container.querySelector("[data-roof-fusion-ortho-loading]")?.textContent,
    ).toContain("Kraunamas ortofoto…");
    expect(
      container
        .querySelector("[data-roof-fusion-ortho-canvas]")
        ?.getAttribute("aria-busy"),
    ).toBe("true");
    expect(
      container.querySelector("[data-roof-fusion-building-list]"),
    ).toBeNull();
    expect(heightAnalysisAction).not.toHaveBeenCalled();
  });

  it("keeps a valid address capture when the candidate changes while it is loading", async () => {
    let resolveCapture: (result: NorgeIBilderCaptureResult) => void = () => {};
    const captureApi = vi.fn<NorgeIBilderCaptureApi>((request) => {
      void request;
      return new Promise<NorgeIBilderCaptureResult>((resolve) => {
        resolveCapture = resolve;
      });
    });
    const heightAnalysisAction = vi.fn(
      async (
        previousState: RoofFusionHeightAnalysisState,
        formData: FormData,
      ) => {
        void previousState;
        void formData;
        return {
          kind: "error" as const,
          code: "HEIGHT_DATA_UNAVAILABLE" as const,
        };
      },
    );
    const candidate = {
      id: "way/123",
      label: "house · 87 m²",
      polygon,
      horizontalAreaSquareMeters: 87,
      distanceToAddressMeters: 0,
      containsAddress: true,
      confidence: "high" as const,
      confidenceReasoning: "Address point is inside",
      source: "OpenStreetMap building footprint via Overpass API" as const,
      sourceUrl: "https://www.openstreetmap.org/way/123",
      license: "Open Database License (ODbL) 1.0" as const,
      credits: "© OpenStreetMap contributors" as const,
    };

    await act(async () => {
      root.render(
        createElement(RealAddressResult, {
          actorId: "7",
          captureApi,
          caseReference: "TF-13",
          heightAnalysisAction,
          leadId: 13,
          locale: "lt",
          result: {
            kind: "success" as const,
            address,
            candidates: [
              candidate,
              {
                ...candidate,
                id: "way/456",
                label: "garage · 42 m²",
                horizontalAreaSquareMeters: 42,
                sourceUrl: "https://www.openstreetmap.org/way/456",
              },
            ],
            enginePreviews: [],
          },
        }),
      );
    });

    const candidateSelect =
      container.querySelector<HTMLSelectElement>("select");
    expect(candidateSelect).not.toBeNull();

    await vi.waitFor(() => expect(captureApi).toHaveBeenCalledTimes(1));
    await act(async () => {
      candidateSelect!.value = "way/456";
      candidateSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      resolveCapture({
        address,
        addressLabel: address.label,
        attribution: "©norgeibilder.no",
        capturedAt: "2026-09-04T09:00:00.000Z",
        geoReference: {
          crs: "EPSG:25833",
          extentTrust: "actual-visible-extent",
          bounds: {
            minEastingM: 0,
            minNorthingM: 0,
            maxEastingM: 10_000_000,
            maxNorthingM: 10_000_000,
          },
          imageWidth: 1_000,
          imageHeight: 500,
        },
        imageUrl: "/api/admin/media/91",
        rawContentHash: "a".repeat(64),
        sourceId: "norge-i-bilder:91",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(heightAnalysisAction).not.toHaveBeenCalled();
    expect(
      container.querySelector("[data-roof-fusion-workbench='unified']"),
    ).toBeNull();
    const buildingSelection = container.querySelector(
      "[data-roof-fusion-building-selection]",
    );
    expect(buildingSelection).not.toBeNull();
    const currentCandidate = buildingSelection?.querySelector<SVGGElement>(
      '[data-roof-fusion-building-candidate="way/456"]',
    );
    expect(currentCandidate?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      currentCandidate!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() =>
      expect(heightAnalysisAction).toHaveBeenCalledTimes(1),
    );
    expect(heightAnalysisAction.mock.calls[0]?.[1].get("candidateId")).toBe(
      "way/456",
    );
    expect(
      container.querySelector("[data-roof-fusion-workbench='unified']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-roof-fusion-automatic-height-retry]"),
    ).not.toBeNull();
  });
});
