import { describe, expect, it } from "vitest";
import {
  applyWorkQueueSavedView,
  resetWorkQueueSavedView,
  validateWorkQueueSavedView,
  validateWorkQueueSavedViewCatalog,
  WorkQueueSavedViewError,
  workQueueSavedViewRequiredCapabilities,
  type WorkQueueSavedViewActor,
  type WorkQueueSavedViewErrorCode,
} from "./work-queue-saved-view-contract";

const personalId = "wqsv_0000000000000001";
const teamId = "wqsv_0000000000000002";

function actor(
  overrides: Partial<WorkQueueSavedViewActor> = {},
): WorkQueueSavedViewActor {
  return {
    id: "user:7",
    teamIds: ["team:42"],
    capabilities: [
      "work_queue.saved_view.read",
      "work_queue.saved_view.share",
      "work_queue.saved_view.manage",
    ],
    ...overrides,
  };
}

function view(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: "ua-f2-004-v1",
    id: personalId,
    revision: 3,
    name: "Mine arbeidsoppgaver",
    scope: "personal",
    ownerId: "user:7",
    query: {
      view: "today",
      queue: "mine",
      processStage: "work",
      actionKind: "schedule_work",
      ownerId: "user:7",
      limit: 25,
    },
    requiredCapabilities: { ...workQueueSavedViewRequiredCapabilities },
    state: { kind: "active" },
    ...overrides,
  };
}

function expectCode(
  callback: () => unknown,
  code: WorkQueueSavedViewErrorCode,
) {
  try {
    callback();
    throw new Error("Expected WorkQueueSavedViewError");
  } catch (error) {
    expect(error).toBeInstanceOf(WorkQueueSavedViewError);
    expect((error as WorkQueueSavedViewError).code).toBe(code);
  }
}

describe("UA-F2-004 Work Queue saved-view contract", () => {
  it("normalizes a personal view and applies a deterministic cursor-free URL", () => {
    const normalized = validateWorkQueueSavedView(view(), {
      actor: actor(),
      intent: "read",
    });
    const result = applyWorkQueueSavedView(normalized, actor());

    expect(normalized).toMatchObject({
      contractVersion: "ua-f2-004-v1",
      id: personalId,
      revision: 3,
      name: "Mine arbeidsoppgaver",
      scope: "personal",
      ownerId: "user:7",
      requiredCapabilities: workQueueSavedViewRequiredCapabilities,
      state: { kind: "active" },
    });
    expect(result).toEqual({
      kind: "applied",
      viewId: personalId,
      revision: 3,
      url: "/admin-v2?view=today&queue=mine&stage=work&action=schedule_work&ownerId=user%3A7&limit=25",
      resetUrl: "/admin-v2?view=today&queue=all&limit=25",
    });
    expect(result.url).not.toContain("cursor");
    expect(result.url).not.toContain("selected");
  });

  it("returns one deterministic canonical reset result", () => {
    expect(resetWorkQueueSavedView()).toEqual({
      kind: "reset",
      viewId: null,
      revision: null,
      url: "/admin-v2?view=today&queue=all&limit=25",
      resetUrl: "/admin-v2?view=today&queue=all&limit=25",
    });
  });

  it("requires team ownership and explicit share capability", () => {
    const teamView = view({
      id: teamId,
      scope: "team",
      ownerId: "team:42",
      name: "Team blocked",
    });
    expect(
      validateWorkQueueSavedView(teamView, {
        actor: actor(),
        intent: "share",
      }),
    ).toMatchObject({ scope: "team", ownerId: "team:42" });

    expectCode(
      () =>
        validateWorkQueueSavedView(teamView, {
          actor: actor({
            capabilities: ["work_queue.saved_view.read"],
          }),
          intent: "share",
        }),
      "TEAM_SHARE_FORBIDDEN",
    );
    expectCode(
      () =>
        validateWorkQueueSavedView(teamView, {
          actor: actor({ teamIds: ["team:99"] }),
          intent: "read",
        }),
      "SCOPE_OWNER_MISMATCH",
    );
  });

  it("fails closed on scope/owner and personal-share mismatches", () => {
    expectCode(
      () =>
        validateWorkQueueSavedView(view({ ownerId: "user:8" }), {
          actor: actor(),
          intent: "read",
        }),
      "SCOPE_OWNER_MISMATCH",
    );
    expectCode(
      () =>
        validateWorkQueueSavedView(view({ scope: "team", ownerId: "user:7" }), {
          actor: actor(),
          intent: "read",
        }),
      "SCOPE_OWNER_MISMATCH",
    );
    expectCode(
      () =>
        validateWorkQueueSavedView(view(), {
          actor: actor(),
          intent: "share",
        }),
      "PERSONAL_SHARE_FORBIDDEN",
    );
  });

  it("rejects weakened capability contracts and absent read/manage rights", () => {
    expectCode(
      () =>
        validateWorkQueueSavedView(
          view({
            requiredCapabilities: {
              ...workQueueSavedViewRequiredCapabilities,
              share: "work_queue.saved_view.read",
            },
          }),
          { actor: actor(), intent: "read" },
        ),
      "CAPABILITY_CONTRACT_MISMATCH",
    );
    expectCode(
      () =>
        validateWorkQueueSavedView(view(), {
          actor: actor({ capabilities: [] }),
          intent: "read",
        }),
      "CAPABILITY_DENIED",
    );
    expectCode(
      () =>
        validateWorkQueueSavedView(view(), {
          actor: actor({ capabilities: ["work_queue.saved_view.read"] }),
          intent: "manage",
        }),
      "CAPABILITY_DENIED",
    );
  });

  it("rejects unknown query state, cursor, selection and invalid canonical values", () => {
    expectCode(
      () =>
        validateWorkQueueSavedView(
          view({ query: { ...view().query, unexpected: true } }),
          { actor: actor(), intent: "read" },
        ),
      "UNKNOWN_QUERY_KEY",
    );
    expectCode(
      () =>
        validateWorkQueueSavedView(
          view({ query: { ...view().query, cursor: null } }),
          { actor: actor(), intent: "read" },
        ),
      "CURSOR_FORBIDDEN",
    );
    expectCode(
      () =>
        validateWorkQueueSavedView(
          view({ query: { ...view().query, selectedCaseId: "case:7" } }),
          { actor: actor(), intent: "read" },
        ),
      "SELECTED_FORBIDDEN",
    );
    expectCode(
      () =>
        validateWorkQueueSavedView(
          view({ query: { ...view().query, queue: "everything" } }),
          { actor: actor(), intent: "read" },
        ),
      "INVALID_QUERY",
    );
  });

  it("rejects duplicate IDs and revision conflicts in a catalog", () => {
    expectCode(
      () =>
        validateWorkQueueSavedViewCatalog([view(), view()], {
          actor: actor(),
          intent: "read",
        }),
      "DUPLICATE_VIEW_ID",
    );
    expectCode(
      () =>
        validateWorkQueueSavedViewCatalog([view(), view({ revision: 4 })], {
          actor: actor(),
          intent: "read",
        }),
      "DUPLICATE_ID_REVISION_CONFLICT",
    );
    expectCode(
      () =>
        validateWorkQueueSavedViewCatalog(
          [view(), view({ name: "Changed payload" })],
          { actor: actor(), intent: "read" },
        ),
      "DUPLICATE_ID_REVISION_CONFLICT",
    );
  });

  it.each([
    ["stale", "query_contract_changed"],
    ["deleted", "deleted_by_owner"],
    ["unavailable", "source_unavailable"],
  ] as const)(
    "models %s as read-only and resets instead of applying it",
    (kind, reason) => {
      const inactive = view({ state: { kind, reason } });
      const result = applyWorkQueueSavedView(inactive, actor());

      expect(result).toEqual({
        kind,
        viewId: personalId,
        revision: 3,
        url: "/admin-v2?view=today&queue=all&limit=25",
        resetUrl: "/admin-v2?view=today&queue=all&limit=25",
      });
      expectCode(
        () =>
          validateWorkQueueSavedView(inactive, {
            actor: actor(),
            intent: "manage",
          }),
        "INACTIVE_VIEW_OPERATION",
      );
    },
  );

  it("sorts a valid catalog deterministically and keeps its output JSON-safe", () => {
    const result = validateWorkQueueSavedViewCatalog(
      [view({ id: teamId.replace("2", "9") }), view()],
      { actor: actor(), intent: "read" },
    );

    expect(result.map(({ id }) => id)).toEqual([
      personalId,
      teamId.replace("2", "9"),
    ]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("rejects top-level PII fields and contact information in names", () => {
    expectCode(
      () =>
        validateWorkQueueSavedView(view({ customerName: "Kari Nilsen" }), {
          actor: actor(),
          intent: "read",
        }),
      "INVALID_VIEW",
    );
    for (const name of [
      "kari@example.no",
      "Ring +47 999 99 999",
      "https://example.no/customer/7",
    ]) {
      expectCode(
        () =>
          validateWorkQueueSavedView(view({ name }), {
            actor: actor(),
            intent: "read",
          }),
        "INVALID_NAME",
      );
    }
  });
});
