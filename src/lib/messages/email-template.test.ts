import { describe, expect, it } from "vitest";
import { buildBrandedEmailHtml } from "./email-template";

describe("branded customer email", () => {
  it("renders secure quote links as branded buttons without exposing the token", () => {
    const html = buildBrandedEmailHtml({
      subject: "Vi har mottatt henvendelsen din",
      text: "Hei!\n\nSe tilbudet: https://takfornyelse.as/tilbud/test",
    });

    expect(html).toContain(
      'src="https://www.takfornyelse.as/brand/logo.png"',
    );
    expect(html).toContain("Fornyelse Gruppen AS");
    expect(html).toContain('href="https://takfornyelse.as/tilbud/test"');
    expect(html).toContain(">Åpne ditt sikre tilbud</a>");
    expect(html).not.toContain(">https://takfornyelse.as/tilbud/test</a>");
    expect(html).toContain("background:#f0a914");
    expect(html).toContain("Org.nr. 916 693 168");
  });

  it("keeps unrelated web links as readable text links", () => {
    const html = buildBrandedEmailHtml({
      subject: "Informasjon",
      text: "Les mer: https://www.example.com/informasjon",
    });

    expect(html).toContain(
      '>https://www.example.com/informasjon</a>',
    );
    expect(html).not.toContain("Åpne ditt sikre tilbud");
  });

  it("escapes customer-controlled markup", () => {
    const html = buildBrandedEmailHtml({ subject: "<script>", text: "Hei <img src=x>" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;script&gt;");
  });
});
