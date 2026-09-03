"use client";

import {
  CheckCircle2,
  Camera,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import type { GeoPoint } from "@/lib/measurements/types";
import type { AddressCandidate } from "@/lib/providers/contracts";
import {
  projectWgs84ToOrthoPixels,
  type GeoReference,
} from "./norgeibilder-projection";
import type { RoofFusionPoint } from "./admin-next-roof-fusion-unified-workbench";
import { NorgeMeasurementActions } from "./norge-measurement-actions";

export type NorgeIBilderCaptureRequest = {
  leadId: number;
  clickId: string;
};

export type NorgeIBilderCaptureResult = {
  imageUrl: string;
  width?: number;
  height?: number;
  attempts?: number;
  evidenceId?: number | string;
  source?: string;
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

/** Convert the georeferenced pixel overlay into the workbench's 0..1 space. */
export function normalizeOrthoOverlayPoints(
  overlay: string | null,
  reference: GeoReference,
): RoofFusionPoint[] | null {
  if (!overlay || reference.imageWidth <= 0 || reference.imageHeight <= 0) {
    return null;
  }
  const points = overlay.trim().split(/\s+/u).map((value) => {
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
  | { kind: "success"; result: NorgeIBilderCaptureResult }
  | { kind: "error"; message: string };

export function captureMatchesSelectedAddress(
  captured: AddressCandidate | undefined,
  selected: AddressCandidate | undefined,
) {
  if (!captured || !selected) return false;
  if (captured.id.trim() === selected.id.trim()) return true;
  const normalized = (value: string) =>
    value.trim().toLocaleLowerCase("nb-NO").replace(/\s+/g, " ");
  if (
    captured.postalCode !== selected.postalCode ||
    normalized(captured.label) !== normalized(selected.label)
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

export function NorgeIBilderCaptureControl({
  api,
  address,
  caseReference,
  leadId,
  onCaptureResultChange,
  selectedFootprint,
}: {
  api?: NorgeIBilderCaptureApi;
  caseReference: string;
  leadId?: number;
  onCaptureResultChange?: (result: NorgeIBilderCaptureResult | null) => void;
  selectedFootprint?: GeoPoint[];
  address?: AddressCandidate;
}) {
  const [state, setState] = useState<CaptureState>({ kind: "idle" });
  const [overlayOpacity, setOverlayOpacity] = useState(42);

  async function capture() {
    if (!leadId) return;
    const clickId = crypto.randomUUID();
    onCaptureResultChange?.(null);
    setState({ kind: "loading", attempt: 1 });
    try {
      const captureApi =
        api ??
        (async (request: NorgeIBilderCaptureRequest) => {
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
        });
      const result = await captureApi({ clickId, leadId });
      if (!result.imageUrl) throw new Error("Tuščias vaizdo rezultatas");
      setState({ kind: "success", result });
      onCaptureResultChange?.(result);
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Nepavyko gauti vaizdo.",
      });
      onCaptureResultChange?.(null);
    }
  }

  const busy = state.kind === "loading";
  const captureResult = state.kind === "success" ? state.result : undefined;
  const selectionMatchesCapture = captureMatchesSelectedAddress(
    captureResult?.address,
    address,
  );
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
      className="mt-4 rounded-2xl border border-[var(--an-border)] bg-[var(--an-surface)] p-4"
      data-norgeibilder-capture="single-case"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[.16em] text-[var(--an-amber)] uppercase">
            Norge i bilder
          </p>
          <h3 className="mt-1 text-base font-black">Gauti stogo vaizdą</h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--an-muted)]">
            Vienas darbuotojo inicijuotas vaizdas šiai bylai pagal serverio
            patvirtintą bylos adresą. Nėra foninio ar masinio rinkimo. Šaltinis:
            ©norgeibilder.no.
          </p>
        </div>
        <button
          type="button"
          onClick={capture}
          disabled={busy || !leadId}
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
      {!leadId ? (
        <p className="mt-3 text-xs font-bold text-amber-200" role="status">
          Įveskite galiojantį bylos numerį (TF-N), kad galėtumėte gauti vaizdą.
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
            onClick={capture}
            className="ml-auto inline-flex items-center gap-1 underline"
          >
            <RotateCcw className="size-3" />
            Bandyti dar kartą
          </button>
        </div>
      ) : null}
      {state.kind === "success" ? (
        <div
          className="mt-4 overflow-hidden rounded-xl border border-emerald-400/35 bg-emerald-400/10"
          data-norgeibilder-preview="ready"
        >
          <div className="border-b border-emerald-400/20 px-3 py-2 text-xs text-emerald-100">
            <strong>Bylos adresas:</strong>{" "}
            {state.result.addressLabel ?? "patvirtintas serverio pagal bylą"}
          </div>
            <div className="relative bg-[#080d12]">
              {/* Protected media URLs are not compatible with the public Next image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
              src={state.result.imageUrl}
              alt="Norge i bilder stogo vaizdo peržiūra"
              className="block max-h-[480px] w-full object-contain"
            />
            {overlayPoints && state.result.geoReference ? (
              <svg
                aria-label="OSM pastato kontūras"
                className="pointer-events-none absolute inset-0 size-full"
                preserveAspectRatio="none"
                viewBox={`0 0 ${state.result.geoReference.imageWidth} ${state.result.geoReference.imageHeight}`}
              >
                <polygon
                  fill={`rgba(244,182,63,${overlayOpacity / 100})`}
                  points={overlayPoints}
                  stroke="#f4b63f"
                  strokeWidth={
                    Math.max(
                      state.result.geoReference.imageWidth,
                      state.result.geoReference.imageHeight,
                    ) / 180
                  }
                />
              </svg>
            ) : null}
            <span className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-1 text-[11px] font-bold text-white">
              {state.result.attribution ?? "©norgeibilder.no"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black text-emerald-200">
                <CheckCircle2 className="size-4" />
                Vaizdas pridėtas prie bylos {caseReference}
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
