import { describe, expect, it } from "vitest";
import { statusLabel, timelineTypeLabel } from "./labels";

describe("admin timeline labels", () => {
  it("localizes contract request status and event type", () => {
    expect(statusLabel("lt", "admin_review")).toBe("Laukia administratoriaus sprendimo");
    expect(timelineTypeLabel("lt", "contract_request")).toBe("Atsisakymo arba pakeitimo pranešimas");
    expect(statusLabel("nb", "follow_up_scheduled")).toBe("Oppfølging planlagt");
  });
});
