import type { CaseNextActionKind } from "./case-read-model";

export function selectPrimaryCustomerQuestion<T>(input: {
  latest?: T | null;
  nextActionKind: CaseNextActionKind;
  unresolved?: T | null;
}) {
  if (input.nextActionKind === "follow_up_decline") return null;
  return input.unresolved || input.latest || null;
}
