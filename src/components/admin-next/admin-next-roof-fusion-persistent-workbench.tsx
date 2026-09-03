"use client";

import {
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  Save,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import type { NorgeIBilderCaptureResult } from "./norgeibilder-capture-control";
import {
  AdminNextRoofFusionUnifiedWorkbench,
  type RoofFusionLine,
  type RoofFusionPoint,
  type RoofFusionStage,
} from "./admin-next-roof-fusion-unified-workbench";
import {
  buildWorkbenchDraftFromUiV1,
  loadWorkbenchDraftV1,
  normalizeProjectedWorkbenchPointV1,
  persistAndReloadWorkbenchDraftV1,
  workbenchCalculationBlockersV1,
  WorkbenchUiApiErrorV1,
} from "@/lib/roof-fusion/workbench-ui-client-v1";
import type {
  RoofFusionWorkbenchDraftReferenceV1,
  RoofFusionWorkbenchDraftV1,
} from "@/lib/roof-fusion/workbench-draft-contract-v1";

type HeightResult = {
  status: "ready" | "review_required" | "blocked";
  pricingReady: false;
  summary: { blockers: string[] };
  metrics?: {
    horizontalAreaSquareMeters?: number;
    totalSurfaceAreaSquareMeters?: number;
    averageSlopeDegrees?: number;
    footprintPerimeterMeters?: number;
  };
};

function reference(
  draft: RoofFusionWorkbenchDraftV1,
): RoofFusionWorkbenchDraftReferenceV1 {
  return {
    draftId: draft.draftId,
    revision: draft.revision,
    draftHash: draft.draftHash,
    state: draft.state,
  };
}

function safeNonce() {
  return crypto.randomUUID().replaceAll("-", "");
}

function hydrateDraft(
  draft: RoofFusionWorkbenchDraftV1,
  capture: NorgeIBilderCaptureResult,
) {
  if (
    !capture.geoReference ||
    capture.sourceId !== draft.source.sourceId ||
    capture.rawContentHash !== draft.source.sourceContentHash
  )
    return null;
  if (
    draft.geometry.roofMasses.length !== 1 ||
    draft.geometry.openings.length > 0 ||
    draft.geometry.obstacles.length > 0 ||
    draft.geometry.skeletonEdges.some(
      (edge) => edge.type !== "ridge" && edge.type !== "valley",
    )
  ) {
    return null;
  }
  const vertices = new Map(
    draft.geometry.vertices.map((vertex) => [vertex.vertexId, vertex]),
  );
  const mass = draft.geometry.roofMasses[0];
  if (!mass) return null;
  return {
    outline: mass.vertexIds.map((id) =>
      normalizeProjectedWorkbenchPointV1(
        vertices.get(id)!,
        capture.geoReference!,
      ),
    ),
    lines: draft.geometry.skeletonEdges.map((edge) => ({
      id: edge.edgeId,
      kind: edge.type === "valley" ? ("valley" as const) : ("ridge" as const),
      start: normalizeProjectedWorkbenchPointV1(
        vertices.get(edge.fromVertexId)!,
        capture.geoReference!,
      ),
      end: normalizeProjectedWorkbenchPointV1(
        vertices.get(edge.toVertexId)!,
        capture.geoReference!,
      ),
    })),
  };
}

export function AdminNextRoofFusionPersistentWorkbench({
  actorId,
  capture,
  caseId,
  heightSurface,
  horizontalAreaSquareMeters,
  orthoImageAlt,
  sourceOutline,
  sourceFootprintId,
}: {
  actorId: string;
  capture: NorgeIBilderCaptureResult;
  caseId: string;
  heightSurface?: KartverketHeightSurfaceV1;
  horizontalAreaSquareMeters: number;
  orthoImageAlt: string;
  sourceOutline: readonly RoofFusionPoint[];
  sourceFootprintId?: string;
}) {
  const [outline, setOutline] =
    useState<readonly RoofFusionPoint[]>(sourceOutline);
  const [lines, setLines] = useState<readonly RoofFusionLine[]>([]);
  const [latest, setLatest] = useState<RoofFusionWorkbenchDraftV1 | null>(null);
  const [confirmed, setConfirmed] = useState<RoofFusionWorkbenchDraftV1 | null>(
    null,
  );
  const [loadState, setLoadState] = useState<
    "loading" | "loaded" | "none" | "error"
  >("loading");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "applied" | "replayed" | "error"
  >("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [dirty, setDirty] = useState(true);
  const [heightState, setHeightState] = useState<"idle" | "running" | "error">(
    "idle",
  );
  const [heightResult, setHeightResult] = useState<HeightResult | null>(null);
  const [unsupportedLatest, setUnsupportedLatest] = useState(false);
  const [geometryHydrationSignal, setGeometryHydrationSignal] = useState(0);
  const pendingDraft = useRef<RoofFusionWorkbenchDraftV1 | null>(null);

  const evidenceReady = Boolean(
    capture.sourceId &&
    capture.rawContentHash?.match(/^[a-f0-9]{64}$/u) &&
    capture.capturedAt &&
    capture.geoReference?.crs === "EPSG:25833" &&
    capture.geoReference.extentTrust === "actual-visible-extent",
  );

  const loadLatest = useCallback(async () => {
    setLoadState("loading");
    setProblem(null);
    try {
      const draft = await loadWorkbenchDraftV1(caseId);
      setLatest(draft);
      setLoadState(draft ? "loaded" : "none");
      if (draft) {
        const hydrated = hydrateDraft(draft, capture);
        if (hydrated) {
          setUnsupportedLatest(false);
          setOutline(hydrated.outline);
          setLines(hydrated.lines);
          setConfirmed(draft);
          setDirty(false);
          setGeometryHydrationSignal((current) => current + 1);
        } else if (
          draft.source.sourceId === capture.sourceId &&
          draft.source.sourceContentHash === capture.rawContentHash
        ) {
          setUnsupportedLatest(true);
          setProblem(
            "Naujausioje revizijoje yra keli stogo masyvai, angos, kliūtys arba nepalaikomi kraštai. Ši UAT drobė jų saugiai nepriskiria paviršiams — reikalinga peržiūra.",
          );
        }
      }
    } catch (error) {
      setLoadState("error");
      setProblem(
        error instanceof Error ? error.message : "Juodraščio įkelti nepavyko",
      );
    }
  }, [capture, caseId]);

  useEffect(() => {
    let cancelled = false;
    loadWorkbenchDraftV1(caseId)
      .then((draft) => {
        if (cancelled) return;
        setLatest(draft);
        setLoadState(draft ? "loaded" : "none");
        if (draft) {
          const hydrated = hydrateDraft(draft, capture);
          if (hydrated) {
            setUnsupportedLatest(false);
            setOutline(hydrated.outline);
            setLines(hydrated.lines);
            setConfirmed(draft);
            setDirty(false);
            setGeometryHydrationSignal((current) => current + 1);
          } else if (
            draft.source.sourceId === capture.sourceId &&
            draft.source.sourceContentHash === capture.rawContentHash
          ) {
            setUnsupportedLatest(true);
            setProblem(
              "Naujausioje revizijoje yra keli stogo masyvai, angos, kliūtys arba nepalaikomi kraštai. Ši UAT drobė jų saugiai nepriskiria paviršiams — reikalinga peržiūra.",
            );
          }
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState("error");
        setProblem(
          error instanceof Error ? error.message : "Juodraščio įkelti nepavyko",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [capture, caseId]);

  const save = useCallback(async () => {
    if (
      !evidenceReady ||
      unsupportedLatest ||
      (loadState !== "loaded" && loadState !== "none") ||
      !capture.geoReference ||
      !capture.sourceId ||
      !capture.rawContentHash ||
      !capture.capturedAt
    )
      return;
    setSaveState("saving");
    setProblem(null);
    try {
      let draft = pendingDraft.current;
      if (!draft || draft.revision !== (latest?.revision ?? 0) + 1 || !dirty) {
        const revision = (latest?.revision ?? 0) + 1;
        const nonce = safeNonce();
        draft = await buildWorkbenchDraftFromUiV1({
          caseId,
          actorId,
          revision,
          supersedes: latest ? reference(latest) : null,
          draftId: `uat-${caseId.replace(":", "-")}-r${revision}-${nonce}`,
          idempotencyKey: `workbench:${caseId}:r${revision}:${nonce}`,
          createdAt: new Date().toISOString(),
          sourceOutline,
          sourceFootprintId,
          approvedOutline: outline,
          lines,
          evidence: {
            sourceId: capture.sourceId,
            sourceContentHash: capture.rawContentHash,
            attribution: capture.attribution ?? "©norgeibilder.no",
            imageId: capture.mediaId,
            georeference: capture.geoReference,
          },
        });
        pendingDraft.current = draft;
      }
      const saved = await persistAndReloadWorkbenchDraftV1(
        draft,
        latest ? reference(latest) : null,
      );
      setLatest(saved.draft);
      setConfirmed(saved.draft);
      setDirty(false);
      setSaveState(saved.status);
      setGeometryHydrationSignal((current) => current + 1);
      pendingDraft.current = null;
    } catch (error) {
      setSaveState("error");
      const message =
        error instanceof WorkbenchUiApiErrorV1
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "Išsaugoti nepavyko";
      setProblem(message);
    }
  }, [
    actorId,
    capture,
    caseId,
    dirty,
    evidenceReady,
    latest,
    lines,
    outline,
    sourceOutline,
    sourceFootprintId,
    loadState,
    unsupportedLatest,
  ]);

  const calculate = useCallback(async () => {
    if (
      !confirmed ||
      dirty ||
      !heightSurface ||
      !capture.geoReference ||
      !capture.sourceId ||
      !capture.rawContentHash ||
      !capture.capturedAt
    )
      return false;
    setHeightState("running");
    setProblem(null);
    try {
      const response = await fetch(
        "/api/admin/roof-fusion/workbench-height-adapter",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            caseId,
            draftId: confirmed.draftId,
            draftHash: confirmed.draftHash,
            targetSnapshotId: `uat-height-${confirmed.draftId}`,
            idempotencyKey: `height-adapter:${caseId}:${confirmed.draftHash}`,
            heightSurface,
            orthophoto: {
              sourceId: capture.sourceId,
              rawContentHash: capture.rawContentHash,
              capturedAt: capture.capturedAt,
              attribution: capture.attribution ?? "©norgeibilder.no",
              provider: "norgeibilder.no",
              providerObjectId: String(capture.mediaId ?? capture.sourceId),
              geoReference: capture.geoReference,
            },
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        (HeightResult & { code?: string; error?: string }) | null;
      if (!response.ok || !body)
        throw new WorkbenchUiApiErrorV1(
          body?.code ?? "HEIGHT_FAILED",
          response.status,
          body?.error ?? "Skaičiavimas nepavyko",
        );
      setHeightResult(body);
      setHeightState("idle");
      return body.status !== "blocked";
    } catch (error) {
      setHeightState("error");
      setProblem(
        error instanceof Error ? error.message : "Skaičiavimas nepavyko",
      );
      return false;
    }
  }, [capture, caseId, confirmed, dirty, heightSurface]);

  const blockers = useMemo(
    () => [
      ...(!evidenceReady
        ? [
            "Trūksta tikslaus išsaugoto vaizdo hash arba patikimos actual-visible-extent EPSG:25833 registracijos.",
          ]
        : []),
      ...(unsupportedLatest
        ? [
            "Sudėtingos revizijos paviršių, angų ar kliūčių priklausomybės šioje drobėje negali būti saugiai atkurtos — reikalinga peržiūra.",
          ]
        : []),
    ],
    [evidenceReady, unsupportedLatest],
  );
  const calculationBlockerCodes = workbenchCalculationBlockersV1({
    trustedOrthophoto: evidenceReady,
    completeHeightSurface: Boolean(heightSurface),
    storedDraftHashConfirmed: Boolean(confirmed && !dirty),
  });
  const calculationBlockerCopy = {
    TRUSTED_ORTHOPHOTO_REQUIRED:
      "Trūksta patikimos actual-visible-extent EPSG:25833 ortofoto registracijos.",
    COMPLETE_HEIGHT_SURFACE_REQUIRED:
      "Trūksta pilno EPSG:25833 DOM + DTM aukščio paviršiaus.",
    STORED_DRAFT_HASH_REQUIRED:
      "Pirmiausia išsaugokite ir pakartotinai patvirtinkite tikslų juodraščio hash.",
  } as const;
  const calculationBlockers = calculationBlockerCodes.map(
    (code) => calculationBlockerCopy[code],
  );
  const metrics = heightResult?.metrics;
  const persistencePanel = (
    <div
      className="rounded-2xl border border-white/10 bg-[#0f151f] p-3"
      data-roof-fusion-persistence
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="text-xs tracking-[.12em] text-[#aaa69d] uppercase">
          Išsaugojimas
        </strong>
        <button
          className="text-xs text-[#f3c66b]"
          disabled={loadState === "loading"}
          onClick={() => void loadLatest()}
          type="button"
        >
          <RotateCcw aria-hidden className="mr-1 inline size-3" /> Perkrauti
        </button>
      </div>
      <p className="mt-2 text-xs text-[#ddd8cd]">
        {loadState === "loading"
          ? "Tikrinama naujausia bylos revizija…"
          : latest
            ? `Naujausia r${latest.revision} · ${latest.draftHash.slice(0, 12)}…`
            : "Išsaugotų revizijų nėra."}
      </p>
      {saveState === "applied" || saveState === "replayed" ? (
        <p className="mt-2 text-xs text-[#71e6b4]" role="status">
          <CheckCircle2 aria-hidden className="mr-1 inline size-4" />
          {saveState === "replayed"
            ? "Idempotentinis pakartojimas patvirtintas"
            : "CAS revizija išsaugota"}
          ; reload hash sutampa.
        </p>
      ) : null}
      {problem ? (
        <p className="mt-2 text-xs text-[#ffadad]" role="alert">
          <TriangleAlert aria-hidden className="mr-1 inline size-4" />
          {problem}
        </p>
      ) : null}
      <button
        className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#e8a317]/40 bg-[#e8a317]/10 px-3 text-sm font-bold text-[#f3c66b] disabled:opacity-40"
        disabled={
          !evidenceReady ||
          unsupportedLatest ||
          (loadState !== "loaded" && loadState !== "none") ||
          saveState === "saving"
        }
        onClick={() => void save()}
        type="button"
      >
        {saveState === "saving" ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : (
          <Save aria-hidden className="size-4" />
        )}
        Išsaugoti ir patvirtinti reviziją
      </button>
      {heightResult ? (
        <div
          className={`mt-3 rounded-xl border p-2 text-xs ${heightResult.status === "blocked" ? "border-red-400/35 text-red-200" : "border-amber-300/30 text-amber-100"}`}
          data-roof-fusion-height-result={heightResult.status}
        >
          <strong>{heightResult.status}</strong> · kainodarai: ne
          {heightResult.summary.blockers.length ? (
            <ul className="mt-1 list-disc pl-4">
              {heightResult.summary.blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {heightState === "running" ? (
        <p className="mt-2 text-xs text-[#f3c66b]" role="status">
          <LoaderCircle
            aria-hidden
            className="mr-1 inline size-4 animate-spin"
          />
          Tikrinamas išsaugotas hash ir skaičiuojamas aukščio rezultatas…
        </p>
      ) : null}
    </div>
  );

  async function primaryAction(stage: RoofFusionStage) {
    if (stage === "slopes") return calculate();
    return true;
  }

  return (
    <AdminNextRoofFusionUnifiedWorkbench
      approvedOutline={outline}
      averageSlopeDegrees={metrics?.averageSlopeDegrees}
      blockers={blockers}
      confidence={heightResult?.status === "blocked" ? "low" : "medium"}
      confidenceReason={
        heightResult
          ? `${heightResult.status}; rezultatas lieka Preview ir nėra perduodamas kainodarai.`
          : "Patvirtinta revizija ir patikimi šaltiniai bus apskaičiuoti tik aiškiu veiksmu."
      }
      footprintPerimeterMeters={metrics?.footprintPerimeterMeters}
      guardNotice={
        confirmed && !dirty
          ? "Preview · CAS revizija išsaugota ir reload patvirtinta"
          : "Preview · neišsaugoti pakeitimai"
      }
      geometryHydrationSignal={geometryHydrationSignal}
      horizontalAreaSquareMeters={
        metrics?.horizontalAreaSquareMeters ?? horizontalAreaSquareMeters
      }
      initialLayers={{ approvedOutline: true, sourceOutline: true }}
      key={`${capture.sourceId ?? "missing-source"}:${capture.rawContentHash ?? "missing-content-hash"}`}
      lines={lines}
      onLineCapture={(line) => {
        setLines((current) => [...current, line]);
        setDirty(true);
        setConfirmed(null);
        setHeightResult(null);
      }}
      onLastLineUndo={() => {
        setLines((current) => current.slice(0, -1));
        setDirty(true);
        setConfirmed(null);
        setHeightResult(null);
      }}
      onOutlineChange={(points) => {
        setOutline(points);
        setDirty(true);
        setConfirmed(null);
        setHeightResult(null);
      }}
      onPrimaryAction={primaryAction}
      orthoAttribution={capture.attribution ?? "©norgeibilder.no"}
      orthoImageAlt={orthoImageAlt}
      orthoImageHeight={capture.geoReference?.imageHeight}
      orthoImageSrc={capture.imageUrl}
      orthoImageWidth={capture.geoReference?.imageWidth}
      persistencePanel={persistencePanel}
      sourceOutline={sourceOutline}
      stageBlockers={{
        slopes: calculationBlockers,
        review: [
          "Preview rezultatas visada reikalauja peržiūros ir negali būti perduotas kainodarai.",
        ],
      }}
      totalSurfaceAreaSquareMeters={metrics?.totalSurfaceAreaSquareMeters}
    />
  );
}
