"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Layers3,
  LoaderCircle,
  MapPin,
  Ruler,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import type { AddressCandidate } from "@/lib/providers/contracts";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import type { PanelLocale } from "@/lib/panel-i18n";

export type RoofFusionUatActionState =
  | { kind: "idle" }
  | { kind: "error" }
  | {
      kind: "success";
      previewHref: string;
      snapshot: { revision: number; snapshotId: string; state: string };
      status: "prepared" | "already_prepared";
    };

export type RoofFusionAddressLookupState =
  | { kind: "idle" }
  | {
      kind: "error";
      code:
        | "INVALID_ADDRESS"
        | "ADDRESS_NOT_FOUND"
        | "BUILDING_NOT_FOUND"
        | "PROVIDER_UNAVAILABLE";
      resolvedAddress?: string;
    }
  | {
      kind: "success";
      address: AddressCandidate;
      candidates: BuildingFootprintCandidate[];
    };

const initialState: RoofFusionUatActionState = { kind: "idle" };
const initialAddressState: RoofFusionAddressLookupState = { kind: "idle" };

const copy = {
  nb: {
    eyebrow: "Roof Fusion · beskyttet Preview",
    title: "Klargjør syntetisk R4 UAT-måling",
    intro:
      "Oppretter bare den deterministiske golden-serien for den valgte testsaken. Ingen kundevarsler eller produksjonsdata berøres.",
    caseLabel: "Testsak",
    action: "Klargjør R4 UAT",
    working: "Klargjør …",
    ready: "R4 UAT er klart",
    existing: "R4 UAT var allerede klart",
    open: "Åpne canonical R4-visning",
    failure: "UAT-klargjøringen mislyktes. Ingen produksjonsdata ble endret.",
    guard: "Kun Preview · eksplisitt adminhandling · idempotent",
    addressEyebrow: "Gratis realadressekontroll",
    addressTitle: "Finn riktig bygning før ortofoto kobles til",
    addressIntro:
      "Kartverket løser adressen og OpenStreetMap viser faktiske bygningskonturer. Oppslaget lagres ikke og oppretter ingen måling.",
    addressLabel: "Adresse med husnummer og poststed",
    addressPlaceholder: "Eksempel: Storgata 1, Oslo",
    addressAction: "Finn bygning",
    addressWorking: "Søker …",
    candidateLabel: "Velg riktig bygning",
    footprint: "Horisontalt fotavtrykk",
    distance: "Avstand til adressepunkt",
    confidence: "Treffsikkerhet",
    contains: "Adressepunktet ligger i konturen",
    source: "Åpne OSM-kilden",
    opacity: "Geometriens gjennomsiktighet",
    overlay: "Vis geometrilag",
    imageryPending: "Ortofoto kobles til etter lisensiert tilgang",
    preliminary:
      "Dette er et gratis, foreløpig bygningsfotavtrykk – ikke ferdige takflater eller godkjent takareal.",
    addressGuard: "Kun Preview · lagres ikke · ingen kundehandlinger",
    addressErrors: {
      INVALID_ADDRESS: "Skriv inn en fullstendig adresse på 4–180 tegn.",
      ADDRESS_NOT_FOUND:
        "Kartverket fant ikke adressen. Kontroller husnummer og poststed.",
      BUILDING_NOT_FOUND:
        "Adressen ble funnet, men ingen brukbar OSM-bygning lå i nærheten.",
      PROVIDER_UNAVAILABLE:
        "Adresse- eller bygningstjenesten er midlertidig utilgjengelig.",
    },
  },
  lt: {
    eyebrow: "Roof Fusion · apsaugotas Preview",
    title: "Paruošti sintetinį R4 UAT matavimą",
    intro:
      "Sukuriama tik deterministinė golden seka pasirinktai testinei bylai. Klientams niekas nesiunčiama, Production duomenys neliečiami.",
    caseLabel: "Testinė byla",
    action: "Paruošti R4 UAT",
    working: "Ruošiama…",
    ready: "R4 UAT paruoštas",
    existing: "R4 UAT jau buvo paruoštas",
    open: "Atidaryti canonical R4 peržiūrą",
    failure: "UAT paruošimas nepavyko. Production duomenys nepakeisti.",
    guard: "Tik Preview · aiškus admin veiksmas · idempotentinis",
    addressEyebrow: "Nemokamas realaus adreso patikrinimas",
    addressTitle: "Rasti tikrą pastatą prieš prijungiant ortofoto",
    addressIntro:
      "Kartverket suranda adresą, o OpenStreetMap parodo realius pastatų kontūrus. Paieška neišsaugoma ir nesukuria matavimo.",
    addressLabel: "Adresas su namo numeriu ir miestu",
    addressPlaceholder: "Pavyzdžiui: Storgata 1, Oslo",
    addressAction: "Rasti pastatą",
    addressWorking: "Ieškoma…",
    candidateLabel: "Pasirinkti teisingą pastatą",
    footprint: "Horizontalus kontūro plotas",
    distance: "Atstumas iki adreso taško",
    confidence: "Atitikimo patikimumas",
    contains: "Adreso taškas yra kontūro viduje",
    source: "Atidaryti OSM šaltinį",
    opacity: "Geometrijos permatomumas",
    overlay: "Rodyti geometrijos sluoksnį",
    imageryPending: "Ortofoto bus prijungtas gavus licencijuotą prieigą",
    preliminary:
      "Tai nemokamas preliminarus pastato kontūras – dar ne galutiniai stogo šlaitai ar patvirtintas stogo plotas.",
    addressGuard: "Tik Preview · neišsaugoma · be kliento veiksmų",
    addressErrors: {
      INVALID_ADDRESS: "Įveskite pilną 4–180 ženklų adresą.",
      ADDRESS_NOT_FOUND:
        "Kartverket adreso nerado. Patikrinkite namo numerį ir miestą.",
      BUILDING_NOT_FOUND:
        "Adresas rastas, bet šalia nėra tinkamo OSM pastato kontūro.",
      PROVIDER_UNAVAILABLE:
        "Adresų arba pastatų paslauga laikinai nepasiekiama.",
    },
  },
  en: {
    eyebrow: "Roof Fusion · protected Preview",
    title: "Prepare a synthetic R4 UAT measurement",
    intro:
      "Creates only the deterministic golden sequence for the selected test case. It sends nothing to customers and never touches Production data.",
    caseLabel: "Test case",
    action: "Prepare R4 UAT",
    working: "Preparing…",
    ready: "R4 UAT is ready",
    existing: "R4 UAT was already ready",
    open: "Open canonical R4 review",
    failure: "UAT preparation failed. No Production data was changed.",
    guard: "Preview only · explicit admin action · idempotent",
    addressEyebrow: "Free real-address check",
    addressTitle: "Find the real building before imagery is connected",
    addressIntro:
      "Kartverket resolves the address and OpenStreetMap returns real building footprints. The lookup is not stored and creates no measurement.",
    addressLabel: "Address with house number and city",
    addressPlaceholder: "Example: Storgata 1, Oslo",
    addressAction: "Find building",
    addressWorking: "Searching…",
    candidateLabel: "Choose the correct building",
    footprint: "Horizontal footprint",
    distance: "Distance to address point",
    confidence: "Match confidence",
    contains: "Address point is inside the footprint",
    source: "Open the OSM source",
    opacity: "Geometry opacity",
    overlay: "Show geometry layer",
    imageryPending: "Orthophoto will be connected after licensed access",
    preliminary:
      "This is a free preliminary building footprint, not final roof planes or an approved roof area.",
    addressGuard: "Preview only · not stored · no customer actions",
    addressErrors: {
      INVALID_ADDRESS: "Enter a complete address between 4 and 180 characters.",
      ADDRESS_NOT_FOUND:
        "Kartverket did not find the address. Check the house number and city.",
      BUILDING_NOT_FOUND:
        "The address was found, but no usable OSM building was nearby.",
      PROVIDER_UNAVAILABLE:
        "The address or building service is temporarily unavailable.",
    },
  },
} as const;

type ProjectedCandidate = {
  id: string;
  points: string;
};

function projectCandidates(
  address: AddressCandidate,
  candidates: BuildingFootprintCandidate[],
) {
  const originLatitude = address.latitude;
  const cosine = Math.max(Math.cos((originLatitude * Math.PI) / 180), 0.1);
  const toMeters = (point: { latitude: number; longitude: number }) => ({
    x: (point.longitude - address.longitude) * 111_320 * cosine,
    y: (point.latitude - address.latitude) * 111_320,
  });
  const projected = candidates.map((candidate) => ({
    id: candidate.id,
    points: candidate.polygon.map(toMeters),
  }));
  const all = projected
    .flatMap((candidate) => candidate.points)
    .concat({ x: 0, y: 0 });
  const minX = Math.min(...all.map((point) => point.x));
  const maxX = Math.max(...all.map((point) => point.x));
  const minY = Math.min(...all.map((point) => point.y));
  const maxY = Math.max(...all.map((point) => point.y));
  const width = Math.max(maxX - minX, 12);
  const height = Math.max(maxY - minY, 12);
  const padding = 32;
  const scale = Math.min(
    (620 - padding * 2) / width,
    (330 - padding * 2) / height,
  );
  const offsetX = (620 - width * scale) / 2;
  const offsetY = (330 - height * scale) / 2;
  const project = (point: { x: number; y: number }) => ({
    x: offsetX + (point.x - minX) * scale,
    y: 330 - offsetY - (point.y - minY) * scale,
  });
  return {
    addressPoint: project({ x: 0, y: 0 }),
    candidates: projected.map<ProjectedCandidate>((candidate) => ({
      id: candidate.id,
      points: candidate.points
        .map(project)
        .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(" "),
    })),
  };
}

function formatMetric(locale: PanelLocale, value: number) {
  return new Intl.NumberFormat(
    locale === "lt" ? "lt-LT" : locale === "nb" ? "nb-NO" : "en-GB",
    { maximumFractionDigits: 1 },
  ).format(value);
}

export function RealAddressResult({
  locale,
  result,
}: {
  locale: PanelLocale;
  result: Extract<RoofFusionAddressLookupState, { kind: "success" }>;
}) {
  const t = copy[locale];
  const [selectedId, setSelectedId] = useState(result.candidates[0]?.id ?? "");
  const [opacity, setOpacity] = useState(38);
  const [showOverlay, setShowOverlay] = useState(true);
  const selected =
    result.candidates.find((candidate) => candidate.id === selectedId) ??
    result.candidates[0];
  const projected = useMemo(
    () => projectCandidates(result.address, result.candidates),
    [result.address, result.candidates],
  );

  if (!selected) return null;

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="overflow-hidden rounded-2xl border border-[var(--an-border)] bg-[var(--an-canvas)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--an-border)] px-4 py-3">
          <div>
            <strong className="block text-sm">{result.address.label}</strong>
            <span className="text-[10px] text-[var(--an-subtle)]">
              {result.address.latitude.toFixed(6)},{" "}
              {result.address.longitude.toFixed(6)} · Kartverket
            </span>
          </div>
          <span className="rounded-full border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] px-2 py-1 text-[9px] font-bold text-[var(--an-amber)]">
            {t.imageryPending}
          </span>
        </div>
        <div className="relative bg-[linear-gradient(rgba(111,132,151,.10)_1px,transparent_1px),linear-gradient(90deg,rgba(111,132,151,.10)_1px,transparent_1px),radial-gradient(circle_at_50%_45%,#182532,#0b1118_72%)] bg-[size:24px_24px,24px_24px,auto] p-3">
          <svg
            aria-label={t.candidateLabel}
            className="h-auto w-full"
            role="img"
            viewBox="0 0 620 330"
          >
            {showOverlay
              ? projected.candidates.map((candidate) => {
                  const active = candidate.id === selected.id;
                  return (
                    <polygon
                      fill={
                        active
                          ? `rgba(244,182,63,${opacity / 100})`
                          : "rgba(111,132,151,.10)"
                      }
                      key={candidate.id}
                      points={candidate.points}
                      stroke={active ? "#f4b63f" : "#6f8497"}
                      strokeWidth={active ? 4 : 2}
                    />
                  );
                })
              : null}
            <circle
              cx={projected.addressPoint.x}
              cy={projected.addressPoint.y}
              fill="#ef4444"
              r="7"
              stroke="#fff"
              strokeWidth="3"
            />
          </svg>
          <span className="pointer-events-none absolute right-4 bottom-4 rounded-lg border border-[var(--an-border)] bg-black/65 px-2 py-1 text-[9px] text-[var(--an-muted)]">
            © OpenStreetMap contributors · ODbL 1.0
          </span>
        </div>
        <div className="grid gap-3 border-t border-[var(--an-border)] p-4 sm:grid-cols-2">
          <label className="grid gap-2 text-xs font-bold">
            {t.opacity}: {opacity}%
            <input
              className="accent-[var(--an-amber)]"
              max="80"
              min="10"
              onChange={(event) => setOpacity(Number(event.target.value))}
              type="range"
              value={opacity}
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              checked={showOverlay}
              className="size-4 accent-[var(--an-amber)]"
              onChange={(event) => setShowOverlay(event.target.checked)}
              type="checkbox"
            />
            {t.overlay}
          </label>
        </div>
      </div>

      <div className="grid content-start gap-3">
        <label className="grid gap-2 text-xs font-bold">
          {t.candidateLabel}
          <select
            className="min-h-11 rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] px-3 text-sm"
            onChange={(event) => setSelectedId(event.target.value)}
            value={selected.id}
          >
            {result.candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <dl className="grid gap-2 text-xs">
          <div className="an-elevated rounded-xl border p-3">
            <dt className="text-[var(--an-subtle)]">{t.footprint}</dt>
            <dd className="mt-1 text-base font-black">
              {formatMetric(locale, selected.horizontalAreaSquareMeters)} m²
            </dd>
          </div>
          <div className="an-elevated rounded-xl border p-3">
            <dt className="text-[var(--an-subtle)]">{t.distance}</dt>
            <dd className="mt-1 font-bold">
              {formatMetric(locale, selected.distanceToAddressMeters)} m
            </dd>
          </div>
          <div className="an-elevated rounded-xl border p-3">
            <dt className="text-[var(--an-subtle)]">{t.confidence}</dt>
            <dd className="mt-1 font-bold uppercase">{selected.confidence}</dd>
          </div>
        </dl>
        {selected.containsAddress ? (
          <p className="an-success rounded-xl border p-3 text-xs font-bold">
            <CheckCircle2 aria-hidden="true" className="mr-2 inline size-4" />
            {t.contains}
          </p>
        ) : null}
        <a
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--an-border)] px-4 text-xs font-black hover:border-[var(--an-amber)]"
          href={selected.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          {t.source}
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
      <p className="rounded-xl border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] p-3 text-xs font-semibold text-[var(--an-amber)] xl:col-span-2">
        {t.preliminary}
      </p>
    </div>
  );
}

export function AdminNextRoofFusionUatControl({
  action,
  addressLookupAction,
  defaultCaseReference = "TF-13",
  locale,
}: {
  action: (
    previousState: RoofFusionUatActionState,
    formData: FormData,
  ) => Promise<RoofFusionUatActionState>;
  addressLookupAction: (
    previousState: RoofFusionAddressLookupState,
    formData: FormData,
  ) => Promise<RoofFusionAddressLookupState>;
  defaultCaseReference?: string;
  locale: PanelLocale;
}) {
  const t = copy[locale];
  const [state, formAction, pending] = useActionState(action, initialState);
  const [addressState, addressFormAction, addressPending] = useActionState(
    addressLookupAction,
    initialAddressState,
  );

  return (
    <div
      className="mx-auto grid max-w-5xl gap-6"
      data-admin-next-section="cases"
    >
      <section
        aria-labelledby="roof-fusion-uat-title"
        className="rounded-3xl border border-[var(--an-border)] bg-[var(--an-surface)] p-5 shadow-2xl sm:p-8"
        data-roof-fusion-uat="preview-only"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--an-amber-soft)] text-[var(--an-amber)]">
            <Ruler aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-xs font-black tracking-[.18em] text-[var(--an-amber)] uppercase">
              {t.eyebrow}
            </p>
            <h1
              className="mt-2 text-2xl font-black sm:text-3xl"
              id="roof-fusion-uat-title"
            >
              {t.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--an-muted)]">
              {t.intro}
            </p>
          </div>
        </div>

        <form
          action={formAction}
          className="mt-7 grid gap-4 sm:grid-cols-[1fr_auto]"
        >
          <label
            className="grid gap-2 text-sm font-bold"
            htmlFor="roof-fusion-uat-case"
          >
            {t.caseLabel}
            <input
              autoCapitalize="characters"
              className="min-h-12 rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] px-4 font-mono text-[var(--an-text)] outline-none focus:border-[var(--an-amber)]"
              defaultValue={defaultCaseReference}
              id="roof-fusion-uat-case"
              name="caseReference"
              pattern="TF-[1-9][0-9]*"
              required
            />
          </label>
          <button
            className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--an-amber)] px-5 font-black text-[var(--an-amber-ink)] disabled:cursor-wait disabled:opacity-70"
            disabled={pending}
            type="submit"
          >
            {pending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
            ) : (
              <ShieldCheck aria-hidden="true" className="size-5" />
            )}
            {pending ? t.working : t.action}
          </button>
        </form>

        <p className="mt-3 text-xs font-semibold text-[var(--an-subtle)]">
          {t.guard}
        </p>

        {state.kind === "success" ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 p-4">
            <div className="flex items-center gap-2 font-black text-emerald-300">
              <CheckCircle2 aria-hidden="true" className="size-5" />
              {state.status === "prepared" ? t.ready : t.existing}
            </div>
            <p className="mt-2 text-xs text-[var(--an-muted)]">
              {state.snapshot.snapshotId} · r{state.snapshot.revision} ·{" "}
              {state.snapshot.state}
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-emerald-300/35 px-4 text-sm font-black text-emerald-200 hover:bg-emerald-300/10"
              href={state.previewHref}
            >
              {t.open}
            </Link>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <p
            className="mt-6 rounded-2xl border border-red-400/35 bg-red-400/10 p-4 text-sm font-bold text-red-200"
            role="alert"
          >
            {t.failure}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="roof-fusion-address-title"
        className="rounded-3xl border border-[var(--an-border)] bg-[var(--an-surface)] p-5 shadow-2xl sm:p-8"
        data-roof-fusion-address="lookup-only"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--an-amber-soft)] text-[var(--an-amber)]">
            <MapPin aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-xs font-black tracking-[.18em] text-[var(--an-amber)] uppercase">
              {t.addressEyebrow}
            </p>
            <h2
              className="mt-2 text-2xl font-black"
              id="roof-fusion-address-title"
            >
              {t.addressTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--an-muted)]">
              {t.addressIntro}
            </p>
          </div>
        </div>
        <form
          action={addressFormAction}
          className="mt-7 grid gap-4 sm:grid-cols-[1fr_auto]"
        >
          <label
            className="grid gap-2 text-sm font-bold"
            htmlFor="roof-fusion-address-query"
          >
            {t.addressLabel}
            <input
              autoComplete="street-address"
              className="min-h-12 rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] px-4 text-[var(--an-text)] outline-none focus:border-[var(--an-amber)]"
              id="roof-fusion-address-query"
              maxLength={180}
              minLength={4}
              name="addressQuery"
              placeholder={t.addressPlaceholder}
              required
            />
          </label>
          <button
            className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--an-amber)] px-5 font-black text-[var(--an-amber-ink)] disabled:cursor-wait disabled:opacity-70"
            disabled={addressPending}
            type="submit"
          >
            {addressPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
            ) : (
              <Search aria-hidden="true" className="size-5" />
            )}
            {addressPending ? t.addressWorking : t.addressAction}
          </button>
        </form>
        <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--an-subtle)]">
          <Layers3 aria-hidden="true" className="size-4" />
          {t.addressGuard}
        </p>
        {addressState.kind === "success" ? (
          <RealAddressResult
            key={`${addressState.address.id}:${addressState.candidates.map((candidate) => candidate.id).join(",")}`}
            locale={locale}
            result={addressState}
          />
        ) : null}
        {addressState.kind === "error" ? (
          <p
            className="mt-6 rounded-2xl border border-red-400/35 bg-red-400/10 p-4 text-sm font-bold text-red-200"
            role="alert"
          >
            {t.addressErrors[addressState.code]}
            {addressState.resolvedAddress
              ? ` (${addressState.resolvedAddress})`
              : ""}
          </p>
        ) : null}
      </section>
    </div>
  );
}
