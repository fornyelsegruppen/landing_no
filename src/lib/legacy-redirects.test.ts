import { describe, expect, it } from "vitest";
import { legacyRedirects } from "./legacy-redirects";

function destinationFor(source: string) {
  return legacyRedirects.find((item) => item.source === source)?.destination;
}

describe("legacy redirects", () => {
  it("keeps every source unique and permanent", () => {
    const sources = legacyRedirects.map((item) => item.source);

    expect(new Set(sources).size).toBe(sources.length);
    expect(legacyRedirects.every((item) => item.permanent)).toBe(true);
  });

  it("preserves the most valuable location and service intent", () => {
    expect(destinationFor("/omrader/oslo/takvask")).toBe("/no/takvask-oslo");
    expect(destinationFor("/omrader/drammen/takmaling")).toBe(
      "/no/takmaling-drammen",
    );
    expect(destinationFor("/omrader/:location/impregnering")).toBe(
      "/no/takvask-og-impregnering",
    );
    expect(destinationFor("/tjenester/nytt-tak")).toBe("/no/nytt-tak");
  });

  it("moves services outside this site's focus to Fornyelsegruppen", () => {
    expect(destinationFor("/omrader/:location/fjerning-av-taksno")).toBe(
      "https://fornyelsegruppen.no/tjenester/fjerning-av-taksno",
    );
  });
});
