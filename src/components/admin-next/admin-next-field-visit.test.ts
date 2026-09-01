import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextFieldVisit } from "@/components/admin-next/admin-next-field-visit";
import { adminNextFieldVisitStates } from "@/lib/admin-next/field-visit-contract";
import { buildAdminNextFieldVisitFixture } from "@/lib/admin-next/field-visit-fixture";

describe("Admin Next field visit", () => {
  it("renders all four state views with safe state navigation", () => {
    for (const state of adminNextFieldVisitStates) {
      const html = renderToStaticMarkup(
        createElement(AdminNextFieldVisit, {
          locale: "lt",
          visit: buildAdminNextFieldVisitFixture(state),
          stateHrefBase: "/admin-next-field-visit-fixture",
        }),
      );
      expect(html).toContain(`state=${state}`);
      expect(html).toContain("WV-2048");
      expect(html).toContain("disabled=\"\"");
      expect(html).toContain("Preview nekeičia canonical būsenos");
    }
  });

  it("shows onsite readiness blockers and in-progress completion gates", () => {
    const onsite = renderToStaticMarkup(
      createElement(AdminNextFieldVisit, {
        locale: "lt",
        visit: buildAdminNextFieldVisitFixture("onsite"),
        stateHrefBase: "/admin-next-field-visit-fixture",
      }),
    );
    expect(onsite).toContain("trūksta saugos patikros ir 2 nuotraukų");

    const inProgress = renderToStaticMarkup(
      createElement(AdminNextFieldVisit, {
        locale: "lt",
        visit: buildAdminNextFieldVisitFixture("in_progress"),
        stateHrefBase: "/admin-next-field-visit-fixture",
      }),
    );
    expect(inProgress).toContain("Baigimo vartai");
    expect(inProgress).toContain("Darbo trukmė");
    expect(inProgress).toContain("2/3");
  });
});
