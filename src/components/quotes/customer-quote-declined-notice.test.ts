import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CustomerQuoteDeclinedNotice } from "./customer-quote";

describe("customer quote declined notice", () => {
  it("clearly confirms that the exact offer is declined and cannot be signed", () => {
    const html = renderToStaticMarkup(
      createElement(CustomerQuoteDeclinedNotice, {
        reference: "T-17-V1",
      }),
    );

    expect(html).toContain("Tilbudet T-17-V1 er avslått");
    expect(html).toContain("Tilbudet kan ikke lenger signeres");
    expect(html).toContain("du trenger ikke gjøre noe mer");
    expect(html).toContain('id="quote-declined-status"');
    expect(html).toContain('role="status"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain("border-danger/50");
  });
});
