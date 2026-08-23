import { describe, expect, it } from "vitest";
import { prepareEditorialPost, validateEditorialPost } from "./editorial-policy";
import { blogPostLanguageUrls } from "./routing";
import { safePreviewPath } from "@/lib/preview-path";
import {
  captureLeadAttribution,
  readContentSource,
  storeContentSource,
} from "@/lib/lead-attribution";

describe("manual article publishing and measured lead flow", () => {
  it("moves a Norwegian-only article from draft to an attributed lead", () => {
    const draft = {
      _status: "draft" as const,
      editorialStatus: "draft" as const,
      titleNo: "Hva påvirker prisen på takvask?",
      contentNo: "## Tilstand\n\nPris avhenger av takets tilstand.",
    };
    expect(validateEditorialPost(draft)).toEqual([]);
    expect(safePreviewPath("no", "/no/blogg/takvask-pris")).toBe(
      "/no/blogg/takvask-pris",
    );

    const published = prepareEditorialPost(
      draft,
      {
        ...draft,
        _status: "published",
        editorialStatus: "approved",
        authorName: "Takfornyelse",
        reviewerName: "Faglig ansvarlig",
        reviewedAt: "2026-08-23T10:00:00.000Z",
      },
      new Date("2026-08-23T12:00:00.000Z"),
    );
    expect(published).toMatchObject({
      editorialStatus: "published",
      publishedAt: "2026-08-23T12:00:00.000Z",
    });
    expect(
      blogPostLanguageUrls(
        { slug: "takvask-pris", ...published },
        "https://www.takfornyelse.as",
      ),
    ).toEqual({
      no: "https://www.takfornyelse.as/no/blogg/takvask-pris",
    });

    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    storeContentSource(storage, "/no/blogg/takvask-pris", 1_000);
    expect(
      captureLeadAttribution(
        "https://www.takfornyelse.as/no?utm_source=google",
        "https://www.google.no/",
        readContentSource(storage, 2_000),
      ),
    ).toMatchObject({
      utmSource: "google",
      contentSourcePath: "/no/blogg/takvask-pris",
    });
  });
});
