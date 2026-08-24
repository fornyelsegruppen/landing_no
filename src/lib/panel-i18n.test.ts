import { describe, expect, it } from "vitest";
import {
  getAdminCopy,
  getWorkerCopy,
  normalizePanelLocale,
  panelDateLocale,
} from "./panel-i18n";

describe("panel interface languages", () => {
  it("supports Norwegian, Lithuanian and English with a safe Norwegian fallback", () => {
    expect(normalizePanelLocale("nb")).toBe("nb");
    expect(normalizePanelLocale("lt")).toBe("lt");
    expect(normalizePanelLocale("en")).toBe("en");
    expect(normalizePanelLocale("no")).toBe("nb");
    expect(normalizePanelLocale(null)).toBe("nb");
  });

  it("provides translated worker navigation and status labels", () => {
    expect(getWorkerCopy("nb").mineJobs).toBe("Mine oppdrag");
    expect(getWorkerCopy("lt").mineJobs).toBe("Mano darbai");
    expect(getWorkerCopy("en").mineJobs).toBe("My jobs");
    expect(getWorkerCopy("lt").status.in_progress).toBe("Vykdoma");
  });

  it("provides translated custom admin dashboard labels", () => {
    expect(getAdminCopy("lt").overview).toBe("Apžvalga");
    expect(getAdminCopy("en").cards.pendingQuotes).toBe("Quotes for approval");
    expect(getAdminCopy("nb").aiBlog).toBe("AI-assistert blogg");
  });

  it("uses locale-specific number and date formatting locales", () => {
    expect(panelDateLocale("nb")).toBe("nb-NO");
    expect(panelDateLocale("lt")).toBe("lt-LT");
    expect(panelDateLocale("en")).toBe("en-GB");
  });
});
