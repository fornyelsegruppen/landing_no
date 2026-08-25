export type RemediationScenario = {
  id: string;
  customer: {
    email?: string;
    name: string;
    phone?: string;
  };
  expectedOutcome: string;
  input: Record<string, unknown>;
};

const syntheticCustomer = (id: string, contact: "email" | "phone" | "both" = "both") => ({
  name: `QA Customer ${id}`,
  ...(contact !== "phone" ? { email: `qa-${id}@example.invalid` } : {}),
  ...(contact !== "email" ? { phone: `+479000${id.padStart(4, "0")}` } : {}),
});

export const remediationScenarios: readonly RemediationScenario[] = [
  { id: "single-building", customer: syntheticCustomer("0001"), input: { addressMode: "single", inquiryType: "takvask" }, expectedOutcome: "measurement_review" },
  { id: "multiple-buildings", customer: syntheticCustomer("0002"), input: { addressMode: "ambiguous", inquiryType: "takvask" }, expectedOutcome: "building_selection" },
  { id: "manual-no-visual", customer: syntheticCustomer("0003"), input: { addressMode: "not_found", manualAreaSqm: 140, manualAreaSource: "administrator_estimate" }, expectedOutcome: "manual_measurement_review" },
  { id: "customer-question", customer: syntheticCustomer("0004"), input: { customerAction: "question" }, expectedOutcome: "reply_draft_review" },
  { id: "customer-decline", customer: syntheticCustomer("0005"), input: { customerAction: "decline", reason: "price" }, expectedOutcome: "decline_follow_up" },
  { id: "price-change", customer: syntheticCustomer("0006"), input: { manualAreaSqm: 180, unitPriceExVatOre: 11000 }, expectedOutcome: "commercial_review" },
  { id: "tolerance-exceeded", customer: syntheticCustomer("0007"), input: { contractedAreaSqm: 100, onsiteAreaSqm: 130 }, expectedOutcome: "change_agreement_required" },
  { id: "email-hard-bounce", customer: syntheticCustomer("0008"), input: { delivery: "hard_bounce" }, expectedOutcome: "sms_fallback" },
  { id: "phone-only", customer: syntheticCustomer("0009", "phone"), input: { delivery: "no_email" }, expectedOutcome: "sms_fallback" },
  { id: "completed-archived", customer: syntheticCustomer("0010"), input: { workStatus: "documented", recordState: "archived" }, expectedOutcome: "closed_archive" },
] as const;

export function validateSyntheticScenarioPack(scenarios: readonly RemediationScenario[] = remediationScenarios) {
  const ids = new Set<string>();
  for (const scenario of scenarios) {
    if (ids.has(scenario.id)) throw new Error(`Duplicate remediation scenario: ${scenario.id}`);
    ids.add(scenario.id);
    if (scenario.customer.email && !scenario.customer.email.endsWith("@example.invalid")) {
      throw new Error(`Scenario ${scenario.id} does not use a reserved synthetic email domain`);
    }
    if (scenario.customer.phone && !scenario.customer.phone.startsWith("+479000")) {
      throw new Error(`Scenario ${scenario.id} does not use the reserved QA phone range`);
    }
  }
  return true;
}

