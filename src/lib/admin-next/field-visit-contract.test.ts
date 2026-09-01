import { describe, expect, it } from "vitest";
import {
  adminNextFieldVisitStates,
  loadAdminNextFieldVisit,
  parseAdminNextFieldVisitState,
} from "@/lib/admin-next/field-visit-contract";
import {
  adminNextFixtureFieldVisitAdapter,
  buildAdminNextFieldVisitFixture,
} from "@/lib/admin-next/field-visit-fixture";

describe("Admin Next field visit contract", () => {
  it("supports exactly the four approved worker states", () => {
    expect(adminNextFieldVisitStates).toEqual([
      "assigned",
      "on_way",
      "onsite",
      "in_progress",
    ]);
    expect(parseAdminNextFieldVisitState("unexpected")).toBe("assigned");
  });

  it("keeps synthetic progress deterministic for every state", () => {
    const visits = adminNextFieldVisitStates.map((state) =>
      buildAdminNextFieldVisitFixture(state),
    );
    expect(visits.map(({ state }) => state)).toEqual(adminNextFieldVisitStates);
    expect(visits[2].evidence.find(({ id }) => id === "before")?.completed).toBe(2);
    expect(visits[3].evidence.find(({ id }) => id === "during")?.completed).toBe(2);
    expect(visits.every(({ fallbackHref }) => fallbackHref.startsWith("/user/"))).toBe(true);
  });

  it("keeps completion fail-closed in all four Preview states", () => {
    for (const state of adminNextFieldVisitStates) {
      const visit = buildAdminNextFieldVisitFixture(state);
      expect(visit.completionGates.every(({ state: gate }) => gate === "verified")).toBe(false);
    }
  });

  it("normalizes references and hides unknown visits", async () => {
    await expect(
      loadAdminNextFieldVisit(
        adminNextFixtureFieldVisitAdapter,
        " wv-2048 ",
        "onsite",
      ),
    ).resolves.toMatchObject({ status: "ready", source: "fixture" });
    await expect(
      loadAdminNextFieldVisit(
        adminNextFixtureFieldVisitAdapter,
        "WV-UNKNOWN",
        "assigned",
      ),
    ).resolves.toEqual({ status: "not_found" });
  });
});
