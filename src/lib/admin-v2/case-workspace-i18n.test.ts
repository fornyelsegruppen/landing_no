import { describe, expect, it } from "vitest";
import { panelLocales } from "@/lib/panel-i18n";
import { caseWorkspaceCopies, caseWorkspaceText } from "./case-workspace-i18n";

function deepKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof child === "string" ? [path] : deepKeys(child, path);
    },
  );
}

describe("case workspace i18n", () => {
  it("keeps identical deep keys in LT, EN and NB", () => {
    const baseline = deepKeys(caseWorkspaceCopies.lt).sort();
    expect(baseline.length).toBeGreaterThan(80);

    for (const locale of panelLocales) {
      expect(deepKeys(caseWorkspaceCopies[locale]).sort()).toEqual(baseline);
    }
  });

  it("contains non-empty localized values instead of technical keys", () => {
    for (const locale of panelLocales) {
      for (const key of deepKeys(caseWorkspaceCopies[locale])) {
        const segments = key.split(".");
        let value: unknown = caseWorkspaceCopies[locale];
        for (const segment of segments) {
          value = (value as Record<string, unknown>)[segment];
        }
        expect(typeof value).toBe("string");
        expect(String(value).trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(key);
      }
    }
  });

  it("exposes typed flattened lookup for consumers", () => {
    expect(caseWorkspaceText("lt", "questions.prepare.status")).toBe(
      "Reikia parengti atsakymą",
    );
    expect(caseWorkspaceText("en", "questions.sent.status")).toBe(
      "Sent – awaiting delivery confirmation",
    );
    expect(caseWorkspaceText("nb", "sections.commercial")).toBe(
      "Pris og tilbud",
    );
  });

  it("preserves the critical question-state meanings in all admin locales", () => {
    for (const locale of panelLocales) {
      const copy = caseWorkspaceCopies[locale].questions;
      expect(copy.prepare.status).not.toBe(copy.review.status);
      expect(copy.queued.status).not.toBe(copy.sent.status);
      expect(copy.sent.status).not.toBe(copy.delivered.status);
      expect(copy.delivery_failed.status).not.toBe(copy.delivered.status);
      expect(copy.source_changed.status).not.toBe(copy.safety_rejected.status);
    }
  });

  it("keeps all process, history, state and navigation copy in the shared locale contract", () => {
    expect(caseWorkspaceCopies.lt.process).toMatchObject({
      title: "Bylos procesas",
      history: "Visa istorija",
      openStage: "Pereiti į etapą",
      states: { blocked: "Etapas užblokuotas" },
    });
    expect(caseWorkspaceCopies.en.process).toMatchObject({
      title: "Case process",
      history: "Full history",
      openStage: "Go to stage",
      states: { blocked: "Stage blocked" },
    });
    expect(caseWorkspaceCopies.nb.process).toMatchObject({
      title: "Saksprosess",
      history: "Hele historikken",
      openStage: "Gå til fase",
      states: { blocked: "Fasen er blokkert" },
    });
  });
});
