import { describe, expect, it } from "vitest";
import { aggregateLeadQuestions, parseSearchSignalCsv } from "./search-signal-import";

describe("search signal imports", () => {
  it("parses common Norwegian Ads CSV headers and aggregates duplicate rows", () => {
    const result = parseSearchSignalCsv(
      'Søkeord;Visninger;Klikk\n"takvask pris";120;8\n"takvask pris";30;2\n"takmaling oslo";45;3',
      "ads",
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      source: "ads",
      origin: "csv-import",
      query: "takvask pris",
      impressions: 150,
      clicks: 10,
    });
  });

  it("preserves zero metrics and explicit, valid observation periods", () => {
    const result = parseSearchSignalCsv(
      "Query,Impressions,Clicks,Start date,End date\ntakvask pris,0,0,2026-06-01,2026-08-31",
      "search-console",
    );
    expect(result).toEqual([{
      source: "search-console",
      origin: "csv-import",
      query: "takvask pris",
      impressions: 0,
      clicks: 0,
      periodStart: "2026-06-01",
      periodEnd: "2026-08-31",
    }]);
  });

  it("rejects impossible or reversed explicit observation dates", () => {
    expect(() => parseSearchSignalCsv(
      "Query,Start date,End date\ntakvask pris,2026-02-30,2026-03-01",
      "ads",
    )).toThrow(/umulig/);
    expect(() => parseSearchSignalCsv(
      "Query,Start date,End date\ntakvask pris,2026-09-01,2026-08-31",
      "ads",
    )).toThrow(/feil rekkefølge/);
  });

  it("does not claim one observation period after aggregating mismatched rows", () => {
    const result = parseSearchSignalCsv(
      "Query,Impressions,Start date,End date\ntakvask pris,0,2026-06-01,2026-06-30\ntakvask pris,0,2026-07-01,2026-07-31",
      "ads",
    );
    expect(result).toEqual([{
      source: "ads",
      origin: "csv-import",
      query: "takvask pris",
      impressions: 0,
    }]);
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
