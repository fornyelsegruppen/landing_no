import { describe, expect, it } from "vitest";
import {
  isGuideNavigationHref,
  withGuideNavigation,
} from "./public-navigation";

describe("public guide navigation", () => {
  it("recognizes localized and canonical internal guide links", () => {
    expect(isGuideNavigationHref("/blogg")).toBe(true);
    expect(isGuideNavigationHref("/no/blogg/")).toBe(true);
    expect(isGuideNavigationHref("https://www.takfornyelse.as/en/blogg")).toBe(
      true,
    );
    expect(isGuideNavigationHref("https://example.com/blogg")).toBe(false);
    expect(isGuideNavigationHref("/blogg/annen-artikkel")).toBe(false);
  });

  it("adds the guide before contact in a built-in menu", () => {
    expect(
      withGuideNavigation(
        [
          { href: "/#tjenester", label: "Tjenester" },
          { href: "/#kontakt", label: "Kontakt" },
        ],
        "no",
      ),
    ).toEqual([
      { href: "/#tjenester", label: "Tjenester" },
      { href: "/blogg", label: "Råd og guider" },
      { href: "/#kontakt", label: "Kontakt" },
    ]);
  });

  it("keeps one standardized guide entry when CMS has duplicates", () => {
    expect(
      withGuideNavigation(
        [
          { href: "/no/blogg", label: "Old label" },
          { href: "/blogg/", label: "Another label" },
          { href: "/kontakt", label: "Contact" },
        ],
        "en",
      ),
    ).toEqual([
      { href: "/blogg", label: "Advice & guides" },
      { href: "/kontakt", label: "Contact" },
    ]);
  });
});
