"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Layers3,
  LoaderCircle,
  MapPin,
  Mountain,
  Ruler,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import type { AddressCandidate } from "@/lib/providers/contracts";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import type { RoofFusionHeightSurfacePreviewSummaryV1 } from "@/lib/roof-fusion/hoydedata-surface-preview-v1";
import type { HeightSurfaceVisualizationV1 } from "@/lib/roof-fusion/hoydedata-surface-visualization-v1";
import type { RoofFusionOsmFootprintPreviewSummaryV1 } from "@/lib/roof-fusion/osm-footprint-preview-v1";
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
      enginePreviews: Array<
        | {
            kind: "success";
            candidateId: string;
            summary: RoofFusionOsmFootprintPreviewSummaryV1;
          }
        | { kind: "error"; candidateId: string }
      >;
    };

export type RoofFusionHeightAnalysisState =
  | { kind: "idle" }
  | {
      kind: "error";
      code:
        "INVALID_SELECTION" | "HEIGHT_DATA_UNAVAILABLE" | "ROOF_NOT_DETECTED";
    }
  | {
      kind: "success";
      candidateId: string;
      summary: RoofFusionHeightSurfacePreviewSummaryV1;
      visualization: HeightSurfaceVisualizationV1;
    };

const initialState: RoofFusionUatActionState = { kind: "idle" };
const initialAddressState: RoofFusionAddressLookupState = { kind: "idle" };
const initialHeightState: RoofFusionHeightAnalysisState = { kind: "idle" };

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
    addressTitle: "Finn bygningen og les den frie høydemodellen",
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
    imageryPending: "Velg bygning og hent fri 1 m høydemodell",
    preliminary:
      "Dette er et gratis, foreløpig bygningsfotavtrykk – ikke ferdige takflater eller godkjent takareal.",
    heightAction: "Hent virkelig takflate",
    heightWorking: "Leser DOM og DTM …",
    heightTitle: "Virkelig 1 m høydeoverflate",
    heightIntro:
      "Skyggerelieff er laget av Kartverkets åpne DOM minus DTM. Den gule konturen er valgt OSM-bygning; dette er høydedata, ikke et foto.",
    heightStatus: "Status",
    heightStatusPreview: "PREVIEW",
    heightRoofCells: "Takpunkter i konturen",
    heightMedian: "Median takhøyde",
    heightRange: "Robust høydeintervall",
    heightPlaneCount: "Takflate-overlay",
    heightSurfaceArea: "Reelt takflateareal",
    heightPitches: "Takvinkler",
    heightRidge: "Mønelinje",
    heightPlaneLabel: "Takflate",
    heightSlopeOverlayTitle: "Segmenterte takflater",
    heightSlopeOverlayReady: "Samregistrert mot den virkelige høydeoverflaten",
    heightSlopeOverlayPending: "Takflatene er ikke segmentert ennå",
    heightSource: "Kartverket Høydedata · NLOD 2.0",
    heightErrors: {
      INVALID_SELECTION: "Bygningen må velges på nytt.",
      HEIGHT_DATA_UNAVAILABLE:
        "Kartverkets høydedata er midlertidig utilgjengelige for denne konturen.",
      ROOF_NOT_DETECTED:
        "Høydemodellen viser ikke en sammenhengende takflate. Bruk manuell kontroll.",
    },
    heightBlockers: {
      ROOF_PLANES_REQUIRED: "Takflatene må fortsatt segmenteres",
      ROOF_PITCH_REQUIRED: "Takvinklene må fortsatt beregnes og kontrolleres",
      ROOF_SURFACE_RENDER_REQUIRED: "Høydevisningen må godkjennes i UAT",
    },
    engineTitle: "Roof Fusion Preview-motor",
    contractValid: "Motorkontrakt gyldig",
    reviewRequired: "Manuell kontroll kreves",
    notPricingReady: "IKKE KLAR FOR PRISING",
    engineFootprint: "Motorens horisontale fotavtrykk",
    enginePerimeter: "Beregnet omkrets",
    areaParity: "Avvik fra OSM-arealet",
    integrity: "Deterministisk integritet",
    calculationHash: "Beregning",
    snapshotHash: "Snapshot",
    renderHash: "Visning",
    blockersTitle: "Mangler før godkjent takmåling",
    engineUnavailable:
      "Denne konturen kunne ikke valideres av Roof Fusion-motoren. Velg en annen bygning.",
    blockers: {
      ROOF_PLANES_REQUIRED: "Faktiske takflater må identifiseres",
      ROOF_PITCH_REQUIRED: "Takvinkel må måles eller bekreftes",
      LICENSED_IMAGERY_REQUIRED: "Lisensiert ortofoto må kobles til",
    },
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
    addressTitle: "Rasti pastatą ir nuskaityti nemokamą aukščių modelį",
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
    imageryPending:
      "Pasirinkite pastatą ir gaukite nemokamą 1 m aukščių modelį",
    preliminary:
      "Tai nemokamas preliminarus pastato kontūras – dar ne galutiniai stogo šlaitai ar patvirtintas stogo plotas.",
    heightAction: "Gauti tikrą stogo paviršių",
    heightWorking: "Skaitomi DOM ir DTM…",
    heightTitle: "Tikras 1 m aukščio paviršius",
    heightIntro:
      "Reljefo vaizdas sukurtas iš atvirų Kartverket DOM minus DTM duomenų. Geltonas kontūras yra pasirinktas OSM pastatas; tai aukščio modelis, ne fotografija.",
    heightStatus: "Statusas",
    heightStatusPreview: "PREVIEW",
    heightRoofCells: "Stogo taškai kontūre",
    heightMedian: "Medianinis stogo aukštis",
    heightRange: "Patikimas aukščio intervalas",
    heightPlaneCount: "Šlaitų sluoksniai",
    heightSurfaceArea: "Tikras stogo paviršius",
    heightPitches: "Nuolydžiai",
    heightRidge: "Kraigo linija",
    heightPlaneLabel: "Šlaitas",
    heightSlopeOverlayTitle: "Segmentuoti stogo šlaitai",
    heightSlopeOverlayReady: "Sulyginta su tikru aukščio paviršiumi",
    heightSlopeOverlayPending: "Stogo šlaitai dar nesegmentuoti",
    heightSource: "Kartverket Høydedata · NLOD 2.0",
    heightErrors: {
      INVALID_SELECTION: "Pastatą reikia pasirinkti iš naujo.",
      HEIGHT_DATA_UNAVAILABLE:
        "Šiam kontūrui Kartverket aukščio duomenys laikinai nepasiekiami.",
      ROOF_NOT_DETECTED:
        "Aukščio modelyje nėra vientiso stogo paviršiaus. Reikia rankinės peržiūros.",
    },
    heightBlockers: {
      ROOF_PLANES_REQUIRED: "Dar reikia suskaidyti tikrus stogo šlaitus",
      ROOF_PITCH_REQUIRED: "Dar reikia apskaičiuoti ir patikrinti nuolydžius",
      ROOF_SURFACE_RENDER_REQUIRED: "Aukščio vaizdą reikia patvirtinti UAT",
    },
    engineTitle: "Roof Fusion Preview variklis",
    contractValid: "Variklio kontraktas galioja",
    reviewRequired: "Reikalinga rankinė peržiūra",
    notPricingReady: "DAR NETINKA KAINODARAI",
    engineFootprint: "Variklio horizontalus kontūras",
    enginePerimeter: "Apskaičiuotas perimetras",
    areaParity: "Skirtumas nuo OSM ploto",
    integrity: "Deterministinė kontrolė",
    calculationHash: "Skaičiavimas",
    snapshotHash: "Snapshot",
    renderHash: "Atvaizdavimas",
    blockersTitle: "Ko trūksta iki patvirtinto stogo matavimo",
    engineUnavailable:
      "Šio kontūro Roof Fusion variklis nepatvirtino. Pasirinkite kitą pastatą.",
    blockers: {
      ROOF_PLANES_REQUIRED: "Reikia nustatyti tikrus stogo šlaitus",
      ROOF_PITCH_REQUIRED: "Reikia išmatuoti arba patvirtinti nuolydį",
      LICENSED_IMAGERY_REQUIRED: "Reikia prijungti licencijuotą ortofoto",
    },
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
    addressTitle: "Find the building and read the free height model",
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
    imageryPending: "Select a building and fetch the free 1 m height model",
    preliminary:
      "This is a free preliminary building footprint, not final roof planes or an approved roof area.",
    heightAction: "Fetch real roof surface",
    heightWorking: "Reading DOM and DTM…",
    heightTitle: "Real 1 m height surface",
    heightIntro:
      "The shaded surface is derived from open Kartverket DOM minus DTM data. The amber outline is the selected OSM building; this is elevation data, not a photograph.",
    heightStatus: "Status",
    heightStatusPreview: "PREVIEW",
    heightRoofCells: "Roof cells in footprint",
    heightMedian: "Median roof height",
    heightRange: "Robust height range",
    heightPlaneCount: "Roof plane overlays",
    heightSurfaceArea: "Real roof surface area",
    heightPitches: "Roof pitches",
    heightRidge: "Ridge line",
    heightPlaneLabel: "Plane",
    heightSlopeOverlayTitle: "Segmented roof planes",
    heightSlopeOverlayReady: "Co-registered against the real height surface",
    heightSlopeOverlayPending: "Roof planes are not segmented yet",
    heightSource: "Kartverket Høydedata · NLOD 2.0",
    heightErrors: {
      INVALID_SELECTION: "Select the building again.",
      HEIGHT_DATA_UNAVAILABLE:
        "Kartverket height data is temporarily unavailable for this footprint.",
      ROOF_NOT_DETECTED:
        "The height model does not show a continuous roof surface. Use manual review.",
    },
    heightBlockers: {
      ROOF_PLANES_REQUIRED: "Actual roof planes still need segmentation",
      ROOF_PITCH_REQUIRED: "Roof pitches still need calculation and review",
      ROOF_SURFACE_RENDER_REQUIRED: "The height view must pass UAT review",
    },
    engineTitle: "Roof Fusion Preview engine",
    contractValid: "Engine contract valid",
    reviewRequired: "Manual review required",
    notPricingReady: "NOT READY FOR PRICING",
    engineFootprint: "Engine horizontal footprint",
    enginePerimeter: "Calculated perimeter",
    areaParity: "Difference from OSM area",
    integrity: "Deterministic integrity",
    calculationHash: "Calculation",
    snapshotHash: "Snapshot",
    renderHash: "Render",
    blockersTitle: "Missing before an approved roof measurement",
    engineUnavailable:
      "Roof Fusion could not validate this footprint. Select another building.",
    blockers: {
      ROOF_PLANES_REQUIRED: "Actual roof planes must be identified",
      ROOF_PITCH_REQUIRED: "Roof pitch must be measured or confirmed",
      LICENSED_IMAGERY_REQUIRED: "Licensed orthophoto must be connected",
    },
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

const planeOverlayPalette = [
  { fill: "34,197,94", stroke: "#4ade80" },
  { fill: "56,189,248", stroke: "#7dd3fc" },
  { fill: "249,115,22", stroke: "#fb923c" },
  { fill: "217,70,239", stroke: "#e879f9" },
] as const;

function overlayFill(rgb: string, opacity: number) {
  return `rgba(${rgb},${opacity})`;
}

export function HeightAnalysisPanel({
  locale,
  state,
}: {
  locale: PanelLocale;
  state: Extract<RoofFusionHeightAnalysisState, { kind: "success" }>;
}) {
  const t = copy[locale];
  const planes = state.visualization.planes ?? [];
  const hasPlaneSegmentation = planes.length > 0;
  const totalSurfaceAreaSquareMeters = planes.reduce(
    (sum, plane) => sum + plane.surfaceAreaSquareMeters,
    0,
  );
  return (
    <section
      aria-label={t.heightTitle}
      className="overflow-hidden rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] xl:col-span-2"
      data-roof-fusion-height-contract="valid-review-required"
      data-roof-fusion-height-segmentation={
        hasPlaneSegmentation ? "present" : "pending"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--an-border)] p-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black">
            <Mountain aria-hidden="true" className="size-5 text-emerald-300" />
            {t.heightTitle}
          </h3>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--an-muted)]">
            {t.heightIntro}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase">
            <span className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-1 text-emerald-300">
              {t.contractValid}
            </span>
            <span className="rounded-full border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] px-2 py-1 text-[var(--an-amber)]">
              {t.reviewRequired}
            </span>
          </div>
        </div>
        <strong className="rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          {t.notPricingReady}
        </strong>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.95fr)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
            <span className="text-[10px] text-[var(--an-subtle)]">
              {t.engineFootprint}
            </span>
            <strong className="mt-1 block text-lg">
              {formatMetric(
                locale,
                state.summary.engineHorizontalAreaSquareMeters,
              )}{" "}
              m²
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
            <span className="text-[10px] text-[var(--an-subtle)]">
              {t.heightRoofCells}
            </span>
            <strong className="mt-1 block text-lg">
              {state.summary.roofCells}/{state.summary.footprintCells}
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
            <span className="text-[10px] text-[var(--an-subtle)]">
              {t.heightMedian}
            </span>
            <strong className="mt-1 block text-lg">
              {formatMetric(locale, state.summary.roofHeightMedianM)} m
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
            <span className="text-[10px] text-[var(--an-subtle)]">
              {t.heightRange}
            </span>
            <strong className="mt-1 block text-lg">
              {formatMetric(locale, state.summary.roofHeightP10M)}–
              {formatMetric(locale, state.summary.roofHeightP90M)} m
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
            <span className="text-[10px] text-[var(--an-subtle)]">
              {t.heightPlaneCount}
            </span>
            <strong className="mt-1 block text-lg">
              {hasPlaneSegmentation ? planes.length : "—"}
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
            <span className="text-[10px] text-[var(--an-subtle)]">
              {t.heightSurfaceArea}
            </span>
            <strong className="mt-1 block text-lg">
              {hasPlaneSegmentation
                ? `${formatMetric(locale, totalSurfaceAreaSquareMeters)} m²`
                : "—"}
            </strong>
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
            <strong className="text-xs">{t.heightStatus}</strong>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase">
              <span className="rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-1 text-sky-200">
                {t.heightStatusPreview}
              </span>
              <span className="rounded-full border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] px-2 py-1 text-[var(--an-amber)]">
                {t.reviewRequired}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
            <strong className="text-xs">{t.heightSlopeOverlayTitle}</strong>
            <p className="mt-2 text-[10px] text-[var(--an-subtle)]">
              {hasPlaneSegmentation
                ? t.heightSlopeOverlayReady
                : t.heightSlopeOverlayPending}
            </p>
            {hasPlaneSegmentation ? (
              <ul
                aria-label={t.heightPitches}
                className="mt-3 grid gap-2 text-xs text-[var(--an-muted)]"
              >
                {planes.map((plane, index) => {
                  const palette =
                    planeOverlayPalette[index % planeOverlayPalette.length];
                  return (
                    <li
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--an-border)] bg-[var(--an-elevated)] px-3 py-2"
                      key={plane.planeId}
                    >
                      <span className="flex items-center gap-2 font-semibold text-[var(--an-text)]">
                        <span
                          aria-hidden="true"
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: palette.stroke }}
                        />
                        {t.heightPlaneLabel} {index + 1}
                      </span>
                      <span className="text-right text-[10px]">
                        {formatMetric(locale, plane.pitchDegrees)}° ·{" "}
                        {formatMetric(locale, plane.surfaceAreaSquareMeters)} m²
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-[var(--an-muted)]">
                {t.heightBlockers.ROOF_PLANES_REQUIRED}
              </p>
            )}
            {state.visualization.ridge ? (
              <p className="mt-3 text-[10px] font-semibold text-[var(--an-subtle)]">
                {t.heightRidge}:{" "}
                {formatMetric(locale, state.visualization.ridge.lengthMeters)} m
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
            <strong className="text-xs">{t.blockersTitle}</strong>
            <ul className="mt-3 grid gap-2 text-xs text-[var(--an-muted)]">
              {state.summary.blockers.map((blocker) => (
                <li className="flex gap-2" key={blocker}>
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-[var(--an-amber)]"
                  />
                  {t.heightBlockers[blocker]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <details className="border-t border-[var(--an-border)] px-4 py-3 text-xs">
        <summary className="cursor-pointer font-bold text-[var(--an-muted)]">
          {t.integrity} · {t.heightSource}
        </summary>
        <dl className="mt-3 grid gap-2 font-mono text-[10px] text-[var(--an-subtle)] sm:grid-cols-3">
          <div>
            <dt>{t.calculationHash}</dt>
            <dd title={state.summary.calculationHash}>
              {state.summary.calculationHash.slice(0, 16)}…
            </dd>
          </div>
          <div>
            <dt>{t.snapshotHash}</dt>
            <dd title={state.summary.snapshotHash}>
              {state.summary.snapshotHash.slice(0, 16)}…
            </dd>
          </div>
          <div>
            <dt>{t.renderHash}</dt>
            <dd title={state.summary.renderHash}>
              {state.summary.renderHash.slice(0, 16)}…
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

export function RealAddressResult({
  heightAnalysisAction,
  locale,
  result,
}: {
  heightAnalysisAction: (
    previousState: RoofFusionHeightAnalysisState,
    formData: FormData,
  ) => Promise<RoofFusionHeightAnalysisState>;
  locale: PanelLocale;
  result: Extract<RoofFusionAddressLookupState, { kind: "success" }>;
}) {
  const t = copy[locale];
  const [selectedId, setSelectedId] = useState(result.candidates[0]?.id ?? "");
  const [opacity, setOpacity] = useState(38);
  const [showOverlay, setShowOverlay] = useState(true);
  const [heightState, heightFormAction, heightPending] = useActionState(
    heightAnalysisAction,
    initialHeightState,
  );
  const selected =
    result.candidates.find((candidate) => candidate.id === selectedId) ??
    result.candidates[0];
  const enginePreview = result.enginePreviews.find(
    (preview) => preview.candidateId === selected?.id,
  );
  const projected = useMemo(
    () => projectCandidates(result.address, result.candidates),
    [result.address, result.candidates],
  );
  const activeHeight =
    heightState.kind === "success" && heightState.candidateId === selected?.id
      ? heightState
      : null;
  const activePlanes = activeHeight?.visualization.planes ?? [];
  const hasSegmentedPlanes = activePlanes.length > 0;

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
        {activeHeight ? (
          <div
            aria-label={
              hasSegmentedPlanes
                ? `${t.heightTitle} · ${activePlanes.length} ${t.heightPlaneCount.toLowerCase()} · ${t.reviewRequired}`
                : t.heightTitle
            }
            className="relative overflow-hidden bg-[#080d12] bg-cover bg-center"
            role="img"
            style={{
              aspectRatio:
                String(activeHeight.visualization.width) +
                " / " +
                String(activeHeight.visualization.height),
              backgroundImage:
                "url(" + activeHeight.visualization.dataUrl + ")",
            }}
          >
            <svg
              aria-hidden="true"
              className="absolute inset-0 size-full"
              preserveAspectRatio="none"
              viewBox={[
                0,
                0,
                activeHeight.visualization.width,
                activeHeight.visualization.height,
              ].join(" ")}
            >
              {showOverlay ? (
                <>
                  <polygon
                    fill={
                      hasSegmentedPlanes
                        ? "transparent"
                        : "rgba(244,182,63," + opacity / 100 + ")"
                    }
                    points={activeHeight.visualization.overlayPoints}
                    stroke="#f4b63f"
                    strokeLinejoin="round"
                    strokeWidth={
                      Math.max(
                        activeHeight.visualization.width,
                        activeHeight.visualization.height,
                      ) / 125
                    }
                    vectorEffect="non-scaling-stroke"
                  />
                  {activePlanes.map((plane, index) => {
                    const palette =
                      planeOverlayPalette[index % planeOverlayPalette.length];
                    return (
                      <polygon
                        fill={overlayFill(palette.fill, opacity / 100)}
                        key={plane.planeId}
                        points={plane.overlayPoints}
                        stroke={palette.stroke}
                        strokeLinejoin="round"
                        strokeWidth={
                          Math.max(
                            activeHeight.visualization.width,
                            activeHeight.visualization.height,
                          ) / 150
                        }
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  {activeHeight.visualization.ridge ? (
                    <polyline
                      fill="none"
                      points={activeHeight.visualization.ridge.overlayPoints}
                      stroke="#f8fafc"
                      strokeLinecap="round"
                      strokeWidth={
                        Math.max(
                          activeHeight.visualization.width,
                          activeHeight.visualization.height,
                        ) / 90
                      }
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                </>
              ) : null}
            </svg>
            <span className="pointer-events-none absolute top-3 left-3 rounded-lg border border-[var(--an-border)] bg-black/65 px-2 py-1 text-[9px] font-black text-white">
              N ↑ · 1 m
            </span>
            {hasSegmentedPlanes ? (
              <span className="pointer-events-none absolute top-3 right-3 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[9px] font-black text-white">
                {activePlanes.length} · {t.heightStatusPreview} ·{" "}
                {t.reviewRequired}
              </span>
            ) : null}
            <span className="pointer-events-none absolute right-3 bottom-3 max-w-[calc(100%-1.5rem)] rounded-lg border border-[var(--an-border)] bg-black/70 px-2 py-1 text-right text-[9px] text-[var(--an-muted)]">
              {activeHeight.visualization.attribution}
            </span>
          </div>
        ) : (
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
        )}
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
        <form action={heightFormAction}>
          <input
            name="addressQuery"
            type="hidden"
            value={result.address.label}
          />
          <input name="candidateId" type="hidden" value={selected.id} />
          <button
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--an-amber)] px-4 text-xs font-black text-[var(--an-amber-ink)] disabled:cursor-wait disabled:opacity-70"
            disabled={heightPending}
            type="submit"
          >
            {heightPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <Mountain aria-hidden="true" className="size-4" />
            )}
            {heightPending ? t.heightWorking : t.heightAction}
          </button>
        </form>
      </div>
      <p className="rounded-xl border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] p-3 text-xs font-semibold text-[var(--an-amber)] xl:col-span-2">
        {t.preliminary}
      </p>
      {heightState.kind === "error" ? (
        <p
          className="rounded-xl border border-red-400/35 bg-red-400/10 p-3 text-xs font-bold text-red-200 xl:col-span-2"
          role="alert"
        >
          {t.heightErrors[heightState.code]}
        </p>
      ) : null}
      {activeHeight ? (
        <HeightAnalysisPanel locale={locale} state={activeHeight} />
      ) : enginePreview?.kind === "success" ? (
        <section
          aria-label={t.engineTitle}
          className="overflow-hidden rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] xl:col-span-2"
          data-roof-fusion-engine-contract="valid-review-required"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--an-border)] p-4">
            <div>
              <h3 className="flex items-center gap-2 text-base font-black">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-5 text-emerald-300"
                />
                {t.engineTitle}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase">
                <span className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-1 text-emerald-300">
                  {t.contractValid}
                </span>
                <span className="rounded-full border border-[color:rgba(244,182,63,.3)] bg-[var(--an-amber-soft)] px-2 py-1 text-[var(--an-amber)]">
                  {t.reviewRequired}
                </span>
              </div>
            </div>
            <strong className="rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-200">
              {t.notPricingReady}
            </strong>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.9fr)]">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
                <span className="text-[10px] text-[var(--an-subtle)]">
                  {t.engineFootprint}
                </span>
                <strong className="mt-1 block text-lg">
                  {formatMetric(
                    locale,
                    enginePreview.summary.engineHorizontalAreaSquareMeters,
                  )}{" "}
                  m²
                </strong>
              </div>
              <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
                <span className="text-[10px] text-[var(--an-subtle)]">
                  {t.enginePerimeter}
                </span>
                <strong className="mt-1 block text-lg">
                  {formatMetric(
                    locale,
                    enginePreview.summary.footprintPerimeterMeters,
                  )}{" "}
                  m
                </strong>
              </div>
              <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
                <span className="text-[10px] text-[var(--an-subtle)]">
                  {t.areaParity}
                </span>
                <strong className="mt-1 block text-lg">
                  {formatMetric(locale, enginePreview.summary.areaDeltaPercent)}
                  %
                </strong>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3">
              <strong className="text-xs">{t.blockersTitle}</strong>
              <ul className="mt-3 grid gap-2 text-xs text-[var(--an-muted)]">
                {enginePreview.summary.blockers.map((blocker) => (
                  <li className="flex gap-2" key={blocker}>
                    <TriangleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-[var(--an-amber)]"
                    />
                    {t.blockers[blocker]}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <details className="border-t border-[var(--an-border)] px-4 py-3 text-xs">
            <summary className="cursor-pointer font-bold text-[var(--an-muted)]">
              {t.integrity}
            </summary>
            <dl className="mt-3 grid gap-2 font-mono text-[10px] text-[var(--an-subtle)] sm:grid-cols-3">
              <div>
                <dt>{t.calculationHash}</dt>
                <dd title={enginePreview.summary.calculationHash}>
                  {enginePreview.summary.calculationHash.slice(0, 16)}…
                </dd>
              </div>
              <div>
                <dt>{t.snapshotHash}</dt>
                <dd title={enginePreview.summary.snapshotHash}>
                  {enginePreview.summary.snapshotHash.slice(0, 16)}…
                </dd>
              </div>
              <div>
                <dt>{t.renderHash}</dt>
                <dd title={enginePreview.summary.renderHash}>
                  {enginePreview.summary.renderHash.slice(0, 16)}…
                </dd>
              </div>
            </dl>
          </details>
        </section>
      ) : (
        <p
          className="rounded-xl border border-red-400/35 bg-red-400/10 p-3 text-xs font-bold text-red-200 xl:col-span-2"
          role="alert"
        >
          {t.engineUnavailable}
        </p>
      )}
    </div>
  );
}

export function AdminNextRoofFusionUatControl({
  action,
  addressLookupAction,
  defaultCaseReference = "TF-13",
  heightAnalysisAction,
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
  heightAnalysisAction: (
    previousState: RoofFusionHeightAnalysisState,
    formData: FormData,
  ) => Promise<RoofFusionHeightAnalysisState>;
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
            heightAnalysisAction={heightAnalysisAction}
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
