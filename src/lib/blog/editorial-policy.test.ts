import { describe, expect, it } from "vitest";
import {
  availablePostLocales,
  prepareAdminPublication,
  prepareEditorialPost,
  validateEditorialPost,
} from "./editorial-policy";

describe("blog editorial policy", () => {
  it("accepts a Norwegian-only draft", () => {
    expect(
      validateEditorialPost({
        _status: "draft",
        editorialStatus: "draft",
        titleNo: "Slik vurderes taket",
        contentNo: "Norsk faginnhold",
      }),
    ).toEqual([]);
  });

  it("does not advertise an English locale without complete English content", () => {
    expect(
      availablePostLocales({
        titleNo: "Norsk",
        contentNo: "Innhold",
        titleEn: "English title only",
      }),
    ).toEqual(["no"]);
  });

  it("blocks publication without human review evidence", () => {
    expect(() =>
      prepareEditorialPost(null, {
        _status: "published",
        editorialStatus: "draft",
        titleNo: "Norsk",
        contentNo: "Innhold",
      }),
    ).toThrow(/Forfatter mangler/);
  });

  it("marks an approved reviewed post as published", () => {
    expect(
      prepareEditorialPost(
        null,
        {
          _status: "published",
          editorialStatus: "approved",
          titleNo: "Norsk",
          contentNo: "Innhold",
          authorName: "Fagperson",
          reviewerName: "Kontrollør",
          reviewedAt: "2026-08-23T10:00:00.000Z",
        },
        new Date("2026-08-23T12:00:00.000Z"),
      ),
    ).toMatchObject({
      editorialStatus: "published",
      publishedAt: "2026-08-23T12:00:00.000Z",
    });
  });

  it("lets an administrator review and publish a passed AI draft in one action", () => {
    expect(
      prepareAdminPublication(
        {
          _status: "draft",
          editorialStatus: "ai_qa",
          titleNo: "Norsk",
          contentNo: "Kontrollert innhold",
          authorName: "Takfornyelse",
          aiAssisted: true,
          qualityScore: 92,
          qualityChecks: { passed: true },
        },
        { _status: "published" },
        "Administrator",
        new Date("2026-08-24T10:00:00.000Z"),
      ),
    ).toMatchObject({
      _status: "published",
      editorialStatus: "published",
      reviewerName: "Administrator",
      reviewedAt: "2026-08-24T10:00:00.000Z",
      publishedAt: "2026-08-24T10:00:00.000Z",
    });
  });

  it("still blocks one-click publication when AI quality checks failed", () => {
    expect(() =>
      prepareAdminPublication(
        {
          _status: "draft",
          editorialStatus: "ai_qa",
          titleNo: "Norsk",
          contentNo: "Innhold",
          aiAssisted: true,
          qualityScore: 60,
          qualityChecks: { passed: false },
        },
        { _status: "published" },
        "Administrator",
      ),
    ).toThrow(/kvalitetskontrollen/);
  });

  it("preserves the first publication timestamp during later edits", () => {
    expect(
      prepareEditorialPost(
        {
          _status: "published",
          editorialStatus: "published",
          titleNo: "Norsk",
          contentNo: "Opprinnelig",
          authorName: "Fagperson",
          reviewerName: "Kontrollør",
          reviewedAt: "2026-08-23T10:00:00.000Z",
          publishedAt: "2026-08-23T12:00:00.000Z",
        },
        { contentNo: "Oppdatert" },
        new Date("2026-08-24T12:00:00.000Z"),
      ),
    ).toMatchObject({ publishedAt: "2026-08-23T12:00:00.000Z" });
  });

  it("blocks scheduling before approval", () => {
    expect(
      validateEditorialPost({
        _status: "draft",
        editorialStatus: "human_review",
        titleNo: "Norsk",
        contentNo: "Innhold",
        scheduledAt: "2026-09-01T08:00:00.000Z",
      }),
    ).toContain("Bare godkjente innlegg kan planlegges");
  });

  it("keeps an already scheduled approved article valid", () => {
    expect(
      validateEditorialPost({
        _status: "draft",
        editorialStatus: "scheduled",
        titleNo: "Norsk",
        contentNo: "Innhold",
        scheduledAt: "2026-09-01T08:00:00.000Z",
      }),
    ).toEqual([]);
  });
});
