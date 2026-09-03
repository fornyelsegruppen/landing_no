import { describe, expect, it } from "vitest";
import { validTopic } from "./test-fixtures";
import {
  officialDeepSourceCatalogue,
  approvedKnowledgePrompt,
  blogKnowledgeVersion,
} from "./knowledge-base";
import { buildBlogArticlePrompt, buildBlogSystemPrompt } from "./prompt";

const expectedUrls = [
  "https://www.dibk.no/smartere-oppussing/raad/tak",
  "https://www.dibk.no/regelverk/tek/3/13/vi/13-17",
  "https://www.arbeidstilsynet.no/risikofylt-arbeid/arbeid-i-hoyden/unnga-fall-ved-arbeid-pa-tak/",
  "https://www.sintef.no/sintef-community/fagblogg/poster/unnga-skader-pa-boligtak-tekk-om-i-tide-og-velg-ri/",
  "https://www.sintef.no/sintef-community/fagblogg/poster/unnga-byggskader-ved-prosjektering-av-tak/",
  "https://www.sintef.no/siste-nytt/2024/fukt-og-mugg-pa-plater-ved-rehabilitering-av-kalde-loft/",
] as const;

describe("curated official SEO source catalogue", () => {
  it("is deterministic and contains the approved URLs in order", () => {
    expect(officialDeepSourceCatalogue.map((source) => source.url)).toEqual(
      expectedUrls,
    );
    expect(new Set(expectedUrls).size).toBe(expectedUrls.length);
  });

  it("serializes every exact URL into the approved knowledge prompt", () => {
    const prompt = approvedKnowledgePrompt();
    expect(prompt).toContain(`"version": "${blogKnowledgeVersion}"`);
    for (const url of expectedUrls) expect(prompt).toContain(url);
  });

  it("tells the draft prompt to copy catalogue URLs verbatim", () => {
    const prompt = buildBlogArticlePrompt(validTopic, []);
    expect(prompt).toContain("officialDeepSourceCatalogue");
    expect(prompt).toMatch(/kopier URL-feltet .* ordrett/i);
    expect(prompt).toMatch(/Ikke finn på, forkort, normaliser eller rekonstruer URL-er/i);
    expect(prompt).toMatch(/aldri bare en utgiver- eller hjemmeside-URL/i);
    expect(buildBlogSystemPrompt()).toContain("må godkjennes av et menneske");
  });
});
