import { describe, expect, it } from "vitest";
import { getAdminV2Copy } from "./i18n";

describe("admin-v2 blog preview copy", () => {
  it("describes the authenticated preview as a saved draft in every panel language", () => {
    expect(getAdminV2Copy("nb").blogAdmin.preview).toBe(
      "Forhåndsvis lagret utkast",
    );
    expect(getAdminV2Copy("lt").blogAdmin.preview).toBe(
      "Peržiūrėti išsaugotą juodraštį",
    );
    expect(getAdminV2Copy("en").blogAdmin.preview).toBe(
      "Preview saved draft",
    );
  });
});
