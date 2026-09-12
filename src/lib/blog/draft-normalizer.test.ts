import { describe, expect, it } from "vitest";
import { normalizeGeneratedArticleDraft } from "./draft-normalizer";
import { validGeneratedArticle } from "./test-fixtures";

describe("generated article normalizer", () => {
  it("replaces only approved language and package copy before quality gates", () => {
    const input = validGeneratedArticle({
      content: `## Pakker
* **Basic fra 99 kr/m² + mva:** Standard overflatebehandling.
* Standard – Impregnering som styrker taksteinen.
* **Premium:** Dypere beskyttelse og maling.

Tak med høyt monterte flater krever ekstra omtanke under utførelsen. Impregnering som redusere fuktopptak omtales forsiktig. Taket har organisk materiale som mose og sot. Be om postnummer, valgfri adresse og gjerne bilder, uten å love endelig teknisk konklusjon eller pris.

Når man vurderer å friske opp boligens øverste flater, dukker spørsmålet om timing naturlig opp. For at en takvask og påfølgende behandlinger skal få gode vilkår, må klimaet spille på lag. Lang soltid og varmere luft tørker opp taket raskt. Mange opplever at høsten bringer mye fuktighet og nedfall i form av blader.

For å forberede vurderingen kan kunden oppgi postnummer, valgfri adresse og gjerne sende bilder. Dette er bakgrunnsinformasjon, ikke en teknisk konklusjon eller et bindende pristilbud.`,
    });

    const result = normalizeGeneratedArticleDraft(input) as ReturnType<
      typeof validGeneratedArticle
    >;

    expect(result.content).toContain(
      "- Basic takvask fra 123,75 kr/m² inkl. mva (99 kr/m² ekskl. mva): taksjekk, mosebehandling og skånsom takvask.",
    );
    expect(result.content).toContain(
      "- Standard fra 172,50 kr/m² inkl. mva (138 kr/m² ekskl. mva): alt i Basic, samt beskyttende impregnering som reduserer fuktopptak på egnet takstein.",
    );
    expect(result.content).toContain(
      "- Premium fra 421,25 kr/m² inkl. mva (337 kr/m² ekskl. mva): alt i Standard, samt profesjonell takmaling",
    );
    expect(result.content).toContain("vanskelig tilgjengelige takflater");
    expect(result.content).toContain("ekstra sikkerhetstiltak");
    expect(result.content).toContain("mose, lav, alger og smuss");
    expect(result.content).toContain(
      "For å forberede vurderingen kan du oppgi postnummer",
    );
    expect(result.content).toContain(
      "Når du vurderer å vaske taket, er tidspunktet viktig.",
    );
    expect(result.content).toContain(
      "Lange, varme dager kan bidra til at taket tørker raskere.",
    );
    expect(result.content).toContain(
      "Be om en gratis og uforpliktende vurdering.",
    );
    expect(result.content).not.toMatch(
      /styrker taksteinen|som redusere\b|høyt monterte|organisk materiale|uten å love|boligens øverste|lang soltid|kan kunden oppgi/i,
    );
  });

  it("normalizes the remaining Bokmål and CTA defects from post 7", () => {
    const input = validGeneratedArticle({
      title: "Tegn på at taket må ha andre tiltak",
      content:
        "Det finnes flere tydelige indikasjonar. Se etter tegn på at taket har det vanskelig. Du kan oppgi postnummer, samt sende gjerne bilder. Kunden får alltid et skriftlig tilbud.",
    });

    const result = normalizeGeneratedArticleDraft(input) as ReturnType<
      typeof validGeneratedArticle
    >;

    expect(result.title).toBe("Tegn på at taket trenger andre tiltak");
    expect(result.content).toContain("tydelige indikasjoner");
    expect(result.content).toContain("taket kan være i dårlig stand");
    expect(result.content).toContain("og gjerne sende bilder");
    expect(result.content).toContain("Du får alltid et skriftlig tilbud");
  });

  it("normalizes the language defects found in post 8", () => {
    const input = validGeneratedArticle({
      content:
        "Avhengig av hva en befant viser, velges metode. Type begroing: Sterkt begrodd med mose, lav eller alger krever omtanke. Vurder takets faktiske tåleevne og boligens ytre vern mot nedbør.",
    });

    const result = normalizeGeneratedArticleDraft(input) as ReturnType<
      typeof validGeneratedArticle
    >;

    expect(result.content).toContain("hva en befaring viser");
    expect(result.content).toContain(
      "Type og omfang av begroing: Tak som er sterkt begrodd",
    );
    expect(result.content).toContain("takets faktiske tilstand");
    expect(result.content).toContain("og taket.");
  });

  it("leaves unrelated prose unchanged", () => {
    const input = validGeneratedArticle();
    expect(normalizeGeneratedArticleDraft(input)).toEqual(input);
  });
});
