"use client";

import {
  CheckCircle2,
  Camera,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import {
  type PointerEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { GeoPoint } from "@/lib/measurements/types";
import type { AddressCandidate } from "@/lib/providers/contracts";
import {
  projectWgs84ToOrthoPixels,
  type GeoReference,
} from "./norgeibilder-projection";
import {
  DEFAULT_ROOF_FUSION_VIEWPORT,
  MAX_ROOF_FUSION_ZOOM,
  MIN_ROOF_FUSION_ZOOM,
  hasRoofFusionPanGestureMoved,
  panRoofFusionViewport,
  shouldHandleRoofFusionZoomWheel,
  zoomRoofFusionViewportAt,
  type RoofFusionPoint,
  type RoofFusionViewport,
} from "./admin-next-roof-fusion-unified-workbench";
import { NorgeMeasurementActions } from "./norge-measurement-actions";

export type NorgeIBilderCaptureRequest = {
  leadId: number;
  clickId: string;
  address: AddressCandidate;
};

export type NorgeIBilderCaptureResult = {
  imageUrl: string;
  width?: number;
  height?: number;
  attempts?: number;
  evidenceId?: number | string;
  source?: string;
  /** Stable evidence identity returned by the authenticated capture route. */
  sourceId?: string;
  /** SHA-256 of the exact attributed bytes stored in private media. */
  rawContentHash?: string;
  attribution?: string;
  capturedAt?: string;
  addressLabel?: string;
  mapImageId?: number | string;
  mediaId?: number | string;
  address?: AddressCandidate;
  geoReference?: GeoReference;
};

export type NorgeIBilderCaptureApi = (
  request: NorgeIBilderCaptureRequest,
) => Promise<NorgeIBilderCaptureResult>;

type CaptureDedupeEntry =
  | {
      kind: "loading";
      clickId: string;
      promise: Promise<NorgeIBilderCaptureResult>;
    }
  | {
      kind: "success";
      clickId: string;
      result: NorgeIBilderCaptureResult;
    }
  | { kind: "error"; clickId: string; message: string };

const defaultCaptureDedupe = new Map<string, CaptureDedupeEntry>();

export function resetNorgeIBilderCaptureDedupeForTests() {
  defaultCaptureDedupe.clear();
}

function normalizedCaptureKeyPart(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("nb-NO")
    .replace(/\s+/gu, " ");
}

export function norgeIBilderAddressCaptureKey(
  leadId: number | undefined,
  address: AddressCandidate | undefined,
) {
  if (!leadId || !address) return undefined;
  return `lead:${leadId}:address:${normalizedCaptureKeyPart(address.id)}`;
}

async function requestNorgeIBilderCapture(request: NorgeIBilderCaptureRequest) {
  const response = await fetch(
    "/api/admin/roof-fusion/norge-i-bilder-capture",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      error?: string;
      code?: string;
      correlationId?: string;
    } | null;
    const reference = problem?.correlationId
      ? ` (klaidos ID: ${problem.correlationId})`
      : "";
    throw new Error(
      `${problem?.error || "Nepavyko gauti vaizdo iš Norge i bilder."}${
        problem?.code ? ` [${problem.code}]` : ""
      }${reference}`,
    );
  }
  return (await response.json()) as NorgeIBilderCaptureResult;
}

export type NorgeIBilderCaptureContext = Readonly<{
  candidateId?: string;
  phase: "loading" | "success" | "error";
}>;

/** Convert the georeferenced pixel overlay into the workbench's 0..1 space. */
export function normalizeOrthoOverlayPoints(
  overlay: string | null,
  reference: GeoReference,
): RoofFusionPoint[] | null {
  if (!overlay || reference.imageWidth <= 0 || reference.imageHeight <= 0) {
    return null;
  }
  const points = overlay
    .trim()
    .split(/\s+/u)
    .map((value) => {
      const [x, y] = value.split(",").map(Number);
      return { x, y };
    });
  if (
    points.length < 3 ||
    points.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > reference.imageWidth ||
        point.y < 0 ||
        point.y > reference.imageHeight,
    )
  ) {
    return null;
  }
  return points.map((point) => ({
    x: point.x / reference.imageWidth,
    y: point.y / reference.imageHeight,
  }));
}

type CaptureState =
  | { kind: "idle" }
  | { kind: "loading"; attempt: number }
  | {
      kind: "success";
      result: NorgeIBilderCaptureResult;
      candidateId?: string;
    }
  | { kind: "error"; message: string };

export function captureMatchesSelectedAddress(
  captured: AddressCandidate | undefined,
  selected: AddressCandidate | undefined,
) {
  if (!captured || !selected) return false;
  if (captured.id.trim() === selected.id.trim()) return true;
  const normalized = (value: string) =>
    value
      .trim()
      .toLocaleLowerCase("nb-NO")
      .replace(/[.,]/g, " ")
      .replace(/\s+/g, " ");
  const streetAddress = (candidate: AddressCandidate) =>
    normalized(candidate.label.split(",", 1)[0] ?? "");
  if (
    !captured.postalCode.trim() ||
    normalized(captured.postalCode) !== normalized(selected.postalCode) ||
    !streetAddress(captured) ||
    streetAddress(captured) !== streetAddress(selected)
  ) {
    return false;
  }
  const latitudeMeters = (captured.latitude - selected.latitude) * 111_320;
  const longitudeMeters =
    (captured.longitude - selected.longitude) *
    111_320 *
    Math.cos((captured.latitude * Math.PI) / 180);
  return Math.hypot(latitudeMeters, longitudeMeters) <= 15;
}

type CapturePanGesture = Readonly<{
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startViewport: RoofFusionViewport;
  moved: boolean;
}>;

export function NorgeIBilderCaptureViewport({
  attribution,
  geoReference,
  imageUrl,
  overlayOpacity,
  overlayPoints,
}: {
  attribution: string;
  geoReference?: GeoReference;
  imageUrl: string;
  overlayOpacity: number;
  overlayPoints: string | null;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<RoofFusionViewport>(
    DEFAULT_ROOF_FUSION_VIEWPORT,
  );
  const [panGesture, setPanGesture] = useState<CapturePanGesture | null>(null);
  const transform = `translate(${viewport.offsetX * 100}%, ${viewport.offsetY * 100}%) scale(${viewport.scale})`;
  const imageWidth = geoReference?.imageWidth ?? 16;
  const imageHeight = geoReference?.imageHeight ?? 9;

  const applyViewport = useCallback((next: RoofFusionViewport) => {
    setViewport(next);
    if (next.scale === MIN_ROOF_FUSION_ZOOM) {
      setPanGesture(null);
    }
  }, []);

  const changeZoom = useCallback(
    (delta: number) => {
      applyViewport(zoomRoofFusionViewportAt(viewport, viewport.scale + delta));
    },
    [applyViewport, viewport],
  );

  const resetViewport = useCallback(() => {
    applyViewport(DEFAULT_ROOF_FUSION_VIEWPORT);
  }, [applyViewport]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!shouldHandleRoofFusionZoomWheel(event)) return;
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const anchor = {
        x: Math.min(
          1,
          Math.max(0, (event.clientX - bounds.left) / (bounds.width || 1)),
        ),
        y: Math.min(
          1,
          Math.max(0, (event.clientY - bounds.top) / (bounds.height || 1)),
        ),
      };
      const boundedDelta = Math.max(-100, Math.min(100, event.deltaY));
      applyViewport(
        zoomRoofFusionViewportAt(
          viewport,
          viewport.scale * Math.exp(-boundedDelta * 0.0025),
          anchor,
        ),
      );
    },
    [applyViewport, viewport],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (
        viewport.scale <= MIN_ROOF_FUSION_ZOOM ||
        !event.isPrimary ||
        event.button !== 0
      )
        return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setPanGesture({
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startViewport: viewport,
        moved: false,
      });
    },
    [viewport],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (panGesture?.pointerId !== event.pointerId) return;
      const moved =
        panGesture.moved ||
        hasRoofFusionPanGestureMoved(
          {
            clientX: panGesture.startClientX,
            clientY: panGesture.startClientY,
          },
          event,
        );
      if (!moved) return;
      const bounds = shellRef.current?.getBoundingClientRect();
      if (!bounds) return;
      event.preventDefault();
      if (!panGesture.moved) {
        setPanGesture({ ...panGesture, moved: true });
      }
      setViewport(
        panRoofFusionViewport(panGesture.startViewport, {
          x: (event.clientX - panGesture.startClientX) / (bounds.width || 1),
          y: (event.clientY - panGesture.startClientY) / (bounds.height || 1),
        }),
      );
    },
    [panGesture],
  );

  const finishPointerGesture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (
        panGesture?.pointerId === event.pointerId &&
        event.currentTarget.hasPointerCapture?.(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
      setPanGesture(null);
    },
    [panGesture],
  );

  return (
    <div data-norgeibilder-capture-viewport>
      <div
        aria-label="Norge i bilder vaizdo mastelio valdikliai"
        className="flex flex-wrap items-center gap-2 border-b border-emerald-400/20 bg-[#101820] px-3 py-2"
        data-norgeibilder-capture-viewport-controls
        role="group"
      >
        <button
          aria-label="Mažinti Norge i bilder vaizdą"
          className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={viewport.scale <= MIN_ROOF_FUSION_ZOOM}
          onClick={() => changeZoom(-0.5)}
          type="button"
        >
          Mastelis −
        </button>
        <output
          aria-label="Dabartinis Norge i bilder vaizdo mastelis"
          aria-live="polite"
          className="min-w-16 text-center text-xs font-black text-emerald-100"
          data-norgeibilder-capture-zoom-percent
        >
          {Math.round(viewport.scale * 100)}%
        </output>
        <button
          aria-label="Didinti Norge i bilder vaizdą"
          className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={viewport.scale >= MAX_ROOF_FUSION_ZOOM}
          onClick={() => changeZoom(0.5)}
          type="button"
        >
          Mastelis +
        </button>
        <button
          className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={viewport.scale === MIN_ROOF_FUSION_ZOOM}
          onClick={resetViewport}
          type="button"
        >
          Talpinti
        </button>
        <span className="text-[11px] text-[var(--an-muted)]">
          Ctrl/Cmd + ratukas keičia mastelį. Priartinus tempkite vaizdą.
        </span>
      </div>
      <div className="bg-[#080d12]">
        <div
          className={`relative mx-auto w-full overflow-hidden ${viewport.scale > MIN_ROOF_FUSION_ZOOM ? (panGesture?.moved ? "cursor-grabbing touch-none" : "cursor-grab touch-none") : "touch-pan-y"}`}
          data-norgeibilder-capture-direct-pan={
            viewport.scale > MIN_ROOF_FUSION_ZOOM ? "enabled" : "disabled"
          }
          data-norgeibilder-capture-viewport-shell
          onPointerCancel={finishPointerGesture}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerGesture}
          onWheel={handleWheel}
          ref={shellRef}
          style={{
            aspectRatio: `${imageWidth} / ${imageHeight}`,
            maxWidth: `${(480 * imageWidth) / imageHeight}px`,
          }}
        >
          <div
            className="absolute inset-0"
            data-norgeibilder-capture-viewport-content
            data-norgeibilder-capture-viewport-scale={viewport.scale}
            style={{ transform, transformOrigin: "top left" }}
          >
            {/* Protected media URLs are not compatible with the public Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Norge i bilder stogo vaizdo peržiūra"
              className="block size-full object-contain"
            />
            {overlayPoints && geoReference ? (
              <svg
                aria-label="OSM pastato kontūras"
                className="pointer-events-none absolute inset-0 size-full"
                data-norgeibilder-capture-viewport-overlay
                preserveAspectRatio="none"
                viewBox={`0 0 ${geoReference.imageWidth} ${geoReference.imageHeight}`}
              >
                <polygon
                  fill={`rgba(244,182,63,${overlayOpacity / 100})`}
                  points={overlayPoints}
                  stroke="#f4b63f"
                  strokeWidth={
                    Math.max(
                      geoReference.imageWidth,
                      geoReference.imageHeight,
                    ) / 180
                  }
                />
              </svg>
            ) : null}
          </div>
          <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/75 px-2 py-1 text-[11px] font-bold text-white">
            {attribution}
          </span>
        </div>
      </div>
    </div>
  );
}

export function NorgeIBilderCaptureControl({
  api,
  address,
  automaticCapture = false,
  captureKey,
  caseReference,
  compactWhenWorkbenchActive = false,
  leadId,
  onCaptureResultChange,
  selectedCandidateId,
  selectedFootprint,
}: {
  api?: NorgeIBilderCaptureApi;
  caseReference: string;
  automaticCapture?: boolean;
  captureKey?: string;
  compactWhenWorkbenchActive?: boolean;
  leadId?: number;
  onCaptureResultChange?: (
    result: NorgeIBilderCaptureResult | null,
    context: NorgeIBilderCaptureContext,
  ) => void;
  selectedCandidateId?: string;
  selectedFootprint?: GeoPoint[];
  address?: AddressCandidate;
}) {
  const [state, setState] = useState<CaptureState>({ kind: "idle" });
  const [overlayOpacity, setOverlayOpacity] = useState(42);
  const automaticCaptureStarted = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const capture = useCallback(
    async (reason: "automatic" | "explicit") => {
      if (!leadId || !address) return;
      const requestedCandidateId = selectedCandidateId;
      const registry = defaultCaptureDedupe;
      const dedupeKey = captureKey?.trim();
      const existing = dedupeKey ? registry.get(dedupeKey) : undefined;
      if (existing?.kind === "loading") {
        setState({ kind: "loading", attempt: 1 });
        onCaptureResultChange?.(null, {
          candidateId: requestedCandidateId,
          phase: "loading",
        });
        try {
          const result = await existing.promise;
          if (!mounted.current) return;
          setState({
            kind: "success",
            result,
            candidateId: requestedCandidateId,
          });
          onCaptureResultChange?.(result, {
            candidateId: requestedCandidateId,
            phase: "success",
          });
        } catch (error) {
          if (!mounted.current) return;
          const message =
            error instanceof Error ? error.message : "Nepavyko gauti vaizdo.";
          setState({ kind: "error", message });
          onCaptureResultChange?.(null, {
            candidateId: requestedCandidateId,
            phase: "error",
          });
        }
        return;
      }
      if (reason === "automatic" && existing?.kind === "success") {
        setState({
          kind: "success",
          result: existing.result,
          candidateId: requestedCandidateId,
        });
        onCaptureResultChange?.(existing.result, {
          candidateId: requestedCandidateId,
          phase: "success",
        });
        return;
      }
      if (reason === "automatic" && existing?.kind === "error") {
        setState({ kind: "error", message: existing.message });
        onCaptureResultChange?.(null, {
          candidateId: requestedCandidateId,
          phase: "error",
        });
        return;
      }
      // A retry after an uncertain transport failure must retain the original
      // employee-click identity. The server may already have completed and
      // stored that licensed capture even though its response did not reach
      // this browser. Reusing the click ID fails closed at the server ledger
      // instead of opening a second browser capture.
      const clickId =
        reason === "explicit" && existing?.kind === "error"
          ? existing.clickId
          : crypto.randomUUID();
      onCaptureResultChange?.(null, {
        candidateId: requestedCandidateId,
        phase: "loading",
      });
      setState({ kind: "loading", attempt: 1 });
      const capturePromise = (api ?? requestNorgeIBilderCapture)({
        clickId,
        leadId,
        address,
      }).then((result) => {
        if (!result.imageUrl) throw new Error("Tuščias vaizdo rezultatas");
        return result;
      });
      if (dedupeKey) {
        registry.set(dedupeKey, {
          kind: "loading",
          clickId,
          promise: capturePromise,
        });
      }
      try {
        const result = await capturePromise;
        if (dedupeKey)
          registry.set(dedupeKey, { kind: "success", clickId, result });
        if (!mounted.current) return;
        setState({
          kind: "success",
          result,
          ...(requestedCandidateId
            ? { candidateId: requestedCandidateId }
            : {}),
        });
        onCaptureResultChange?.(result, {
          candidateId: requestedCandidateId,
          phase: "success",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Nepavyko gauti vaizdo.";
        if (dedupeKey)
          registry.set(dedupeKey, { kind: "error", clickId, message });
        if (!mounted.current) return;
        setState({
          kind: "error",
          message,
        });
        onCaptureResultChange?.(null, {
          candidateId: requestedCandidateId,
          phase: "error",
        });
      }
    },
    [
      address,
      api,
      captureKey,
      leadId,
      onCaptureResultChange,
      selectedCandidateId,
    ],
  );

  useEffect(() => {
    if (!automaticCapture || automaticCaptureStarted.current) return;
    automaticCaptureStarted.current = true;
    void capture("automatic");
  }, [automaticCapture, capture]);

  const busy = state.kind === "loading";
  const captureResult = state.kind === "success" ? state.result : undefined;
  const selectionMatchesCapture =
    captureMatchesSelectedAddress(captureResult?.address, address) &&
    (!selectedCandidateId ||
      (state.kind === "success" && state.candidateId === selectedCandidateId));
  const overlayPoints =
    selectionMatchesCapture && selectedFootprint && captureResult?.geoReference
      ? projectWgs84ToOrthoPixels(selectedFootprint, captureResult.geoReference)
      : null;
  const rawMapImageId =
    captureResult?.mapImageId ??
    captureResult?.mediaId ??
    captureResult?.evidenceId;
  const parsedMapImageId = Number(rawMapImageId);
  const mapImageId =
    Number.isInteger(parsedMapImageId) && parsedMapImageId > 0
      ? parsedMapImageId
      : undefined;
  return (
    <section
      className={`${compactWhenWorkbenchActive && state.kind !== "error" ? "hidden" : "mt-4 rounded-2xl border border-[var(--an-border)] bg-[var(--an-surface)] p-4"}`}
      data-norgeibilder-capture="single-case"
      data-norgeibilder-capture-mode={
        compactWhenWorkbenchActive ? "unified-hidden" : "standalone"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[.16em] text-[var(--an-amber)] uppercase">
            Norge i bilder
          </p>
          <h3 className="mt-1 text-base font-black">Gauti stogo vaizdą</h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--an-muted)]">
            Vienas darbuotojo inicijuotas vaizdas pagal serverio patikrintą
            pasirinktą adresą. Nėra foninio ar masinio rinkimo. Šaltinis:
            ©norgeibilder.no.
          </p>
        </div>
        <button
          type="button"
          id={leadId ? `roof-fusion-norge-capture-${leadId}` : undefined}
          onClick={() => void capture("explicit")}
          disabled={busy || !leadId || !address}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--an-amber)] px-4 text-sm font-black text-[var(--an-amber-ink)] disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Camera aria-hidden="true" className="size-4" />
          )}
          {busy ? "Gaunamas vaizdas…" : "Gauti vaizdą iš Norge i bilder"}
        </button>
      </div>
      {!leadId || !address ? (
        <p className="mt-3 text-xs font-bold text-amber-200" role="status">
          Pasirinkite galiojantį adresą ir testinę bylą, kad galėtumėte gauti
          vaizdą.
        </p>
      ) : null}
      {state.kind === "loading" ? (
        <p className="mt-3 text-xs text-[var(--an-muted)]" role="status">
          Kraunamas žemėlapis (bandymas {state.attempt} iš 10)…
        </p>
      ) : null}
      {state.kind === "error" ? (
        <div
          className="mt-3 flex items-center gap-2 rounded-xl border border-red-400/35 bg-red-400/10 p-3 text-xs font-bold text-red-200"
          role="alert"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {state.message}
          <button
            type="button"
            onClick={() => void capture("explicit")}
            className="ml-auto inline-flex items-center gap-1 underline"
          >
            <RotateCcw className="size-3" />
            Bandyti dar kartą
          </button>
        </div>
      ) : null}
      {state.kind === "success" && !compactWhenWorkbenchActive ? (
        <div
          className="mt-4 overflow-hidden rounded-xl border border-emerald-400/35 bg-emerald-400/10"
          data-norgeibilder-preview="ready"
        >
          <div className="border-b border-emerald-400/20 px-3 py-2 text-xs text-emerald-100">
            <strong>Pasirinktas adresas:</strong>{" "}
            {state.result.addressLabel ?? "patvirtintas serverio"}
          </div>
          <NorgeIBilderCaptureViewport
            attribution={state.result.attribution ?? "©norgeibilder.no"}
            geoReference={state.result.geoReference}
            imageUrl={state.result.imageUrl}
            overlayOpacity={overlayOpacity}
            overlayPoints={overlayPoints}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black text-emerald-200">
                <CheckCircle2 className="size-4" />
                Vaizdas gautas skaičiavimui ({caseReference})
                {state.result.attempts && state.result.attempts > 1
                  ? ` · bandymai: ${state.result.attempts}`
                  : ""}
                {state.result.capturedAt ? ` · ${state.result.capturedAt}` : ""}{" "}
                · {state.result.attribution ?? "©norgeibilder.no"}
              </p>
              <p className="mt-1 text-[11px] font-bold text-[var(--an-subtle)]">
                Ortofoto · PREVIEW · review_required
              </p>
            </div>
            {overlayPoints ? (
              <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--an-muted)]">
                Overlay {overlayOpacity}%
                <input
                  aria-label="Overlay permatomumas"
                  type="range"
                  min="0"
                  max="100"
                  value={overlayOpacity}
                  onChange={(event) =>
                    setOverlayOpacity(Number(event.target.value))
                  }
                />
              </label>
            ) : null}
          </div>
          {address && state.result.address && !selectionMatchesCapture ? (
            <p
              className="mx-3 mb-3 rounded-xl border border-amber-300/35 bg-amber-300/10 p-3 text-xs font-bold text-amber-100"
              role="alert"
            >
              Paieškoje pasirinktas adresas nesutampa su bylos adresu. Stogo
              kontūras ir matavimo kūrimas išjungti, kad nebūtų susieti
              skirtingi objektai.
            </p>
          ) : null}
          {leadId &&
          mapImageId &&
          state.result.address &&
          selectionMatchesCapture ? (
            <NorgeMeasurementActions
              caseReference={caseReference}
              leadId={leadId}
              mapImageId={mapImageId}
              address={state.result.address}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
