import { describe, expect, it } from "vitest";
import {
  blogEditorIsDirty,
  blogEditorActionIsBlocked,
  initialBlogEditorForm,
  reconcileCleanBlogEditorForm,
  savedBlogEditorFields,
} from "./blog-editor-state";

const original = initialBlogEditorForm({
  titleNo: "Slik sjekker du taket",
  excerptNo: "Kort ingress",
  contentNo: "Artikkeltekst med nok innhold.",
  seoTitleNo: "SEO-tittel",
  seoDescriptionNo: "SEO-beskrivelse",
  primaryKeyword: "tak etter vinter",
  reviewerName: "Kari",
});

describe("blog editor state", () => {
  it("blocks other workflow actions only for unsaved article fields", () => {
    const saved = savedBlogEditorFields(original);
    expect(
      blogEditorIsDirty(
        { ...original, contentNo: "Oppdatert artikkeltekst." },
        saved,
      ),
    ).toBe(true);
    expect(blogEditorIsDirty({ ...original, reviewerName: "Ola" }, saved)).toBe(
      false,
    );
    expect(
      blogEditorIsDirty({ ...original, query: "red tiled roof" }, saved),
    ).toBe(false);
  });

  it("adopts refreshed props for a clean editor with the same post id", () => {
    const refreshed = reconcileCleanBlogEditorForm(original, {
      ...original,
      contentNo: "Serverens oppdaterte artikkeltekst.",
      reviewerName: "Ola",
    });
    expect(refreshed.contentNo).toBe("Serverens oppdaterte artikkeltekst.");
    expect(refreshed.reviewerName).toBe("Ola");
  });

  it("blocks every mutation when a newer server version arrives during editing", () => {
    expect(
      blogEditorActionIsBlocked({
        action: "save",
        dirty: true,
        serverUpdatedWhileDirty: true,
      }),
    ).toBe(true);
    expect(
      blogEditorActionIsBlocked({
        action: "stock-image",
        dirty: true,
        serverUpdatedWhileDirty: false,
      }),
    ).toBe(true);
    expect(
      blogEditorActionIsBlocked({
        action: "save",
        dirty: true,
        serverUpdatedWhileDirty: false,
      }),
    ).toBe(false);
  });
});
