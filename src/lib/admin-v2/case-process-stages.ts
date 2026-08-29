export const CASE_PROCESS_STAGE_IDS = [
  "contact",
  "measurement",
  "commercial",
  "agreement",
  "work",
  "completion",
] as const;

export type CaseProcessStageId = (typeof CASE_PROCESS_STAGE_IDS)[number];

export type CaseProcessStageState =
  "not_started" | "current" | "blocked" | "completed";

export type ResolvedCaseProcessStage = {
  id: CaseProcessStageId;
  index: number;
  isCurrent: boolean;
  state: CaseProcessStageState;
};

export type ResolveCaseProcessStagesInput = {
  activeStageId: CaseProcessStageId;
  activeStageState?: Extract<CaseProcessStageState, "current" | "blocked">;
};

/**
 * Resolves the stable business process independently from the chronological
 * audit feed. There is always exactly one current position. A blocker changes
 * the active position's state, but does not invent a seventh process stage.
 */
export function resolveCaseProcessStages({
  activeStageId,
  activeStageState = "current",
}: ResolveCaseProcessStagesInput): ResolvedCaseProcessStage[] {
  const activeIndex = CASE_PROCESS_STAGE_IDS.indexOf(activeStageId);

  return CASE_PROCESS_STAGE_IDS.map((id, index) => ({
    id,
    index,
    isCurrent: index === activeIndex,
    state:
      index < activeIndex
        ? "completed"
        : index === activeIndex
          ? activeStageState
          : "not_started",
  }));
}
