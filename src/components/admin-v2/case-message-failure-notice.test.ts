import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseMessageFailureNotice } from "./case-message-failure-notice";

describe("CaseMessageFailureNotice", () => {
  it("renders localized safe copy without accepting provider raw text", () => {
    const html = renderToStaticMarkup(
      createElement(CaseMessageFailureNotice, {
        failureCode: "UNKNOWN_PROVIDER_FAILURE",
        locale: "lt",
      }),
    );

    expect(html).toContain("Pristatymo užbaigti nepavyko");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("UNKNOWN_PROVIDER_FAILURE");
  });
});
