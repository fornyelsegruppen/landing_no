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
};

describe("blog editor action request", () => {
  it("omits blank optional fields so the stock-image fallback remains valid", () => {
    expect(blogEditorActionRequest("stock-image", form)).toEqual({
      action: "stock-image",
      titleNo: form.titleNo,
      excerptNo: form.excerptNo,
      contentNo: form.contentNo,
      seoTitleNo: form.seoTitleNo,
      seoDescriptionNo: form.seoDescriptionNo,
      primaryKeyword: form.primaryKeyword,
      reviewerName: form.reviewerName,
    });
  });

  it("trims a supplied stock query and serializes a supplied schedule", () => {
    const scheduledAt = "2026-09-03T08:30";

    expect(
      blogEditorActionRequest("schedule", {
        ...form,
        query: "  Norwegian tiled roof  ",
        scheduledAt,
      }),
    ).toMatchObject({
      action: "schedule",
      query: "Norwegian tiled roof",
      scheduledAt: new Date(scheduledAt).toISOString(),
    });
  });
});
