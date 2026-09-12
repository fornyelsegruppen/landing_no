import type { PanelLocale } from "@/lib/panel-i18n";

export const blogInputLimits = {
  titleNo: 160,
  excerptNo: 500,
  contentNo: 30000,
  seoTitleNo: 160,
  seoDescriptionNo: 500,
  primaryKeyword: 160,
  reviewerName: 120,
  query: 120,
  regenerationInstructions: 2000,
  reason: 500,
} as const;
export type BlogInputField =
  | keyof typeof blogInputLimits
  | "scheduledAt"
  | "expectedUpdatedAt"
  | "request";
export type BlogFieldIssue = {
  field: BlogInputField;
  code: "required" | "too_long" | "invalid";
};
const fields = new Set<string>([
  ...Object.keys(blogInputLimits),
  "scheduledAt",
  "expectedUpdatedAt",
  "request",
]);

/** Both API and UI keep field errors bounded and never echo submitted text. */
export function parseBlogFieldIssues(value: unknown): BlogFieldIssue[] {
  if (!Array.isArray(value)) return [];
  const result: BlogFieldIssue[] = [];
  for (const item of value.slice(0, 16)) {
    if (
      !item ||
      typeof item !== "object" ||
      !fields.has(item.field) ||
      !["required", "too_long", "invalid"].includes(item.code)
    )
      continue;
    if (!result.some((issue) => issue.field === item.field))
      result.push({ field: item.field, code: item.code });
  }
  return result;
}

export function blogDraftFieldIssues(
  values: Record<string, unknown>,
): BlogFieldIssue[] {
  const issues: BlogFieldIssue[] = [];
  for (const field of [
    "titleNo",
    "contentNo",
    "excerptNo",
    "seoTitleNo",
    "seoDescriptionNo",
    "primaryKeyword",
  ] as const) {
    const value = values[field];
    const required = field === "titleNo" || field === "contentNo";
    if (value === undefined && !required) continue;
    if (typeof value !== "string")
      issues.push({
        field,
        code: value === undefined ? "required" : "invalid",
      });
    else if (required && !value.trim())
      issues.push({ field, code: "required" });
    else if (value.trim().length > blogInputLimits[field])
      issues.push({ field, code: "too_long" });
  }
  return issues;
}

const validationCopy = {
  lt: {
    required: "Užpildykite šį laukelį.",
    invalid: "Patikrinkite šio laukelio reikšmę.",
    too_long: "Galima įvesti ne daugiau kaip {limit} simbolių.",
    summary: "Patikrinkite pažymėtus laukelius. Pakeitimai dar neišsaugoti.",
  },
  nb: {
    required: "Fyll ut dette feltet.",
    invalid: "Kontroller verdien i dette feltet.",
    too_long: "Feltet kan inneholde høyst {limit} tegn.",
    summary: "Kontroller de markerte feltene. Endringene er ikke lagret ennå.",
  },
  en: {
    required: "Complete this field.",
    invalid: "Check the value in this field.",
    too_long: "Enter no more than {limit} characters.",
    summary: "Check the highlighted fields. Your changes have not been saved.",
  },
};
export function blogFieldIssueMessage(
  issue: BlogFieldIssue,
  locale: PanelLocale,
) {
  const limit = blogInputLimits[issue.field as keyof typeof blogInputLimits];
  return validationCopy[locale][issue.code].replace(
    "{limit}",
    String(limit || ""),
  );
}
export function blogValidationSummary(locale: PanelLocale) {
  return validationCopy[locale].summary;
}

const gateCopy = {
  QUALITY_NOT_READY: {
    lt: "Straipsnis dar neišlaikė kokybės patikros. Juodraštis išsaugotas; prieš patvirtindami pašalinkite kokybės klaidas.",
    nb: "Artikkelen har ikke bestått kvalitetskontrollen. Utkastet er lagret; rett kvalitetsfeilene før godkjenning.",
    en: "The article has not passed its quality check. The draft is saved; resolve the quality issues before approval.",
  },
  INVALID_TRANSITION: {
    lt: "Šis veiksmas negalimas esant dabartinei straipsnio būsenai. Patikrinkite peržiūros ir patvirtinimo reikalavimus.",
    nb: "Handlingen er ikke tilgjengelig i artikkelens nåværende status. Kontroller kravene til gjennomgang og godkjenning.",
    en: "This action is unavailable in the article's current state. Check the review and approval requirements.",
  },
  REVIEWER_REQUIRED: {
    lt: "Nurodykite straipsnį tikrinantį specialistą.",
    nb: "Oppgi den faglige kontrolløren.",
    en: "Enter the article reviewer.",
  },
  FUTURE_SCHEDULE_REQUIRED: {
    lt: "Pasirinkite būsimą publikavimo laiką.",
    nb: "Velg et fremtidig publiseringstidspunkt.",
    en: "Choose a future publication time.",
  },
  PUBLICATION_NOT_READY: {
    lt: "Publikavimas užblokuotas. Patikrinkite kokybę, šaltinius ir išsaugotą specialisto patvirtinimą.",
    nb: "Publisering er blokkert. Kontroller kvalitet, kilder og lagret faglig godkjenning.",
    en: "Publication is blocked. Check quality, sources and the saved expert approval.",
  },
};
export function blogGateErrorMessage(
  code: string | undefined,
  locale: PanelLocale,
): string | null {
  return code && Object.hasOwn(gateCopy, code)
    ? gateCopy[code as keyof typeof gateCopy][locale]
    : null;
}
