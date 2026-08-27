import { describe, expect, it } from "vitest";
import {
  buildBrandedEmailHtml,
  secureCustomerLinkLabel,
} from "./email-template";

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

  it("uses a customer-portal label for the final contract email", () => {
    const html = buildBrandedEmailHtml({
      subject: "Endelig signert kontrakt K-10-V1",
      text: "Administrer avtalen via din sikre kundelenke:\nhttps://www.takfornyelse.as/tilbud/secure-token",
      secureLinkLabel: secureCustomerLinkLabel("contract"),
    });

    expect(html).toContain(">Åpne din sikre kundeside</a>");
    expect(html).not.toContain(">Åpne ditt sikre tilbud</a>");
  });

  it("uses distinct labels for reminders and change agreements", () => {
    expect(secureCustomerLinkLabel("quote")).toBe(
      "Åpne ditt sikre tilbud",
    );
    expect(secureCustomerLinkLabel("reminder")).toBe("Åpne tilbudet");
    expect(secureCustomerLinkLabel("change_agreement")).toBe(
      "Åpne endringsavtalen",
    );

    const html = buildBrandedEmailHtml({
      subject: "Endringsavtale E-10-V1",
      text: "Kontroller endringen:\nhttps://www.takfornyelse.as/endring/secure-token",
      secureLinkLabel: secureCustomerLinkLabel("change_agreement"),
    });
    expect(html).toContain(">Åpne endringsavtalen</a>");
  });

  it("renders an authenticated employee-portal link as a clear branded button", () => {
    const html = buildBrandedEmailHtml({
      subject: "Oppdrag A-K-18-V1",
      text: "Åpne oppdraget:\nhttps://www.takfornyelse.as/user/arbeid/18",
      secureLinkLabel: "Åpne oppdraget i medarbeiderportalen",
    });

    expect(html).toContain('href="https://www.takfornyelse.as/user/arbeid/18"');
    expect(html).toContain(">Åpne oppdraget i medarbeiderportalen</a>");
    expect(html).not.toContain(">https://www.takfornyelse.as/user/arbeid/18</a>");
  });

  it("escapes customer-controlled markup", () => {
    const html = buildBrandedEmailHtml({ subject: "<script>", text: "Hei <img src=x>" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;script&gt;");
  });
});
