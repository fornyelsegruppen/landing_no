import { describe, expect, it } from "vitest";
import {
  isPubliclyPublishedPost,
  publishedPostWhere,
} from "./publication-visibility";

describe("public blog visibility", () => {
  it("requires both Payload and editorial publication states", () => {
    expect(
      isPubliclyPublishedPost({
        _status: "published",
        editorialStatus: "published",
      }),
    ).toBe(true);

    for (const editorialStatus of [
      "draft",
      "ai_qa",
      "human_review",
      "approved",
      "scheduled",
      "rejected",
    ] as const) {
      expect(
        isPubliclyPublishedPost({
          _status: "published",
          editorialStatus,
        }),
      ).toBe(false);
    }

    expect(
      isPubliclyPublishedPost({
        _status: "draft",
        editorialStatus: "published",
      }),
    ).toBe(false);
  });

  it("builds one authoritative Payload query for lists and slugs", () => {
    expect(publishedPostWhere()).toEqual({
      and: [
        { _status: { equals: "published" } },
        { editorialStatus: { equals: "published" } },
      ],
    });
    expect(publishedPostWhere("sjekk-taket")).toEqual({
      and: [
        { slug: { equals: "sjekk-taket" } },
        { _status: { equals: "published" } },
        { editorialStatus: { equals: "published" } },
      ],
    });
  });
});
