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
          sources: [
            {
              url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
            },
          ],
        },
        new Date("2026-08-23T12:00:00.000Z"),
      ),
    ).toMatchObject({
      editorialStatus: "published",
      publishedAt: "2026-08-23T12:00:00.000Z",
    });
  });

  it("blocks one-click administrator publish before explicit approval", () => {
    expect(() =>
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
          sources: [
            {
              url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
            },
          ],
        },
        { _status: "published" },
        "Administrator",
        new Date("2026-08-24T10:00:00.000Z"),
      ),
    ).toThrow(/godkjent før publisering/);
  });

  it("still blocks publication when an approved AI draft failed quality gates", () => {
    expect(() =>
      prepareAdminPublication(
        {
          _status: "draft",
          editorialStatus: "approved",
          titleNo: "Norsk",
          contentNo: "Innhold",
          aiAssisted: true,
          qualityScore: 60,
          qualityChecks: { passed: false },
          reviewerName: "Administrator",
          reviewedAt: "2026-08-24T09:00:00.000Z",
          sources: [
            {
              url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
            },
          ],
        },
        { _status: "published" },
        "Administrator",
      ),
    ).toThrow(/kvalitetskontrollen/);
  });

  it("invalidates stale QA when the technical editor changes content and publishes in one request", () => {
    expect(
      prepareAdminPublication(
        {
          _status: "draft",
          editorialStatus: "approved",
          titleNo: "Kontrollert tittel",
          contentNo: "Tidligere kontrollert innhold",
          authorName: "Takfornyelse",
          aiAssisted: true,
          qualityScore: 94,
          qualityChecks: { passed: true },
          reviewerName: "Tidligere kontrollør",
          reviewedAt: "2026-08-29T10:00:00.000Z",
          scheduledAt: "2026-09-01T08:00:00.000Z",
          sources: [
            {
              url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
            },
          ],
        },
        {
          _status: "published",
          aiAssisted: false,
          contentNo: "Nytt innhold som ennå ikke er kvalitetskontrollert",
        },
        "Administrator",
      ),
    ).toMatchObject({
      _status: "draft",
      editorialStatus: "human_review",
      qualityScore: null,
      qualityChecks: null,
      aiAssisted: true,
      reviewerName: null,
      reviewedAt: null,
      scheduledAt: null,
    });
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
          sources: [
            {
              url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
            },
          ],
        },
        { contentNo: "Oppdatert" },
        new Date("2026-08-24T12:00:00.000Z"),
      ),
    ).toMatchObject({ publishedAt: "2026-08-23T12:00:00.000Z" });
  });

  it("blocks publication when only homepage sources are present", () => {
    expect(() =>
      prepareEditorialPost(null, {
        _status: "published",
        editorialStatus: "approved",
        titleNo: "Norsk",
        contentNo: "Innhold",
        authorName: "Fagperson",
        reviewerName: "Kontrollør",
        reviewedAt: "2026-08-23T10:00:00.000Z",
        sources: [{ url: "https://www.sintef.no/" }],
      }),
    ).toThrow(/Minst én presis kilde/);
  });

  it("blocks publication when approval metadata is missing", () => {
    expect(() =>
      prepareEditorialPost(null, {
        _status: "published",
        editorialStatus: "approved",
        titleNo: "Norsk",
        contentNo: "Innhold",
        authorName: "Fagperson",
        sources: [
          {
            url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
          },
        ],
      }),
    ).toThrow(/Faglig kontrollør mangler/);
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
