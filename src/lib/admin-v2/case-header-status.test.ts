import { describe, expect, it } from "vitest";
import { caseHeaderStatus } from "./case-header-status";

describe("case header status", () => {
  it.each([
    ["lt", "Klientas atsisakė pasiūlymo"],
    ["nb", "Kunden avslo tilbudet"],
    ["en", "Customer declined the offer"],
  ] as const)(
    "lets the decline state override a stale waiting status in %s",
    (locale, label) => {
      expect(
        caseHeaderStatus({
          leadStatus: "customer_waiting",
          locale,
          nextActionKind: "follow_up_decline",
        }),
      ).toEqual({ label, tone: "danger" });
    },
  );

  it("keeps the normal lead status outside the decline flow", () => {
    expect(
      caseHeaderStatus({
        leadStatus: "customer_waiting",
        locale: "lt",
        nextActionKind: "prepare_question_reply",
      }),
    ).toEqual({ label: "Klientas laukia atsakymo", tone: "accent" });
  });
});
