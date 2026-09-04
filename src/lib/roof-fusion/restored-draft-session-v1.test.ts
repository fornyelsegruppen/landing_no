import { describe, expect, it } from "vitest";
import {
  ROOF_FUSION_DRAFT_SESSION_INITIAL_STATE_V1,
  reduceRoofFusionDraftSessionV1,
} from "./restored-draft-session-v1";

const restoredDraft = {
  draftId: "draft-r7",
  revision: 7,
  draftHash: "a".repeat(64),
  state: "review_required" as const,
};

describe("Roof Fusion restored draft session v1", () => {
  it("requires an explicit choice and resumes the exact stored identity", () => {
    const loading = reduceRoofFusionDraftSessionV1(
      ROOF_FUSION_DRAFT_SESSION_INITIAL_STATE_V1,
      { type: "LOAD_STARTED", requestId: 1 },
    );
    const choice = reduceRoofFusionDraftSessionV1(loading, {
      type: "LOAD_COMPLETED",
      requestId: 1,
      restoredDraft,
      newSessionId: "unused",
    });
    const resumed = reduceRoofFusionDraftSessionV1(choice, { type: "RESUME" });

    expect(choice).toMatchObject({ status: "choice_required", restoredDraft });
    expect(resumed).toMatchObject({
      status: "active",
      mode: "resumed",
      sessionId: "draft-r7",
      baseDraft: restoredDraft,
    });
  });

  it("starts a distinct session while retaining the previous revision as lineage", () => {
    const choice = reduceRoofFusionDraftSessionV1(
      { status: "loading", requestId: 2 },
      {
        type: "LOAD_COMPLETED",
        requestId: 2,
        restoredDraft,
        newSessionId: "unused",
      },
    );
    const started = reduceRoofFusionDraftSessionV1(choice, {
      type: "START_NEW",
      sessionId: "session-new-8",
    });

    expect(started).toMatchObject({
      status: "active",
      mode: "new",
      sessionId: "session-new-8",
      baseDraft: restoredDraft,
    });
    expect(started).not.toMatchObject({ sessionId: restoredDraft.draftId });

    const savedDraft = {
      ...restoredDraft,
      draftId: "draft-r8-new-session",
      revision: 8,
      draftHash: "b".repeat(64),
    };
    expect(
      reduceRoofFusionDraftSessionV1(started, {
        type: "SAVE_CONFIRMED",
        draft: savedDraft,
      }),
    ).toMatchObject({
      status: "active",
      mode: "saved",
      sessionId: savedDraft.draftId,
      baseDraft: savedDraft,
    });
  });

  it("ignores a late response from an older load request", () => {
    const newest = reduceRoofFusionDraftSessionV1(
      { status: "loading", requestId: 1 },
      { type: "LOAD_STARTED", requestId: 2 },
    );
    const stale = reduceRoofFusionDraftSessionV1(newest, {
      type: "LOAD_COMPLETED",
      requestId: 1,
      restoredDraft,
      newSessionId: "stale-session",
    });

    expect(stale).toEqual(newest);
  });
});
