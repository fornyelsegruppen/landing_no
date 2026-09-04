export type RoofFusionOneCardStateV2 =
  | Readonly<{ status: "address" }>
  | Readonly<{ status: "acquiring"; requestId: string }>
  | Readonly<{
      status: "building_select";
      requestId: string;
      sourceId: string;
    }>
  | Readonly<{
      status: "annotate";
      requestId: string;
      sourceId: string;
      candidateId: string;
      revisesMeasurementId?: string;
    }>
  | Readonly<{
      status: "calculating";
      requestId: string;
      sourceId: string;
      candidateId: string;
      revisesMeasurementId?: string;
    }>
  | Readonly<{
      status: "result";
      requestId: string;
      sourceId: string;
      candidateId: string;
      resultId: string;
      revisesMeasurementId?: string;
    }>
  | Readonly<{
      status: "blocked";
      requestId: string;
      sourceId: string;
      candidateId: string;
      reason: string;
      revisesMeasurementId?: string;
    }>
  | Readonly<{
      status: "adding_to_offer";
      requestId: string;
      sourceId: string;
      candidateId: string;
      resultId: string;
      revisesMeasurementId?: string;
    }>
  | Readonly<{
      status: "offer_added";
      requestId: string;
      sourceId: string;
      candidateId: string;
      resultId: string;
      measurementId: string;
      offerId: string;
    }>;

export type RoofFusionOneCardEventV2 =
  | Readonly<{ type: "SEARCH"; requestId: string }>
  | Readonly<{
      type: "CAPTURE_READY";
      requestId: string;
      sourceId: string;
    }>
  | Readonly<{
      type: "CAPTURE_FAILED";
      requestId: string;
      reason: string;
    }>
  | Readonly<{ type: "SELECT_BUILDING"; candidateId: string }>
  | Readonly<{ type: "CHANGE_BUILDING" }>
  | Readonly<{ type: "CALCULATE" }>
  | Readonly<{ type: "CALCULATION_READY"; resultId: string }>
  | Readonly<{ type: "CALCULATION_BLOCKED"; reason: string }>
  | Readonly<{ type: "EDIT_MEASUREMENT" }>
  | Readonly<{ type: "ADD_TO_OFFER" }>
  | Readonly<{
      type: "OFFER_ADDED";
      measurementId: string;
      offerId: string;
    }>
  | Readonly<{ type: "RESET" }>;

export const ROOF_FUSION_ONE_CARD_INITIAL_STATE_V2: RoofFusionOneCardStateV2 = {
  status: "address",
};

function hasSelectedBuilding(
  state: RoofFusionOneCardStateV2,
): state is Extract<
  RoofFusionOneCardStateV2,
  { candidateId: string; sourceId: string }
> {
  return "candidateId" in state && "sourceId" in state;
}

/**
 * Pure workflow controller for the One Card v2 UI.
 *
 * Provider responses carry a request identity. A late response from an older
 * address lookup is deliberately ignored instead of replacing the active card.
 */
export function reduceRoofFusionOneCardStateV2(
  state: RoofFusionOneCardStateV2,
  event: RoofFusionOneCardEventV2,
): RoofFusionOneCardStateV2 {
  if (event.type === "RESET") return ROOF_FUSION_ONE_CARD_INITIAL_STATE_V2;
  if (event.type === "SEARCH") {
    return { status: "acquiring", requestId: event.requestId };
  }
  if (event.type === "CAPTURE_READY") {
    if (state.status !== "acquiring" || state.requestId !== event.requestId) {
      return state;
    }
    return {
      status: "building_select",
      requestId: state.requestId,
      sourceId: event.sourceId,
    };
  }
  if (event.type === "CAPTURE_FAILED") {
    if (state.status !== "acquiring" || state.requestId !== event.requestId) {
      return state;
    }
    return ROOF_FUSION_ONE_CARD_INITIAL_STATE_V2;
  }
  if (event.type === "SELECT_BUILDING") {
    if (state.status !== "building_select") return state;
    return {
      ...state,
      status: "annotate",
      candidateId: event.candidateId,
    };
  }
  if (event.type === "CHANGE_BUILDING") {
    if (!hasSelectedBuilding(state)) return state;
    return {
      status: "building_select",
      requestId: state.requestId,
      sourceId: state.sourceId,
    };
  }
  if (event.type === "CALCULATE") {
    if (state.status !== "annotate" && state.status !== "blocked") return state;
    return { ...state, status: "calculating" };
  }
  if (event.type === "CALCULATION_READY") {
    if (state.status !== "calculating") return state;
    return { ...state, status: "result", resultId: event.resultId };
  }
  if (event.type === "CALCULATION_BLOCKED") {
    if (state.status !== "calculating") return state;
    return { ...state, status: "blocked", reason: event.reason };
  }
  if (event.type === "EDIT_MEASUREMENT") {
    if (state.status !== "result" && state.status !== "offer_added") {
      return state;
    }
    return {
      status: "annotate",
      requestId: state.requestId,
      sourceId: state.sourceId,
      candidateId: state.candidateId,
      ...(state.status === "offer_added"
        ? { revisesMeasurementId: state.measurementId }
        : state.revisesMeasurementId
          ? { revisesMeasurementId: state.revisesMeasurementId }
          : {}),
    };
  }
  if (event.type === "ADD_TO_OFFER") {
    if (state.status !== "result") return state;
    return { ...state, status: "adding_to_offer" };
  }
  if (event.type === "OFFER_ADDED") {
    if (state.status !== "adding_to_offer") return state;
    return {
      ...state,
      status: "offer_added",
      measurementId: event.measurementId,
      offerId: event.offerId,
    };
  }
  return state;
}
