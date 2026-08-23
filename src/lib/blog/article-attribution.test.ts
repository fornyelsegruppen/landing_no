import { describe, expect, it } from "vitest";
import { articleLeadMetrics } from "./article-attribution";

describe("article lead attribution", () => {
  it("counts exact Norwegian and English article paths without prefix collisions", () => {
    expect(articleLeadMetrics([
      { contentSourcePath: "/no/blogg/takvask-pris", status: "converted" },
      { contentSourcePath: "/en/blogg/takvask-pris", status: "new" },
      { contentSourcePath: "/no/blogg/takvask-pris-annen", status: "converted" },
      { contentSourcePath: "/no/takvask-pris", status: "converted" },
    ], "takvask-pris")).toEqual({ leads: 2, convertedLeads: 1 });
  });
});
