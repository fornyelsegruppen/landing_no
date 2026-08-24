import { describe, expect, it } from "vitest";
import { buildBrandedEmailHtml } from "./email-template";

describe("branded customer email", () => {
  it("renders the Takfornyelse identity and turns secure links into anchors", () => {
    const html = buildBrandedEmailHtml({
      subject: "Vi har mottatt henvendelsen din",
      text: "Hei!\n\nSe tilbudet: https://takfornyelse.as/tilbud/test",
    });

    expect(html).toContain(
      'src="https://www.takfornyelse.as/brand/logo.png"',
    );
    expect(html).toContain("Fornyelse Gruppen AS");
    expect(html).toContain('href="https://takfornyelse.as/tilbud/test"');
    expect(html).toContain("Org.nr. 916 693 168");
  });

  it("escapes customer-controlled markup", () => {
    const html = buildBrandedEmailHtml({ subject: "<script>", text: "Hei <img src=x>" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;script&gt;");
  });
});
