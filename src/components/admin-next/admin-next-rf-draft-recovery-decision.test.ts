import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  resolveRfDraftRecoveryDecision,
  RF_DRAFT_RECOVERY_CONTRACT_VERSION,
  type RfDraftRecoveryInput,
} from "@/lib/admin-next/rf-draft-recovery-contract";
import { AdminNextRfDraftRecoveryDecision } from "./admin-next-rf-draft-recovery-decision";

function recoveryInput(): RfDraftRecoveryInput {
  const current = {
    case: { caseId: "lead:13", addressRevision: 7 },
    source: { id: "source-13", revision: 4, hash: "a".repeat(64) },
    snapshot: { id: "snapshot-13", revision: 3, hash: "b".repeat(64) },
  };
  const draft = { id: "draft-13", revision: 5, hash: "c".repeat(64) };
  return {
    version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
    vercelEnvironment: "preview",
    capabilities: ["roof_fusion.draft.continue", "roof_fusion.draft.create"],
    current,
    persistedDraft: {
      draft,
      recoveryBinding: {
        version: RF_DRAFT_RECOVERY_CONTRACT_VERSION,
        draft: { ...draft },
        case: { ...current.case },
        source: { ...current.source },
        snapshot: { ...current.snapshot },
      },
    },
  };
}

function render(input: RfDraftRecoveryInput, locale: "nb" | "lt" | "en") {
  return renderToStaticMarkup(
    createElement(AdminNextRfDraftRecoveryDecision, {
      decision: resolveRfDraftRecoveryDecision(input),
      locale,
      onContinueOld: vi.fn(),
      onStartNew: vi.fn(),
    }),
  );
}

describe("Admin Next RF draft recovery decision", () => {
  it.each([
    ["nb", "Fortsett tidligere utkast", "Start ny måling"],
    ["lt", "Tęsti seną juodraštį", "Pradėti naują matavimą"],
    ["en", "Continue old draft", "Start new measurement"],
  ] as const)(
    "renders both exact-binding choices in %s",
    (locale, oldLabel, newLabel) => {
      const html = render(recoveryInput(), locale);

      expect(html).toContain('data-rf-draft-recovery="continue_or_start_new"');
      expect(html).toContain('data-rf-recovery-scope="preview_only"');
      expect(html).toContain('data-rf-commercial-use="forbidden"');
      expect(html).toContain(oldLabel);
      expect(html).toContain(newLabel);
      expect(html).toContain("lead:13");
      expect(html).toContain("7");
      expect(html).not.toContain('disabled=""');
    },
  );

  it("explains an address revision change and disables Continue old", () => {
    const value = recoveryInput();
    value.current.case.addressRevision = 8;
    const html = render(value, "lt");

    expect(html).toContain('data-rf-draft-recovery="start_new_only"');
    expect(html).toContain("Bylos adresas pakeistas po juodraščio sukūrimo");
    expect(html).toContain("kainodarai bei pasiūlymui");
    expect(html).toMatch(
      /data-rf-draft-recovery-action="continue_old"[^>]*disabled=""/u,
    );
    expect(html).toMatch(
      /data-rf-draft-recovery-action="start_new"(?![^>]*disabled)/u,
    );
  });

  it("disables both choices outside Preview", () => {
    const value = recoveryInput();
    value.vercelEnvironment = "production";
    const html = render(value, "en");

    expect(html.match(/disabled=""/gu)).toHaveLength(2);
    expect(html.match(/Available in Preview only/gu)).toHaveLength(2);
    expect(html).toContain("exact hash");
  });

  it("does not render an address or editable address control", () => {
    const html = render(recoveryInput(), "en");

    expect(html).not.toContain("street");
    expect(html).not.toContain("postal");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<form");
  });
});
