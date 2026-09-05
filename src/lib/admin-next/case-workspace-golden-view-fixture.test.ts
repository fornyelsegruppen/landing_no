import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextCaseWorkspace } from "@/components/admin-next/admin-next-case-workspace";
import {
  caseWorkspaceGoldenStateFixtures,
  type CaseWorkspaceGoldenFixtureId,
} from "./case-workspace-golden-state-fixtures";
import {
  caseWorkspaceGoldenVisualFixtureStateIds,
  getCaseWorkspaceGoldenVisualFixture,
  parseCaseWorkspaceGoldenVisualFixtureState,
  projectCaseWorkspaceGoldenVisualFixture,
} from "./case-workspace-golden-view-fixture";

describe("UA-F2-005 Case Workspace visual fixture projection", () => {
  it("allowlists exactly the seven golden-state IDs and rejects ambiguous input", () => {
    expect(caseWorkspaceGoldenVisualFixtureStateIds).toEqual(
      caseWorkspaceGoldenStateFixtures.map(({ fixtureId }) => fixtureId),
    );
    for (const fixtureId of caseWorkspaceGoldenVisualFixtureStateIds) {
      expect(parseCaseWorkspaceGoldenVisualFixtureState(fixtureId)).toBe(
        fixtureId,
      );
    }
    expect(parseCaseWorkspaceGoldenVisualFixtureState(undefined)).toBeNull();
    expect(parseCaseWorkspaceGoldenVisualFixtureState("unknown")).toBeNull();
    expect(
      parseCaseWorkspaceGoldenVisualFixtureState([
        "executable_measurement_review",
      ]),
    ).toBeNull();
  });

  it.each(caseWorkspaceGoldenStateFixtures)(
    "$fixtureId projects six stages, at most one current stage and one command or fallback",
    (fixture) => {
      const value = projectCaseWorkspaceGoldenVisualFixture(fixture, "lt");
      const currentStages = value.stages.filter(
        ({ state }) => state === "current",
      );
      expect(value.stages).toHaveLength(6);
      expect(currentStages.length).toBeLessThanOrEqual(1);
      expect(value.reference).toBe(fixture.case.reference);
      if (fixture.primary.nextAction.interaction.mode === "executable") {
        expect(value.nextAction.href).toBe(
          fixture.primary.nextAction.target?.href,
        );
        expect(value.nextAction.label).toBeTruthy();
      } else {
        expect(value.nextAction.href).toBeNull();
        expect(value.nextAction.label).toBeNull();
        expect(value.fallback.caseHref).toBe("/admin-v2/cases");
      }

      const html = renderToStaticMarkup(
        createElement(AdminNextCaseWorkspace, {
          locale: "lt",
          value,
        }),
      );
      expect(html.match(/id="case-next-action-title"/gu)).toHaveLength(1);
      expect(html).toContain("xl:grid-cols-[minmax(0,1fr)_auto]");
      expect(html).not.toContain("lg:grid-cols-[minmax(0,1fr)_auto]");
      expect(html.match(/WORK_ORDER_BLOCKED/gu)?.length || 0).toBe(
        fixture.fixtureId === "blocked_work_recovery" ? 1 : 0,
      );
      if (fixture.terminal) {
        expect(html).not.toContain('aria-current="step"');
      } else {
        expect(html).toContain('aria-current="step"');
      }
      expect(html).toMatch(
        /data-audit-history-state="(?:ready|empty|denied|unavailable)"/u,
      );
    },
  );

  it.each(["nb", "lt", "en"] as const)(
    "uses the canonical %s presentation in the final workspace",
    (locale) => {
      const fixture = getCaseWorkspaceGoldenVisualFixture(
        "executable_measurement_review",
      );
      const value = projectCaseWorkspaceGoldenVisualFixture(fixture, locale);
      const presentation = fixture.primary.nextAction.presentations[locale];
      const html = renderToStaticMarkup(
        createElement(AdminNextCaseWorkspace, { locale, value }),
      );
      expect(html).toContain(presentation.copy.label);
      expect(html).toContain(presentation.copy.reason);
      expect(html).toContain(presentation.copy.cta || "");
    },
  );

  it.each([
    ["waiting_customer", "empty"],
    ["capability_read_only", "denied"],
    ["target_unavailable", "unavailable"],
    ["completed_no_action", "empty"],
  ] as const)(
    "%s renders a non-empty neutral audit %s state",
    (fixtureId, expectedState) => {
      const value = projectCaseWorkspaceGoldenVisualFixture(
        getCaseWorkspaceGoldenVisualFixture(
          fixtureId as CaseWorkspaceGoldenFixtureId,
        ),
        "lt",
      );
      const html = renderToStaticMarkup(
        createElement(AdminNextCaseWorkspace, { locale: "lt", value }),
      );
      expect(html).toContain(`data-audit-history-state="${expectedState}"`);
      expect(html).toMatch(
        new RegExp(
          `data-audit-history-state="${expectedState}"[^>]*[^<]*>[\\s\\S]*?[^<\\s][\\s\\S]*?<\\/p>`,
          "u",
        ),
      );
    },
  );
});
