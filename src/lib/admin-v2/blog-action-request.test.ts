import { describe, expect, it } from "vitest";
import {
  blogEditorActionRequest,
  type BlogEditorForm,
} from "./blog-action-request";

const form: BlogEditorForm = {
  titleNo: "Når lønner det seg å impregnere takstein?",
  excerptNo: "Kort sammendrag",
  contentNo: "Artikkelinnhold",
  seoTitleNo: "SEO-tittel",
  seoDescriptionNo: "SEO-beskrivelse",
  primaryKeyword: "impregnering av takstein",
  reviewerName: "Fagansvarlig i Takfornyelse",
  scheduledAt: "",
  query: "",
  regenerationInstructions: "",
};

describe("blog editor action request", () => {
  it("omits blank optional fields so the stock-image fallback remains valid", () => {
    expect(blogEditorActionRequest("stock-image", form)).toEqual({
      action: "stock-image",
    });
  });

  it("trims a supplied stock query and serializes a supplied Oslo schedule", () => {
    const scheduledAt = "2026-09-03T08:30";

    expect(
      blogEditorActionRequest("schedule", {
        ...form,
        query: "  Norwegian tiled roof  ",
        scheduledAt,
      }),
    ).toEqual({
      action: "schedule",
      scheduledAt: "2026-09-03T06:30:00.000Z",
    });
  });

  it("sends only saved content to save and keeps regeneration instructions separate", () => {
    expect(
      blogEditorActionRequest("save", form, {
        expectedUpdatedAt: "2026-09-12T10:00:00.000Z",
      }),
    ).toEqual({
      action: "save",
      expectedUpdatedAt: "2026-09-12T10:00:00.000Z",
      titleNo: form.titleNo,
      excerptNo: form.excerptNo,
      contentNo: form.contentNo,
      seoTitleNo: form.seoTitleNo,
      seoDescriptionNo: form.seoDescriptionNo,
      primaryKeyword: form.primaryKeyword,
    });
    expect(
      blogEditorActionRequest("regenerate", {
        ...form,
        regenerationInstructions: "  Keep the roof-safety section concrete.  ",
      }),
    ).toEqual({
      action: "regenerate",
      regenerationInstructions: "Keep the roof-safety section concrete.",
    });
  });
});
