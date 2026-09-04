import type { RoofFusionWorkbenchDraftReferenceV1 } from "./workbench-draft-contract-v1";

export type RoofFusionDraftSessionStateV1 =
  | Readonly<{ status: "loading"; requestId: number }>
  | Readonly<{ status: "error"; requestId: number }>
  | Readonly<{
      status: "choice_required";
      requestId: number;
      restoredDraft: RoofFusionWorkbenchDraftReferenceV1;
    }>
  | Readonly<{
      status: "active";
      requestId: number;
      mode: "new" | "resumed" | "saved";
      sessionId: string;
      baseDraft: RoofFusionWorkbenchDraftReferenceV1 | null;
    }>;

export type RoofFusionDraftSessionEventV1 =
  | Readonly<{ type: "LOAD_STARTED"; requestId: number }>
  | Readonly<{
      type: "LOAD_COMPLETED";
      requestId: number;
      restoredDraft: RoofFusionWorkbenchDraftReferenceV1 | null;
      newSessionId: string;
    }>
  | Readonly<{ type: "LOAD_FAILED"; requestId: number }>
  | Readonly<{ type: "RESUME" }>
  | Readonly<{ type: "START_NEW"; sessionId: string }>
  | Readonly<{
      type: "SAVE_CONFIRMED";
      draft: RoofFusionWorkbenchDraftReferenceV1;
    }>;

export const ROOF_FUSION_DRAFT_SESSION_INITIAL_STATE_V1: RoofFusionDraftSessionStateV1 =
  { status: "loading", requestId: 0 };

/**
 * Controls the explicit restored-draft decision. Load responses are accepted
 * only for the newest request identity, so an older case/draft cannot silently
 * reactivate itself after the operator has moved on.
 */
export function reduceRoofFusionDraftSessionV1(
  state: RoofFusionDraftSessionStateV1,
  event: RoofFusionDraftSessionEventV1,
): RoofFusionDraftSessionStateV1 {
  if (event.type === "LOAD_STARTED") {
    return { status: "loading", requestId: event.requestId };
  }
  if (event.type === "LOAD_COMPLETED") {
    if (state.status !== "loading" || state.requestId !== event.requestId) {
      return state;
    }
    return event.restoredDraft
      ? {
          status: "choice_required",
          requestId: event.requestId,
          restoredDraft: event.restoredDraft,
        }
      : {
          status: "active",
          requestId: event.requestId,
          mode: "new",
          sessionId: event.newSessionId,
          baseDraft: null,
        };
  }
  if (event.type === "LOAD_FAILED") {
    if (state.status !== "loading" || state.requestId !== event.requestId) {
      return state;
    }
    return { status: "error", requestId: event.requestId };
  }
  if (event.type === "RESUME" && state.status === "choice_required") {
    return {
      status: "active",
      requestId: state.requestId,
      mode: "resumed",
      sessionId: state.restoredDraft.draftId,
      baseDraft: state.restoredDraft,
    };
  }
  if (event.type === "START_NEW" && state.status === "choice_required") {
    return {
      status: "active",
      requestId: state.requestId,
      mode: "new",
      sessionId: event.sessionId,
      baseDraft: state.restoredDraft,
    };
  }
  if (event.type === "START_NEW" && state.status === "active") {
    return {
      ...state,
      mode: "new",
      sessionId: event.sessionId,
    };
  }
  if (event.type === "SAVE_CONFIRMED" && state.status === "active") {
    return {
      ...state,
      mode: "saved",
      sessionId: event.draft.draftId,
      baseDraft: event.draft,
    };
  }
  return state;
}
