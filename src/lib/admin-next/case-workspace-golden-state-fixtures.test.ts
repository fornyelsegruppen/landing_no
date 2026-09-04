import { describe, expect, it } from "vitest";
import { getCaseNextActionPresentation } from "@/lib/admin-v2/case-next-action-presentation";
import {
  caseWorkspaceGoldenFixtureMarker,
  caseWorkspaceGoldenFixtureNow,
  caseWorkspaceGoldenStageOrder,
  caseWorkspaceGoldenStateFixtures,
  CaseWorkspaceGoldenFixtureError,
  validateCaseWorkspaceGoldenStateFixture,
  type CaseWorkspaceGoldenFixture,
  type CaseWorkspaceGoldenFixtureId,
} from "./case-workspace-golden-state-fixtures";

function byId(id: CaseWorkspaceGoldenFixtureId) {
  const result = caseWorkspaceGoldenStateFixtures.find(
    ({ fixtureId }) => fixtureId === id,
  );
  if (!result) throw new Error(`Missing fixture ${id}`);
  return result;
}

function mutable(id: CaseWorkspaceGoldenFixtureId) {
  return structuredClone(byId(id)) as CaseWorkspaceGoldenFixture;
}

describe("UA-F2-005 CaseWorkspace golden-state fixture matrix", () => {
  it("contains the seven required explicit synthetic states", () => {
    expect(
      caseWorkspaceGoldenStateFixtures.map(({ fixtureId }) => fixtureId),
    ).toEqual([
      "executable_measurement_review",
      "waiting_customer",
      "overdue_unassigned",
      "blocked_work_recovery",
      "capability_read_only",
      "target_unavailable",
      "completed_no_action",
    ]);
    expect(
      new Set(caseWorkspaceGoldenStateFixtures.map(({ case: item }) => item.id))
        .size,
    ).toBe(caseWorkspaceGoldenStateFixtures.length);
  });

  it.each(caseWorkspaceGoldenStateFixtures)(
    "$fixtureId passes the runtime fixture invariant gate",
    (fixture) => {
      expect(validateCaseWorkspaceGoldenStateFixture(fixture)).toBe(fixture);
    },
  );

  it("has exactly six monotonic stages and one current or terminal completion", () => {
    for (const fixture of caseWorkspaceGoldenStateFixtures) {
      expect(fixture.stages.map(({ id }) => id)).toEqual(
        caseWorkspaceGoldenStageOrder,
      );
      expect(fixture.stages).toHaveLength(6);
      const current = fixture.stages.filter(({ state }) => state === "current");
      if (fixture.terminal) {
        expect(current).toHaveLength(0);
        expect(fixture.stages.every(({ state }) => state === "complete")).toBe(
          true,
        );
      } else {
        expect(current).toHaveLength(1);
        const currentIndex = fixture.stages.indexOf(current[0]);
        expect(
          fixture.stages.every(({ state }, index) =>
            index < currentIndex
              ? state === "complete"
              : index === currentIndex
                ? state === "current"
                : state === "upcoming",
          ),
        ).toBe(true);
      }
    }
  });

  it("uses canonical NB/LT/EN presentation for every next-action kind", () => {
    for (const fixture of caseWorkspaceGoldenStateFixtures) {
      const { nextAction } = fixture.primary;
      for (const locale of ["nb", "lt", "en"] as const) {
        expect(nextAction.presentations[locale]).toEqual(
          getCaseNextActionPresentation(nextAction.kind, locale),
        );
      }
      expect(nextAction.presentations.nb.copy).not.toEqual(
        nextAction.presentations.lt.copy,
      );
      expect(nextAction.presentations.lt.copy).not.toEqual(
        nextAction.presentations.en.copy,
      );
    }
  });

  it("keeps status, risk and version as independent dimensions", () => {
    for (const fixture of caseWorkspaceGoldenStateFixtures) {
      expect(Object.keys(fixture.status).sort()).toEqual([
        "caseState",
        "lifecycle",
      ]);
      expect(Object.keys(fixture.risk).sort()).toEqual(["code", "level"]);
      expect(Object.keys(fixture.version).sort()).toEqual([
        "caseRevision",
        "projectionVersion",
        "targetVersion",
      ]);
      expect(fixture.version.caseRevision).toBeGreaterThan(0);
    }
  });

  it("models executable, waiting, overdue/unassigned and blocked recovery distinctly", () => {
    expect(byId("executable_measurement_review")).toMatchObject({
      status: { caseState: "needs_action" },
      risk: { code: "MEASUREMENT_REVIEW" },
      primary: {
        nextAction: {
          kind: "approve_measurement",
          interaction: { mode: "executable", activation: "open_workbench" },
          target: { entity: "measurement", id: "measurement:9101" },
        },
      },
    });
    expect(byId("waiting_customer")).toMatchObject({
      status: { caseState: "waiting" },
      primary: {
        nextAction: {
          kind: "wait_customer",
          interaction: { mode: "waiting", waitingParty: "customer" },
          timing: { dueAt: null, wakeAt: "2026-09-08T08:00:00.000Z" },
        },
      },
    });

    const overdue = byId("overdue_unassigned");
    expect(overdue.primary.nextAction.owner.id).toBeNull();
    expect(overdue.risk).toEqual({
      level: "high",
      code: "SLA_OVERDUE_UNASSIGNED",
    });
    expect(
      Date.parse(overdue.primary.nextAction.timing.dueAt || ""),
    ).toBeLessThan(Date.parse(caseWorkspaceGoldenFixtureNow));

    const blocked = byId("blocked_work_recovery");
    expect(blocked.primary.blocker).toEqual({
      code: "WORK_ORDER_BLOCKED",
      source: { type: "work_order", id: "work_order:9404" },
    });
    expect(blocked.primary.recovery).toEqual({
      kind: "open_exact_target",
      targetId: "work_order:9404",
    });
  });

  it("separates capability denial, target absence and terminal no-action", () => {
    expect(byId("capability_read_only")).toMatchObject({
      primary: {
        nextAction: {
          capability: { granted: false },
          targetState: "exact",
          interaction: { mode: "read_only", reason: "capability_denied" },
        },
      },
    });
    expect(byId("target_unavailable")).toMatchObject({
      primary: {
        nextAction: {
          capability: { granted: true },
          targetState: "unavailable",
          target: null,
          interaction: { mode: "read_only", reason: "target_unavailable" },
        },
      },
    });
    expect(byId("completed_no_action")).toMatchObject({
      terminal: true,
      status: { lifecycle: "closed", caseState: "complete" },
      risk: { level: "none", code: "NONE" },
      primary: {
        nextAction: {
          kind: "none",
          interaction: { mode: "read_only", reason: "no_action" },
        },
        blocker: null,
        recovery: null,
      },
    });
  });

  it("has one primary action, at most one blocker and no duplicate blocker collection", () => {
    for (const fixture of caseWorkspaceGoldenStateFixtures) {
      expect(fixture.primary.nextAction).toBeTypeOf("object");
      expect(Array.isArray(fixture.primary.nextAction)).toBe(false);
      expect(Array.isArray(fixture.primary.blocker)).toBe(false);
      expect(fixture.primary).not.toHaveProperty("nextActions");
      expect(fixture.primary).not.toHaveProperty("blockers");
    }
    expect(
      caseWorkspaceGoldenStateFixtures.filter(
        ({ primary }) => primary.blocker !== null,
      ),
    ).toHaveLength(1);
  });

  it("uses only exact operator targets or an explicit unavailable state", () => {
    for (const fixture of caseWorkspaceGoldenStateFixtures) {
      const action = fixture.primary.nextAction;
      if (!action.target) {
        expect(action.targetState).toBe("unavailable");
        expect(action.interaction).toEqual({
          mode: "read_only",
          reason: "target_unavailable",
        });
        continue;
      }
      const caseNumber = fixture.case.id.slice("case:".length);
      expect(action.targetState).toBe("exact");
      expect(action.target.href).toMatch(
        /^\/(?:admin-v2|admin-next-preview)(?:[/?]|$)/u,
      );
      expect(action.target.href).toContain(`/cases/${caseNumber}`);
      expect(action.target.href).not.toMatch(/^\/admin(?:[/?]|$)/u);
    }
  });

  it("is explicitly synthetic, never canonical fallback, and JSON-safe", () => {
    for (const fixture of caseWorkspaceGoldenStateFixtures) {
      expect(fixture.source).toEqual({
        kind: "synthetic_fixture",
        marker: caseWorkspaceGoldenFixtureMarker,
        fixtureOnly: true,
        canonicalEligibility: "forbidden",
      });
      const serialized = JSON.stringify(fixture);
      expect(serialized.toLowerCase()).not.toContain("demo");
      expect(serialized.toLowerCase()).not.toContain("fallback");
      expect(JSON.parse(serialized)).toEqual(fixture);
    }
  });

  it("fails closed when stage, localization, target or blocker invariants drift", () => {
    const stage = mutable("waiting_customer");
    stage.stages = stage.stages.map((item) => ({ ...item, state: "upcoming" }));
    expect(() => validateCaseWorkspaceGoldenStateFixture(stage)).toThrowError(
      CaseWorkspaceGoldenFixtureError,
    );

    const localized = mutable("executable_measurement_review");
    localized.primary.nextAction.presentations.lt.copy.label = "Tampered";
    expect(() =>
      validateCaseWorkspaceGoldenStateFixture(localized),
    ).toThrowError(CaseWorkspaceGoldenFixtureError);

    const target = mutable("overdue_unassigned");
    if (!target.primary.nextAction.target)
      throw new Error("Missing test target");
    target.primary.nextAction.target.href = "/admin-v2/cases";
    expect(() => validateCaseWorkspaceGoldenStateFixture(target)).toThrowError(
      CaseWorkspaceGoldenFixtureError,
    );

    const blocker = mutable("blocked_work_recovery");
    blocker.primary.blocker = [
      blocker.primary.blocker,
      blocker.primary.blocker,
    ] as unknown as CaseWorkspaceGoldenFixture["primary"]["blocker"];
    expect(() => validateCaseWorkspaceGoldenStateFixture(blocker)).toThrowError(
      CaseWorkspaceGoldenFixtureError,
    );
  });
});
