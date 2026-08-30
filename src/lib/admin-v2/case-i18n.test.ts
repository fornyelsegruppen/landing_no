import { describe, expect, it } from "vitest";
import { getAdminCaseCopy } from "./case-i18n";

describe("admin case i18n", () => {
  it("describes the legally safe completion document in every admin locale", () => {
    const forbidden = {
      nb: /garanti/u,
      lt: /garantij/u,
      en: /warranty/u,
    } as const;

    for (const locale of ["nb", "lt", "en"] as const) {
      const copy = getAdminCaseCopy(locale);
      expect(copy.completionConfirm).not.toMatch(forbidden[locale]);
      expect(copy.completionDone).not.toMatch(forbidden[locale]);
    }

    expect(getAdminCaseCopy("nb").completionDone).toContain(
      "arbeids- og ferdigbekreftelse",
    );
    expect(getAdminCaseCopy("lt").completionDone).toContain(
      "darbų ir užbaigimo patvirtinimas",
    );
    expect(getAdminCaseCopy("en").completionDone).toContain(
      "work-completion confirmation",
    );
  });
});
