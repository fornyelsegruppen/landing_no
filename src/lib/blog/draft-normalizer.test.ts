import { describe, expect, it } from "vitest";
import { normalizeGeneratedArticleDraft } from "./draft-normalizer";
import { validGeneratedArticle } from "./test-fixtures";

describe("generated article normalizer", () => {
  it("replaces only approved language and package copy before quality gates", () => {
    const input = validGeneratedArticle({
      content: `## Pakker
* Basic: Standard overflatebehandling.
* Standard: Impregnering som styrker taksteinen.
* Premium: Dypere beskyttelse og maling.

Tak med høyt monterte flater krever ekstra omtanke under utførelsen. Impregnering som redusere fuktopptak omtales forsiktig. Taket har organisk materiale som mose og sot. Be om postnummer, valgfri adresse og gjerne bilder, uten å love endelig teknisk konklusjon eller pris.`,
    });

    const result = normalizeGeneratedArticleDraft(input) as ReturnType<
      typeof validGeneratedArticle
    >;

    expect(result.content).toContain(
      "- Basic fra 99 kr/m² + mva: taksjekk, mosebehandling og skånsom takvask.",
    );
    expect(result.content).toContain(
      "- Standard fra 138 kr/m² + mva: alt i Basic, samt beskyttende impregnering som reduserer fuktopptak på egnet takstein.",
    );
    expect(result.content).toContain(
      "- Premium fra 337 kr/m² + mva: alt i Standard, samt profesjonell takmaling",
    );
    expect(result.content).toContain("vanskelig tilgjengelige takflater");
    expect(result.content).toContain("ekstra sikkerhetstiltak");
    expect(result.content).toContain("mose, lav, alger og smuss");
    expect(result.content).toContain(
      "For å forberede vurderingen kan du oppgi postnummer",
    );
    expect(result.content).not.toMatch(
      /styrker taksteinen|som redusere\b|høyt monterte|organisk materiale|uten å love/i,
    );
  });

  it("leaves unrelated prose unchanged", () => {
    const input = validGeneratedArticle();
    expect(normalizeGeneratedArticleDraft(input)).toEqual(input);
  });
});
