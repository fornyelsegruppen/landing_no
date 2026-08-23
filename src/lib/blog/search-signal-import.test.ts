import { describe, expect, it } from "vitest";
import { aggregateLeadQuestions, parseSearchSignalCsv } from "./search-signal-import";

describe("search signal imports", () => {
  it("parses common Norwegian Ads CSV headers and aggregates duplicate rows", () => {
    const result = parseSearchSignalCsv(
      'Søkeord;Visninger;Klikk\n"takvask pris";120;8\n"takvask pris";30;2\n"takmaling oslo";45;3',
      "ads",
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ source: "ads", query: "takvask pris", impressions: 150, clicks: 10 });
  });

  it("removes personal data and does not expose one-off lead text", () => {
    const result = aggregateLeadQuestions([
      "Hva koster takvask på huset mitt? post@example.no",
      "Hva koster takvask på huset mitt? +47 99 88 77 66",
      "Ring meg om takmaling i morgen",
    ]);
    expect(result).toEqual([{ source: "lead", query: "hva koster takvask på huset mitt?", score: 40 }]);
    expect(JSON.stringify(result)).not.toContain("example.no");
  });

  it("rejects malformed or oversized imports", () => {
    expect(() => parseSearchSignalCsv("Clicks,Impressions\n1,2", "ads")).toThrow(/mangler kolonnen/);
    expect(() => parseSearchSignalCsv(`Query\n${"x".repeat(1_000_001)}`, "trends")).toThrow(/større enn/);
  });
});
