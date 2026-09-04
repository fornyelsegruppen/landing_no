"use client";

import {
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  Save,
  TriangleAlert,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import type { NorgeIBilderCaptureResult } from "./norgeibilder-capture-control";
import {
  AdminNextRoofFusionUnifiedWorkbench,
  type RoofFusionLine,
  type RoofFusionPoint,
  type RoofFusionRoofPlane,
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
import type { RoofFusionWorkbenchDetailedResultV1 } from "@/lib/roof-fusion/workbench-detailed-result-v1";
import {
  AdminNextRoofFusionLegacyFallbackPanel,
  type RoofFusionLegacyFallbackSelection,
} from "./admin-next-roof-fusion-legacy-fallback-panel";

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
  detailedResult?: RoofFusionWorkbenchDetailedResultV1;
};

function measurementMidpoint(value: {
  min: number | null;
  max: number | null;
}) {
  if (value.min === null || value.max === null) return undefined;
  return (value.min + value.max) / 2;
}

function roofPlaneConfidence(
  surface: RoofFusionWorkbenchDetailedResultV1["surfaces"][number],
): RoofFusionRoofPlane["confidence"] {
  const levels = [
    surface.pitch.confidence.level,
    surface.grossSurfaceArea.confidence.level,
  ];
  if (levels.includes("low") || levels.includes("unknown")) return "low";
  if (levels.includes("medium")) return "medium";
  return "high";
}

function roofPlaneDirection(azimuthDegrees?: number | null) {
  if (azimuthDegrees == null || !Number.isFinite(azimuthDegrees)) {
    return null;
  }
  const directions = [
    "Šiaurinis",
    "Šiaurės rytų",
    "Rytinis",
    "Pietryčių",
    "Pietinis",
    "Pietvakarių",
    "Vakarinis",
    "Šiaurės vakarų",
  ] as const;
  const normalized = ((azimuthDegrees % 360) + 360) % 360;
  return directions[Math.round(normalized / 45) % directions.length];
}

/**
 * Projects the authoritative calculated snapshot surfaces back onto the exact
 * captured orthophoto. Invalid or incomplete contours are omitted rather than
 * silently replaced with a preliminary Høydedata visualization.
 */
export function roofFusionDetailedResultPlanes(
  detailedResult: RoofFusionWorkbenchDetailedResultV1 | undefined,
  reference: NonNullable<NorgeIBilderCaptureResult["geoReference"]> | undefined,
): RoofFusionRoofPlane[] {
  if (
    !detailedResult ||
    !reference ||
    detailedResult.schemaVersion !==
      "roof-fusion-workbench-detailed-result.v1" ||
    detailedResult.usage !== "preview_only" ||
    detailedResult.pricingReady !== false
  ) {
    return [];
  }
  const spanX = reference.bounds.maxEastingM - reference.bounds.minEastingM;
  const spanY = reference.bounds.maxNorthingM - reference.bounds.minNorthingM;
  if (!(spanX > 0) || !(spanY > 0)) return [];
  const vertices = new Map(
    detailedResult.vertices.map((vertex) => [vertex.vertexId, vertex]),
  );
  const contours = new Map(
    detailedResult.contours.map((contour) => [contour.contourId, contour]),
  );

  return detailedResult.surfaces.flatMap((surface, index) => {
    const contour = contours.get(surface.outerContourId);
    if (!contour || contour.vertexIds.length < 3) return [];
    const points = contour.vertexIds.flatMap((vertexId) => {
      const vertex = vertices.get(vertexId);
      if (!vertex) return [];
      const point = {
        x: (vertex.xM - reference.bounds.minEastingM) / spanX,
        y: (reference.bounds.maxNorthingM - vertex.yM) / spanY,
      };
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1
      ) {
        return [];
      }
      return [point];
    });
    if (points.length !== contour.vertexIds.length) return [];
    const direction = roofPlaneDirection(surface.azimuthDegrees);
    return [
      {
        id: surface.surfaceId,
        label: direction ? `${direction} šlaitas` : `Šlaitas ${index + 1}`,
        points,
        horizontalAreaSquareMeters: measurementMidpoint(
          surface.grossHorizontalArea,
        ),
        areaSquareMeters: measurementMidpoint(surface.grossSurfaceArea),
        netAreaSquareMeters: measurementMidpoint(surface.netSurfaceArea),
        slopeDegrees: measurementMidpoint(surface.pitch),
        azimuthDegrees: surface.azimuthDegrees ?? undefined,
        confidence: roofPlaneConfidence(surface),
        confidenceReason: surface.pitch.confidence.rationale,
      },
    ];
  });
}

const heightStatusCopy: Record<HeightResult["status"], string> = {
  ready: "Parengta peržiūrai",
  review_required: "Reikalinga peržiūra",
  blocked: "Skaičiavimas užblokuotas",
};

const blockerCopy: Record<string, string> = {
  SKELETON_DANGLING_ENDPOINT:
    "Kraigo arba slėnio galas nesujungtas su stogo riba ar kitu kraštu. Patikslinkite liniją.",
  SKELETON_EDGE_OUTSIDE_MASS:
    "Kraigo arba slėnio linija išeina už patvirtinto stogo kontūro. Perkelkite jos galus.",
  SKELETON_DOES_NOT_SUBDIVIDE:
    "Pažymėtos linijos saugiai nepadalija stogo į paviršius. Patikslinkite kraigus ir slėnius.",
  FACE_TOPOLOGY_INVALID:
    "Stogo paviršių ryšiai nėra vienareikšmiai. Reikalinga rankinė peržiūra.",
  MASS_COVERAGE_INVALID:
    "Apskaičiuoti paviršiai nepadengia viso patvirtinto stogo ploto. Reikalinga rankinė peržiūra.",
  MISSING_OR_AMBIGUOUS_SKELETON:
    "Trūksta kraigo ar slėnio linijos arba jos reikšmė neaiški. Patikslinkite stogo schemą.",
  UNSTABLE_HEIGHT_PLANE:
    "Aukščio taškai neleidžia patikimai nustatyti stogo plokštumos. Reikalinga peržiūra.",
  TOO_FEW_HEIGHT_SAMPLES:
    "Stogo paviršiui nepakanka patikimų aukščio taškų. Patikrinkite Høydedata aprėptį.",
  SHARED_EDGE_HEIGHT_CONFLICT:
    "Bendro krašto aukščiai tarp gretimų paviršių nesutampa. Reikalinga peržiūra.",
  OBSTACLE_SURFACE_OWNERSHIP_REQUIRED:
    "Kliūties negalima saugiai priskirti konkrečiam stogo paviršiui. Reikalinga peržiūra.",
};

export function localizedWorkbenchHeightBlocker(blocker: string) {
  const code = /\[([A-Z][A-Z0-9_]+)\]/u.exec(blocker)?.[1];
  if (code && blockerCopy[code]) return `[${code}] ${blockerCopy[code]}`;
  if (
    /manual ridge|valley|hip|eave|explicit plane subdivision/iu.test(blocker)
  ) {
    return "Rankinės stogo linijos panaudotos paviršiams atskirti. Rezultatą būtina peržiūrėti.";
  }
  if (/review/iu.test(blocker)) {
    return "Prieš naudojant rezultatą būtina rankinė peržiūra.";
  }
  return "Aukščio skaičiavimas grąžino techninį blokatorių. Patikrinkite kontūrą, kraigus ir slėnius; jei kartojasi, perduokite peržiūrai.";
}

function localizedWorkbenchProblem(error: unknown, fallback: string) {
  if (!(error instanceof WorkbenchUiApiErrorV1)) return fallback;
  const messages: Record<string, string> = {
    LOAD_FAILED: "Juodraščio įkelti nepavyko.",
    SAVE_FAILED: "Juodraščio išsaugoti nepavyko.",
    LOAD_CONNECTION_FAILED:
      "Nepavyko prisijungti prie serverio įkeliant reviziją. Patikrinkite interneto ryšį ir spauskite „Perkrauti“.",
    LOAD_TIMEOUT:
      "Revizijos įkėlimas užtruko per ilgai. Patikrinkite ryšį ir spauskite „Perkrauti“.",
    SAVE_CONNECTION_FAILED:
      "Nepavyko prisijungti prie serverio išsaugant reviziją. Išsaugojimas nepatvirtintas; patikrinkite ryšį ir dar kartą spauskite „Išsaugoti ir patvirtinti reviziją“.",
    SAVE_TIMEOUT:
      "Revizijos išsaugojimas užtruko per ilgai. Išsaugojimas nepatvirtintas; patikrinkite ryšį ir dar kartą spauskite „Išsaugoti ir patvirtinti reviziją“.",
    INVALID_DRAFT:
      "Juodraščio geometrija netinkama. Patikrinkite kontūrą ir stogo linijas.",
    INVALID_GEOMETRY:
      "Juodraščio geometrija netinkama. Patikrinkite kontūrą ir stogo linijas.",
    REVISION_CONFLICT:
      "Revizija pasikeitė. Perkraukite naujausią versiją ir pakartokite pakeitimą.",
    RELOAD_MISMATCH:
      "Išsaugotos revizijos kontrolinė suma nepatvirtinta pakartotiniu įkėlimu.",
    ACTOR_MISMATCH:
      "Veiksmą turi atlikti prie bylos prisijungęs administratorius.",
    STALE_DRAFT:
      "Juodraštis paseno arba nebebuvo rastas. Perkraukite reviziją.",
    TRUSTED_INPUT_REQUIRED:
      "Trūksta patikimos ortofoto registracijos arba pilno aukščio paviršiaus.",
    SOURCE_INTEGRITY_INVALID:
      "Šaltinių tapatybė arba kontrolinės sumos nesutampa. Atnaujinkite šaltinius ir peržiūrėkite reviziją.",
    HEIGHT_CALCULATION_INVALID:
      "Stogo paviršių nepavyko apskaičiuoti saugiai. Patikslinkite geometriją arba perduokite peržiūrai.",
    INVALID_HEIGHT_INPUT:
      "Aukščio skaičiavimo duomenys netinkami. Atnaujinkite Høydedata šaltinį.",
    HEIGHT_FAILED: "Aukščio skaičiavimas nepavyko. Bandykite dar kartą.",
    SKELETON_ENDPOINT_OUTSIDE_MASS:
      "Kraigo arba slėnio galas yra už patvirtinto stogo kontūro.",
    SKELETON_ZERO_LENGTH:
      "Kraigo arba slėnio pradžios ir pabaigos taškai turi skirtis.",
  };
  return `[${error.code}] ${messages[error.code] ?? fallback}`;
}

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
  if (!capture.geoReference) return null;
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

const FOOTPRINT_IDENTITY_TOLERANCE_METERS = 0.05;

function sourceFootprintMatchesCapture(
  draft: RoofFusionWorkbenchDraftV1,
  capture: NorgeIBilderCaptureResult,
  sourceOutline: readonly RoofFusionPoint[],
  sourceFootprintId?: string,
) {
  const reference = capture.geoReference;
  if (!reference || sourceOutline.length < 3) return false;
  const footprint = draft.geometry.sourceFootprint;
  const legacyAliasedIdentity = footprint.sourceId === draft.source.sourceId;
  if (
    sourceFootprintId &&
    !legacyAliasedIdentity &&
    footprint.sourceId !== sourceFootprintId
  ) {
    return false;
  }
  const spanX = reference.bounds.maxEastingM - reference.bounds.minEastingM;
  const spanY = reference.bounds.maxNorthingM - reference.bounds.minNorthingM;
  const projected = sourceOutline.map((point) => ({
    xM: reference.bounds.minEastingM + point.x * spanX,
    yM: reference.bounds.maxNorthingM - point.y * spanY,
  }));
  if (projected.length !== footprint.points.length) return false;
  const unmatched = new Set(projected.map((_, index) => index));
  return footprint.points.every((stored) => {
    const match = [...unmatched].find((index) => {
      const current = projected[index];
      return (
        Math.hypot(current.xM - stored.xM, current.yM - stored.yM) <=
        FOOTPRINT_IDENTITY_TOLERANCE_METERS
      );
    });
    if (match === undefined) return false;
    unmatched.delete(match);
    return true;
  });
}

export function AdminNextRoofFusionPersistentWorkbench({
  advancedPanel,
  actorId,
  capture,
  caseId,
  heightSurface,
  horizontalAreaSquareMeters,
  orthoImageAlt,
  sourceStatusPanel,
  sourceOutline,
  sourceFootprintId,
  onChangeBuilding,
  onWorkflowStateChange,
}: {
  advancedPanel?: ReactNode;
  actorId: string;
  capture: NorgeIBilderCaptureResult;
  caseId: string;
  heightSurface?: KartverketHeightSurfaceV1;
  horizontalAreaSquareMeters: number;
  orthoImageAlt: string;
  sourceStatusPanel?: ReactNode;
  sourceOutline: readonly RoofFusionPoint[];
  sourceFootprintId?: string;
  onChangeBuilding?: () => void;
  onWorkflowStateChange?: (
    state: "annotate" | "calculating" | "result" | "blocked",
    detail?: string,
  ) => void;
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
  const [legacyFallback, setLegacyFallback] =
    useState<RoofFusionLegacyFallbackSelection | null>(null);
  const [unsupportedLatest, setUnsupportedLatest] = useState(false);
  const [sourceResetRequired, setSourceResetRequired] = useState(false);
  const [geometryHydrationSignal, setGeometryHydrationSignal] = useState(0);
  const pendingDraft = useRef<RoofFusionWorkbenchDraftV1 | null>(null);
  const sourceOutlineIdentity = sourceOutline
    .map((point) => `${point.x}:${point.y}`)
    .join("|");
  const registeredSourceOutline = useMemo(
    () =>
      sourceOutlineIdentity
        ? sourceOutlineIdentity.split("|").map((pair) => {
            const [x, y] = pair.split(":").map(Number);
            return { x, y };
          })
        : [],
    [sourceOutlineIdentity],
  );

  const evidenceReady = Boolean(
    capture.sourceId &&
    capture.rawContentHash?.match(/^[a-f0-9]{64}$/u) &&
    capture.capturedAt &&
    capture.geoReference?.crs === "EPSG:25833" &&
    capture.geoReference.extentTrust === "actual-visible-extent",
  );

  const applyLoadedDraft = useCallback(
    (draft: RoofFusionWorkbenchDraftV1) => {
      setLegacyFallback(null);
      const hydrated = hydrateDraft(draft, capture);
      const exactCapture =
        draft.source.sourceId === capture.sourceId &&
        draft.source.sourceContentHash === capture.rawContentHash;
      const transferable = sourceFootprintMatchesCapture(
        draft,
        capture,
        registeredSourceOutline,
        sourceFootprintId,
      );
      if (hydrated && (exactCapture || transferable)) {
        setUnsupportedLatest(false);
        setSourceResetRequired(false);
        setSaveState("idle");
        pendingDraft.current = null;
        setOutline(hydrated.outline);
        setLines(hydrated.lines);
        setConfirmed(exactCapture ? draft : null);
        setDirty(!exactCapture);
        if (!exactCapture) {
          setProblem(
            "Ankstesnės rankinės anotacijos perkeltos į tą patį registruotą stogo kontūrą. Išsaugokite naują reviziją, kad susietumėte jas su atnaujintu vaizdu.",
          );
        } else {
          setProblem(null);
        }
        setGeometryHydrationSignal((current) => current + 1);
        return;
      }
      setUnsupportedLatest(true);
      setSaveState("idle");
      pendingDraft.current = null;
      if (exactCapture) {
        setSourceResetRequired(false);
        setProblem(
          "Naujausioje revizijoje yra keli stogo masyvai, angos, kliūtys arba nepalaikomi kraštai. Ši UAT drobė jų saugiai nepriskiria paviršiams — reikalinga peržiūra.",
        );
        return;
      }
      setSourceResetRequired(true);
      setProblem(
        "Atnaujinto vaizdo stogo kontūro tapatybė nesutampa su išsaugota revizija. Rankinės anotacijos neišvalytos; patvirtinkite naujos geometrijos pradžią tik jei tikrai norite jų atsisakyti.",
      );
    },
    [capture, registeredSourceOutline, sourceFootprintId],
  );

  const loadLatest = useCallback(async () => {
    setLoadState("loading");
    setProblem(null);
    try {
      const draft = await loadWorkbenchDraftV1(caseId);
      setLatest(draft);
      setLoadState(draft ? "loaded" : "none");
      if (draft) applyLoadedDraft(draft);
    } catch (error) {
      setLoadState("error");
      setProblem(
        localizedWorkbenchProblem(error, "Juodraščio įkelti nepavyko."),
      );
    }
  }, [applyLoadedDraft, caseId]);

  useEffect(() => {
    let cancelled = false;
    loadWorkbenchDraftV1(caseId)
      .then((draft) => {
        if (cancelled) return;
        setLatest(draft);
        setLoadState(draft ? "loaded" : "none");
        if (draft) applyLoadedDraft(draft);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState("error");
        setProblem(
          localizedWorkbenchProblem(error, "Juodraščio įkelti nepavyko."),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [applyLoadedDraft, caseId]);

  const save =
    useCallback(async (): Promise<RoofFusionWorkbenchDraftV1 | null> => {
      if (confirmed && !dirty) return confirmed;
      if (
        !evidenceReady ||
        unsupportedLatest ||
        (loadState !== "loaded" && loadState !== "none") ||
        !capture.geoReference ||
        !capture.sourceId ||
        !capture.rawContentHash ||
        !capture.capturedAt
      )
        return null;
      setSaveState("saving");
      setProblem(null);
      try {
        let draft = pendingDraft.current;
        if (
          !draft ||
          draft.revision !== (latest?.revision ?? 0) + 1 ||
          !dirty
        ) {
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
        return saved.draft;
      } catch (error) {
        setSaveState("error");
        setProblem(localizedWorkbenchProblem(error, "Išsaugoti nepavyko."));
        return null;
      }
    }, [
      actorId,
      capture,
      caseId,
      confirmed,
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

  const calculate = useCallback(
    async (draftOverride?: RoofFusionWorkbenchDraftV1) => {
      const calculationDraft = draftOverride ?? confirmed;
      if (
        !calculationDraft ||
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
              draftId: calculationDraft.draftId,
              draftHash: calculationDraft.draftHash,
              targetSnapshotId: `uat-height-${calculationDraft.draftId}`,
              idempotencyKey: `height-adapter:${caseId}:${calculationDraft.draftHash}`,
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
        setLegacyFallback(null);
        setHeightState("idle");
        return body.status !== "blocked";
      } catch (error) {
        setHeightState("error");
        setProblem(localizedWorkbenchProblem(error, "Skaičiavimas nepavyko."));
        return false;
      }
    },
    [capture, caseId, confirmed, heightSurface],
  );

  const blockers = useMemo(
    () => [
      ...(!evidenceReady
        ? [
            "Trūksta tikslios išsaugoto vaizdo kontrolinės sumos arba patikimos faktiškai matomo vaizdo EPSG:25833 registracijos.",
          ]
        : []),
      ...(unsupportedLatest
        ? [
            sourceResetRequired
              ? "Atnaujinto vaizdo stogo kontūro tapatybė nepatvirtinta; anotacijų išvalymas laukia aiškaus patvirtinimo."
              : "Sudėtingos revizijos paviršių, angų ar kliūčių priklausomybės šioje drobėje negali būti saugiai atkurtos — reikalinga peržiūra.",
          ]
        : []),
    ],
    [evidenceReady, sourceResetRequired, unsupportedLatest],
  );
  const calculationBlockerCodes = workbenchCalculationBlockersV1({
    trustedOrthophoto: evidenceReady,
    completeHeightSurface: Boolean(heightSurface),
    storedDraftHashConfirmed: Boolean(confirmed && !dirty),
  });
  const calculationBlockerCopy = {
    TRUSTED_ORTHOPHOTO_REQUIRED:
      "Trūksta patikimos faktiškai matomo vaizdo EPSG:25833 ortofoto registracijos.",
    COMPLETE_HEIGHT_SURFACE_REQUIRED:
      "Trūksta pilno EPSG:25833 DOM + DTM aukščio paviršiaus.",
    STORED_DRAFT_HASH_REQUIRED:
      "Pirmiausia išsaugokite ir pakartotinai patvirtinkite tikslią juodraščio kontrolinę sumą.",
  } as const;
  const calculationBlockers = calculationBlockerCodes.map(
    (code) => calculationBlockerCopy[code],
  );
  const roofFusionMetrics = heightResult?.metrics;
  const calculatedRoofPlanes = useMemo(
    () =>
      roofFusionDetailedResultPlanes(
        heightResult?.detailedResult,
        capture.geoReference,
      ),
    [capture.geoReference, heightResult?.detailedResult],
  );
  const metrics = legacyFallback
    ? {
        horizontalAreaSquareMeters: legacyFallback.horizontalAreaM2,
        totalSurfaceAreaSquareMeters: legacyFallback.surfaceAreaM2,
        averageSlopeDegrees: legacyFallback.pitchDegrees,
        footprintPerimeterMeters: roofFusionMetrics?.footprintPerimeterMeters,
      }
    : roofFusionMetrics;
  const protectedResultId =
    heightResult && heightResult.status !== "blocked"
      ? (confirmed?.draftHash ?? `${caseId}:height-result`)
      : undefined;
  const confirmSourceReset = useCallback(() => {
    if (!sourceResetRequired) return;
    setOutline(sourceOutline);
    setLines([]);
    setConfirmed(null);
    setDirty(true);
    setUnsupportedLatest(false);
    setSourceResetRequired(false);
    setHeightResult(null);
    setLegacyFallback(null);
    pendingDraft.current = null;
    setGeometryHydrationSignal((current) => current + 1);
    setProblem(
      "Patvirtinta: ankstesnės rankinės anotacijos pašalintos tik iš naujos neišsaugotos geometrijos.",
    );
  }, [sourceOutline, sourceResetRequired]);
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
            : "Revizija saugiai išsaugota"}
          ; pakartotinai įkelta kontrolinė suma sutampa.
        </p>
      ) : null}
      {problem ? (
        <p className="mt-2 text-xs text-[#ffadad]" role="alert">
          <TriangleAlert aria-hidden className="mr-1 inline size-4" />
          {problem}
        </p>
      ) : null}
      {sourceResetRequired ? (
        <button
          className="mt-3 min-h-10 w-full rounded-xl border border-red-400/35 bg-red-400/10 px-3 text-sm font-bold text-red-200"
          data-roof-fusion-confirm-source-reset
          onClick={confirmSourceReset}
          type="button"
        >
          Patvirtinti: pradėti be ankstesnių anotacijų
        </button>
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
          <strong>{heightStatusCopy[heightResult.status]}</strong> · kainodarai
          nenaudojama
          {heightResult.summary.blockers.length ? (
            <ul className="mt-1 list-disc pl-4">
              {heightResult.summary.blockers.map((item) => (
                <li key={item}>{localizedWorkbenchHeightBlocker(item)}</li>
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

  async function primaryAction() {
    onWorkflowStateChange?.("calculating");
    if (legacyFallback) {
      onWorkflowStateChange?.("result", `${caseId}:legacy-preview`);
      return true;
    }
    const savedDraft = await save();
    if (!savedDraft) {
      onWorkflowStateChange?.("blocked", "Juodraščio nepavyko patvirtinti.");
      return false;
    }
    const calculated = await calculate(savedDraft);
    onWorkflowStateChange?.(
      calculated ? "result" : "blocked",
      calculated
        ? `uat-height-${savedDraft.draftId}`
        : "Skaičiavimo nepavyko užbaigti.",
    );
    return calculated;
  }

  return (
    <AdminNextRoofFusionUnifiedWorkbench
      approvedOutline={outline}
      advancedPanel={advancedPanel}
      averageSlopeDegrees={metrics?.averageSlopeDegrees}
      blockers={blockers}
      confidence={
        legacyFallback ||
        heightResult?.status === "blocked" ||
        heightResult?.detailedResult?.snapshot.confidence.level === "low" ||
        heightResult?.detailedResult?.snapshot.confidence.level === "unknown"
          ? "low"
          : heightResult?.detailedResult?.snapshot.confidence.level === "high"
            ? "high"
            : "medium"
      }
      confidenceReason={
        legacyFallback
          ? "Naudojamas operatoriaus pasirinktas senas rankinis nuolydžio metodas; rezultatas yra preliminarus ir lieka Preview peržiūrai."
          : heightResult?.detailedResult
            ? heightResult.detailedResult.snapshot.confidence.rationale
            : heightResult
              ? `${heightStatusCopy[heightResult.status]}; rezultatas lieka Preview ir nėra perduodamas kainodarai.`
              : "Patvirtinta revizija ir patikimi šaltiniai bus apskaičiuoti tik aiškiu veiksmu."
      }
      footprintPerimeterMeters={metrics?.footprintPerimeterMeters}
      guardNotice={
        legacyFallback
          ? "Preview · aktyvus senas rankinis fallback · kainodarai nenaudojama"
          : confirmed && !dirty
            ? "Preview · revizija išsaugota ir pakartotinai patvirtinta"
            : "Preview · neišsaugoti pakeitimai"
      }
      geometryHydrationSignal={geometryHydrationSignal}
      horizontalAreaSquareMeters={
        metrics?.horizontalAreaSquareMeters ?? horizontalAreaSquareMeters
      }
      initialLayers={{ approvedOutline: true, sourceOutline: true }}
      key={`${capture.sourceId ?? "missing-source"}:${capture.rawContentHash ?? "missing-content-hash"}`}
      lines={lines}
      legacyFallbackPanel={
        <AdminNextRoofFusionLegacyFallbackPanel
          horizontalAreaSquareMeters={
            roofFusionMetrics?.horizontalAreaSquareMeters ??
            horizontalAreaSquareMeters
          }
          onSelectionChange={setLegacyFallback}
          protectedResultId={protectedResultId}
          selection={legacyFallback}
        />
      }
      onLineCapture={(line) => {
        setLines((current) => [...current, line]);
        setDirty(true);
        setConfirmed(null);
        setHeightResult(null);
        setLegacyFallback(null);
      }}
      onLastLineUndo={() => {
        setLines((current) => current.slice(0, -1));
        setDirty(true);
        setConfirmed(null);
        setHeightResult(null);
        setLegacyFallback(null);
      }}
      onOutlineChange={(points) => {
        setOutline(points);
        setDirty(true);
        setConfirmed(null);
        setHeightResult(null);
        setLegacyFallback(null);
      }}
      onPrimaryAction={primaryAction}
      onChangeBuilding={onChangeBuilding}
      onEditResult={() => onWorkflowStateChange?.("annotate")}
      orthoAttribution={capture.attribution ?? "©norgeibilder.no"}
      orthoImageAlt={orthoImageAlt}
      orthoImageHeight={capture.geoReference?.imageHeight}
      orthoImageSrc={capture.imageUrl}
      orthoImageWidth={capture.geoReference?.imageWidth}
      sourceStatusPanel={sourceStatusPanel}
      persistencePanel={persistencePanel}
      resultIdentity={
        heightResult?.detailedResult
          ? {
              snapshotId: heightResult.detailedResult.snapshot.snapshotId,
              revision: heightResult.detailedResult.snapshot.revision,
              snapshotHash: heightResult.detailedResult.snapshot.snapshotHash,
              measurementMethod:
                heightResult.detailedResult.snapshot.measurementMethod,
            }
          : undefined
      }
      roofPlanes={calculatedRoofPlanes}
      sourceOutline={sourceOutline}
      stageBlockers={{
        outline: legacyFallback
          ? []
          : calculationBlockers.filter(
              (blocker) =>
                blocker !== calculationBlockerCopy.STORED_DRAFT_HASH_REQUIRED,
            ),
        skeleton: legacyFallback
          ? []
          : calculationBlockers.filter(
              (blocker) =>
                blocker !== calculationBlockerCopy.STORED_DRAFT_HASH_REQUIRED,
            ),
        slopes: legacyFallback ? [] : calculationBlockers,
        review: [
          "Preview rezultatas visada reikalauja peržiūros ir negali būti perduotas kainodarai.",
          ...(legacyFallback
            ? [
                "Aktyvus senas rankinis nuolydžio fallback. Rezultatas yra preliminarus ir negali būti automatiškai perduotas kainodarai.",
              ]
            : []),
        ],
      }}
      totalSurfaceAreaSquareMeters={metrics?.totalSurfaceAreaSquareMeters}
    />
  );
}
