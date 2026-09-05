import type { CaseNextActionKind } from "./case-read-model";

export type LegacyNextActionDiagnostic = {
  canonicalKind: CaseNextActionKind;
  executable: false;
  legacyTextPresent: boolean;
  status: "known" | "missing" | "unknown_legacy";
  suggestedKind: CaseNextActionKind | null;
};

const knownLegacyHints: readonly {
  pattern: RegExp;
  suggestedKind: CaseNextActionKind;
}[] = [
  {
    pattern: /kontroller.*takmåling|review measurement/iu,
    suggestedKind: "approve_measurement",
  },
  {
    pattern: /opprett arbeidsordre|create work order/iu,
    suggestedKind: "create_work_order",
  },
  {
    pattern: /tildel.*ansatt|assign.*worker/iu,
    suggestedKind: "assign_worker",
  },
  {
    pattern: /planlegg.*arbeid|schedule.*work/iu,
    suggestedKind: "schedule_work",
  },
  {
    pattern: /kunden vurderer tilbudet|customer.*review.*quote/iu,
    suggestedKind: "wait_customer",
  },
  {
    pattern: /sluttkontroll|completion review/iu,
    suggestedKind: "review_completion",
  },
  {
    pattern: /oppdraget håndteres i ansattportalen|employee portal/iu,
    suggestedKind: "wait_work_completion",
  },
];

function normalizeLegacyText(value?: string | null) {
  const normalized = value?.replace(/\s+/gu, " ").trim() || "";
  return normalized ? normalized.slice(0, 500) : null;
}

/**
 * Legacy free text is diagnostic context only. The returned canonical kind is
 * always the resolver-owned input and this projection never exposes a command,
 * target, capability, executable CTA or the raw, potentially PII-bearing text.
 */
export function projectLegacyNextActionDiagnostic(input: {
  canonicalKind: CaseNextActionKind;
  legacyText?: string | null;
}): LegacyNextActionDiagnostic {
  const legacyText = normalizeLegacyText(input.legacyText);
  if (!legacyText) {
    return {
      canonicalKind: input.canonicalKind,
      executable: false,
      legacyTextPresent: false,
      status: "missing",
      suggestedKind: null,
    };
  }
  const known = knownLegacyHints.find(({ pattern }) =>
    pattern.test(legacyText),
  );
  return {
    canonicalKind: input.canonicalKind,
    executable: false,
    legacyTextPresent: true,
    status: known ? "known" : "unknown_legacy",
    suggestedKind: known?.suggestedKind || null,
  };
}
