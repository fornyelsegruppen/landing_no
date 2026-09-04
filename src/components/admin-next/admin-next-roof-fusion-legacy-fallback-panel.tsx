"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  calculateLegacyManualPitchGeometryV1,
  type LegacyManualPitchCalculationV1,
  LEGACY_MANUAL_PITCH_MAX_DEGREES,
  LEGACY_MANUAL_PITCH_MIN_DEGREES,
  LEGACY_MANUAL_PITCH_PRESETS,
} from "@/lib/roof-fusion/legacy-manual-pitch-calculation-v1";

export type RoofFusionLegacyFallbackSelection =
  LegacyManualPitchCalculationV1 & {
    higherAccuracyOverrideConfirmed: boolean;
    overrideJustification: string | null;
  };

export function AdminNextRoofFusionLegacyFallbackPanel({
  horizontalAreaSquareMeters,
  onSelectionChange,
  protectedResultId,
  selection,
}: {
  horizontalAreaSquareMeters: number;
  onSelectionChange: (
    selection: RoofFusionLegacyFallbackSelection | null,
  ) => void;
  protectedResultId?: string;
  selection: RoofFusionLegacyFallbackSelection | null;
}) {
  const pitchInputId = useId();
  const overrideInputId = useId();
  const overrideReasonId = useId();
  const [pitchDegrees, setPitchDegrees] = useState("32");
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState("");
  const protectedResult = Boolean(protectedResultId);
  const calculation = useMemo(
    () =>
      calculateLegacyManualPitchGeometryV1({
        horizontalAreaM2: horizontalAreaSquareMeters,
        pitchDegrees: pitchDegrees.trim() ? Number(pitchDegrees) : Number.NaN,
      }),
    [horizontalAreaSquareMeters, pitchDegrees],
  );
  const overrideReady =
    !protectedResult ||
    (overrideConfirmed && overrideJustification.trim().length >= 5);
  const canSelect = Boolean(calculation && overrideReady);

  function clearSelection() {
    onSelectionChange(null);
  }

  return (
    <section
      aria-label="Senas rankinis stogo ploto skaičiavimas"
      data-roof-fusion-legacy-fallback="manual-pitch"
    >
      <div className="flex items-start gap-2">
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-[#f3c66b]"
        />
        <div>
          <strong className="block text-sm text-[#f5f0e8]">
            Senas rankinis skaičiavimas
          </strong>
          <p className="mt-1 text-xs leading-5 text-[#aaa69d]">
            Naudokite tik tada, kai tikslesnio RF aukščio ir stogo plokštumų
            rezultato gauti nepavyksta. Šis rezultatas visada lieka rankinei
            peržiūrai ir kainodarai automatiškai neperduodamas. Pasirinkimas
            neišsaugomas ir dingsta perkrovus puslapį.
          </p>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#151c28] p-3">
          <dt className="text-[#aaa69d]">Horizontalus kontūro plotas</dt>
          <dd className="mt-1 text-base font-black text-[#f5f0e8]">
            {horizontalAreaSquareMeters.toLocaleString("lt-LT", {
              maximumFractionDigits: 1,
            })}{" "}
            m²
          </dd>
        </div>
        <label
          className="rounded-xl border border-white/10 bg-[#151c28] p-3"
          htmlFor={pitchInputId}
        >
          <span className="block text-[#aaa69d]">Žinomas nuolydis</span>
          <span className="mt-1 flex items-center gap-2">
            <input
              className="min-h-10 w-full rounded-lg border border-white/15 bg-[#0b111a] px-3 text-base font-black text-[#f5f0e8]"
              data-roof-fusion-legacy-pitch-input
              id={pitchInputId}
              list={`${pitchInputId}-presets`}
              max={LEGACY_MANUAL_PITCH_MAX_DEGREES}
              min={LEGACY_MANUAL_PITCH_MIN_DEGREES}
              onChange={(event) => {
                setPitchDegrees(event.target.value);
                clearSelection();
              }}
              step="0.1"
              type="number"
              value={pitchDegrees}
            />
            <span aria-hidden="true" className="text-base font-black">
              °
            </span>
          </span>
          <datalist id={`${pitchInputId}-presets`}>
            {LEGACY_MANUAL_PITCH_PRESETS.map((pitch) => (
              <option key={pitch} value={pitch} />
            ))}
          </datalist>
          <span className="mt-1 block text-[10px] text-[#777d86]">
            Dažniausi pasirinkimai: {LEGACY_MANUAL_PITCH_PRESETS.join("°, ")}°
          </span>
        </label>
      </dl>

      <div
        className="mt-3 rounded-xl border border-[#e8a317]/35 bg-[#e8a317]/10 p-3"
        data-roof-fusion-legacy-fallback-result={
          calculation ? "review_required" : "blocked"
        }
      >
        <span className="text-xs text-[#f3c66b]">
          Preliminarus tikras stogo plotas
        </span>
        <strong className="mt-1 block text-xl text-[#f5f0e8]">
          {calculation
            ? `${calculation.surfaceAreaM2.toLocaleString("lt-LT", {
                maximumFractionDigits: 1,
              })} m²`
            : "Patikrinkite plotą ir nuolydį"}
        </strong>
        <span className="mt-1 block text-[10px] text-[#aaa69d]">
          Formulė: horizontalus plotas ÷ cos(nuolydis) · reikalinga peržiūra
        </span>
      </div>

      {protectedResult ? (
        <div className="mt-3 rounded-xl border border-red-300/25 bg-red-400/5 p-3">
          <label
            className="flex items-start gap-2 text-xs text-[#ddd8cd]"
            htmlFor={overrideInputId}
          >
            <input
              checked={overrideConfirmed}
              className="mt-0.5 size-4 accent-[#e8a317]"
              id={overrideInputId}
              onChange={(event) => {
                setOverrideConfirmed(event.target.checked);
                clearSelection();
              }}
              type="checkbox"
            />
            <span>
              Patvirtinu, kad sąmoningai renkuosi seną rankinį metodą vietoje
              tikslesnio RF rezultato tik šiai Preview peržiūrai.
            </span>
          </label>
          <label
            className="mt-3 grid gap-1 text-xs text-[#aaa69d]"
            htmlFor={overrideReasonId}
          >
            Priežastis (bent 5 ženklai)
            <textarea
              className="min-h-20 rounded-lg border border-white/15 bg-[#0b111a] p-2 text-[#f5f0e8]"
              id={overrideReasonId}
              onChange={(event) => {
                setOverrideJustification(event.target.value);
                clearSelection();
              }}
              placeholder="Pvz., aukščio duomenis užstoja medžiai"
              value={overrideJustification}
            />
          </label>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          className="min-h-10 rounded-xl bg-[#e8a317] px-3 text-xs font-black text-[#101722] disabled:cursor-not-allowed disabled:opacity-40"
          data-roof-fusion-select-legacy-fallback
          disabled={!canSelect}
          onClick={() => {
            if (!calculation || !overrideReady) return;
            onSelectionChange({
              ...calculation,
              higherAccuracyOverrideConfirmed: protectedResult,
              overrideJustification: protectedResult
                ? overrideJustification.trim()
                : null,
            });
          }}
          type="button"
        >
          Naudoti rankinį rezultatą peržiūrai
        </button>
        {selection ? (
          <button
            className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-bold text-[#ddd8cd]"
            onClick={clearSelection}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Grįžti prie RF rezultato
          </button>
        ) : null}
      </div>
      {selection ? (
        <p
          className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-2 text-xs font-bold text-amber-100"
          data-roof-fusion-legacy-fallback-active
          role="status"
        >
          Aktyvus senas rankinis fallback:{" "}
          {selection.surfaceAreaM2.toLocaleString("lt-LT", {
            maximumFractionDigits: 1,
          })}{" "}
          m² · {selection.pitchDegrees.toLocaleString("lt-LT")}° · kainodarai
          nenaudojama.
        </p>
      ) : null}
    </section>
  );
}
