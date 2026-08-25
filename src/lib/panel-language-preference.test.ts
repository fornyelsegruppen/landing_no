import { describe, expect, it } from "vitest";
import {
  panelLanguagePreferenceCookie,
  serializePanelLanguagePreference,
} from "./panel-language-preference";

describe("panel language preference", () => {
  it("serializes the constrained per-browser preference", () => {
    expect(serializePanelLanguagePreference("lt", false)).toBe(
      `${panelLanguagePreferenceCookie}=lt; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  });

  it("adds Secure on HTTPS", () => {
    expect(serializePanelLanguagePreference("en", true)).toContain("; Secure");
  });
});
