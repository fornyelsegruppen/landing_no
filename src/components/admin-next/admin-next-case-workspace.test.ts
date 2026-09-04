import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextCaseWorkspace } from "@/components/admin-next/admin-next-case-workspace";
import type { AdminNextCaseWorkspaceView } from "@/lib/admin-next/case-workspace-contract";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";
import { parseAdminNextRfRoute } from "@/lib/admin-next/rf-route-contract";

describe("Admin Next Case Workspace preview", () => {
  it.each([
    [
      "nb",
      "Navigasjon i saken",
      ["Sammendrag", "Kundedialog", "Dokumentasjon", "Historikk"],
    ],
    [
      "lt",
      "Navigacija byloje",
      ["Santrauka", "Kliento dialogas", "Įrodymai", "Istorija"],
    ],
    [
      "en",
      "Case navigation",
      ["Summary", "Customer dialogue", "Evidence", "History"],
    ],
  ] as const)(
    "renders native, localized in-page navigation landmarks for %s",
    (locale, navigationLabel, labels) => {
      const html = renderToStaticMarkup(
        createElement(AdminNextCaseWorkspace, {
          locale,
          value: adminNextCaseWorkspaceFixture,
        }),
      );

      expect(html).toContain(`<nav aria-label="${navigationLabel}"`);
      expect(html.match(/data-case-context-link=/gu)).toHaveLength(4);
      expect(html.match(/aria-current="location"/gu)).toHaveLength(1);
      expect(html).not.toContain('role="tab"');
      for (const [index, target] of [
        "case-summary",
        "case-customer-record",
        "case-evidence",
        "case-history",
      ].entries()) {
        expect(html).toContain(`href="#${target}"`);
        expect(html).toContain(`id="${target}"`);
        expect(html).toContain(`>${labels[index]}</a>`);
      }
    },
  );

  it("renders the customer conversation, commercial version chain and document register", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        value: adminNextCaseWorkspaceFixture,
      }),
    );

    expect(html).toContain("Kliento dialogas ir sutarčių istorija");
    expect(html).toContain('data-customer-communications="true"');
    expect(html).toContain("Re: Tilbud på takfornyelse");
    expect(html).toContain("Takk. Kan dere sende tilbudet i dag");
    expect(html).toContain('data-customer-question-state="resolved"');
    expect(html).toContain('data-commercial-versions="true"');
    expect(html).toContain("K-1042-V1");
    expect(html).toContain("sha256:demo-contract-1042-v1");
    expect(html).toContain('data-document-register="true"');
    expect(html).toContain("kontrakt-K-1042-V1.pdf");
    expect(html).toContain('data-business-history="true"');
    expect(html).toContain("Kundespørsmål mottatt");
  });

  it("uses one native disclosure for the history rail without duplicating audit content", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        value: {
          ...adminNextCaseWorkspaceFixture,
          timeline: [],
          timelineState: {
            status: "unavailable",
            source: "canonical",
            reason: "audit_unavailable",
          },
        },
      }),
    );

    expect(html.match(/data-case-history-rail/gu)).toHaveLength(1);
    expect(html).toContain("<details");
    expect(html).toContain('open=""');
    expect(html).toContain('aria-controls="case-history-content"');
    expect(html.match(/id="case-history-content"/gu)).toHaveLength(1);
    expect(
      html.match(/Audito istorija laikinai nepasiekiama\./gu),
    ).toHaveLength(1);
    expect(html).toContain('data-case-history-state-summary="unavailable"');
  });

  it("renders owner, SLA, progress, evidence and timeline landmarks", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        value: adminNextCaseWorkspaceFixture,
      }),
    );

    expect(html).toContain("Marius Hansen");
    expect(html).toContain("Vėluoja · 38 min.");
    expect(html).toContain("Bylos eiga");
    expect(html).toContain("2 iš 6 · Įrodymai");
    expect(html).toContain("Rodyti visą eigą");
    expect(html).not.toContain("min-w-[8rem]");
    expect(html).toContain("Dokumentai ir įrodymai");
    expect(html).toContain("R4 stogo matavimas");
    expect(html).toContain("Įvykių seka");
  });

  it("labels canonical data accurately instead of calling it synthetic", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "en",
        source: "canonical",
        value: adminNextCaseWorkspaceFixture,
      }),
    );
    expect(html).toContain("Canonical Preview data");
    expect(html).not.toContain("Synthetic Preview data");
  });

  it("renders one diagnostic blocker and no fake evidence link when an operator target is unavailable", () => {
    const evidence = adminNextCaseWorkspaceFixture.evidence[0];
    if (!evidence) throw new Error("Expected fixture evidence");
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        source: "canonical",
        value: {
          ...adminNextCaseWorkspaceFixture,
          nextAction: {
            ...adminNextCaseWorkspaceFixture.nextAction,
            diagnosticBlocker: {
              code: "UNMAPPED_LEGACY_BLOCKER",
              recovery: "Atverkite bylą ir išspręskite blokavimą.",
            },
            href: null,
            interaction: {
              mode: "read_only",
              reason: "diagnostic_blocker",
            },
            label: null,
          },
          evidence: [
            {
              ...evidence,
              fallbackHref: null,
              previewHref: undefined,
            },
          ],
        },
      }),
    );

    expect(html.match(/UNMAPPED_LEGACY_BLOCKER/gu)).toHaveLength(1);
    expect(html).toContain("Atverkite bylą ir išspręskite blokavimą.");
    expect(html).toContain("Operatoriaus darbo vietos nėra");
    expect(html).not.toContain("/admin/collections/");
  });

  it("contains only working links and no fake active controls", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        value: adminNextCaseWorkspaceFixture,
      }),
    );

    expect(html).not.toContain("<button");
    expect(html.match(/href="\/admin-v2\//g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain(">Peržiūrėti R4<");
    expect(html).toContain(
      'href="/admin-next-preview/cases/TF-1042/documents/preflight"',
    );
    expect(html).toContain("Preview nekeičia klientų duomenų");
  });

  it("renders only RF links that round-trip through the canonical route contract", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        value: adminNextCaseWorkspaceFixture,
      }),
    );
    const displayedRfHrefs = [...html.matchAll(/href="([^"]+)"/gu)]
      .map((match) => match[1].replaceAll("&amp;", "&"))
      .filter((href) => href.includes("/measurements/"));

    expect(displayedRfHrefs).toHaveLength(2);
    for (const href of displayedRfHrefs) {
      const parsed = parseAdminNextRfRoute(href);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) throw new Error(parsed.reason);
      expect(parsed.value).toMatchObject({
        mode: "review",
        case: { id: 1042, reference: "TF-1042", revision: 12 },
        measurement: { id: "R4-2026-1042", revision: 7 },
        snapshot: {
          id: "R4-2026-1042",
          revision: 7,
          hash: "a".repeat(64),
        },
        blocker: "measurement.review_required",
        evidence: ["EVD-R4-1042-01"],
        returnTo:
          "/admin-next-preview/cases/TF-1042?tab=evidence#case-evidence-title",
      });
    }
  });

  it("renders only the privacy-safe canonical audit projection with locale time", () => {
    const atUtc = "2026-09-04T10:00:00.000Z";
    const localizedTime = new Intl.DateTimeFormat("lt-LT", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    }).format(new Date(atUtc));
    const value: AdminNextCaseWorkspaceView = {
      ...adminNextCaseWorkspaceFixture,
      reference: "TF-13",
      customer: "Canonical customer",
      nextAction: {
        ...adminNextCaseWorkspaceFixture.nextAction,
        href: "/admin-v2/cases/13",
      },
      evidence: [],
      measurementReview: undefined,
      documentPreflight: undefined,
      timelineState: { status: "ready", source: "canonical" },
      timeline: [
        {
          id: "audit-31",
          kind: "automation",
          title: "case.updated",
          summary: "",
          at: atUtc,
          actor: "Aistė",
          audit: {
            action: "case.updated",
            actor: { kind: "user", display: "Aistė" },
            atUtc,
            changedFields: ["caseRevision", "status"],
            changedFieldsStatus: "projected",
            result: "succeeded",
            reason: "stale_revision",
            version: "v2",
            source: "admin-api",
            correlationId: "corr-case-13",
            integrity: {
              hashStatus: "recorded_unverified",
              tamperStatus: "not_assessable",
            },
            email: "actor@example.invalid",
            body: "private message",
            from: "old status",
            to: "new status",
          } as never,
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        source: "canonical",
        value,
      }),
    );

    expect(html).toContain('data-audit-history-state="ready"');
    expect(html).toContain("case.updated");
    expect(html).toContain(localizedTime);
    expect(html).not.toContain(atUtc);
    expect(html).toContain("Naudotojas · Aistė");
    expect(html).toContain("caseRevision, status");
    expect(html).toContain("succeeded");
    expect(html).toContain("stale_revision");
    expect(html).toContain("admin-api");
    expect(html).toContain("corr-case-13");
    expect(html).toContain("Užregistruota, nepatikrinta");
    expect(html).toContain("Neįmanoma įvertinti");
    expect(html).not.toMatch(
      /actor@example|private message|old status|new status/u,
    );
    expect(html).not.toMatch(/recorded_unverified|not_assessable/u);
    expect(html).not.toMatch(/Demo ·|TF-1042/u);
  });

  it.each([
    ["lt", "Neužregistruota", "Neįmanoma įvertinti"],
    ["nb", "Ikke registrert", "Kan ikke vurderes"],
  ] as const)(
    "localizes audit projection statuses for %s without exposing enum tokens",
    (locale, expectedRecorded, expectedTamper) => {
      const value: AdminNextCaseWorkspaceView = {
        ...adminNextCaseWorkspaceFixture,
        reference: "TF-13",
        customer: "Canonical customer",
        nextAction: {
          ...adminNextCaseWorkspaceFixture.nextAction,
          href: "/admin-v2/cases/13",
        },
        evidence: [],
        measurementReview: undefined,
        documentPreflight: undefined,
        timelineState: { status: "ready", source: "canonical" },
        timeline: [
          {
            id: "audit-32",
            kind: "automation",
            title: "case.viewed",
            summary: "",
            at: "2026-09-04T10:00:00.000Z",
            actor: "system",
            audit: {
              action: "case.viewed",
              actor: { kind: "system", display: null },
              atUtc: "2026-09-04T10:00:00.000Z",
              changedFields: [],
              changedFieldsStatus: "absent",
              result: null,
              reason: null,
              version: null,
              source: null,
              correlationId: "corr-case-13",
              integrity: {
                hashStatus: "not_recorded",
                tamperStatus: "not_assessable",
              },
            },
          },
        ],
      };
      const html = renderToStaticMarkup(
        createElement(AdminNextCaseWorkspace, {
          locale,
          source: "canonical",
          value,
        }),
      );

      expect(html).toContain(expectedRecorded);
      expect(html).toContain(expectedTamper);
      expect(html).not.toMatch(
        /\b(?:absent|projected|rejected|not_recorded|recorded_unverified|invalid|not_assessable)\b/u,
      );
    },
  );

  it.each([
    ["lt", "Šiai bylai audito įvykių neužregistruota."],
    ["nb", "Ingen revisjonshendelser er registrert for denne saken."],
  ] as const)(
    "renders a localized empty audit state for %s",
    (locale, message) => {
      const value: AdminNextCaseWorkspaceView = {
        ...adminNextCaseWorkspaceFixture,
        reference: "TF-13",
        customer: "Canonical customer",
        nextAction: {
          ...adminNextCaseWorkspaceFixture.nextAction,
          href: "/admin-v2/cases/13",
        },
        evidence: [],
        measurementReview: undefined,
        documentPreflight: undefined,
        timeline: [],
        timelineState: { status: "ready", source: "canonical" },
      };
      const html = renderToStaticMarkup(
        createElement(AdminNextCaseWorkspace, {
          locale,
          source: "canonical",
          value,
        }),
      );

      expect(html).toContain('data-audit-history-state="empty"');
      expect(html).toContain(message);
      expect(html).not.toContain('data-audit-history-state="ready"');
    },
  );

  it.each([
    [
      "unavailable",
      "Audito istorija laikinai nepasiekiama.",
      {
        status: "unavailable",
        source: "canonical",
        reason: "audit_unavailable",
      },
    ],
    [
      "denied",
      "Neturite teisės peržiūrėti audito istorijos.",
      { status: "denied", source: "canonical", reason: "audit_read_denied" },
    ],
  ] as const)(
    "renders a neutral %s state and hides any supplied timeline rows",
    (status, message, timelineState) => {
      const value: AdminNextCaseWorkspaceView = {
        ...adminNextCaseWorkspaceFixture,
        reference: "TF-13",
        customer: "Canonical customer",
        nextAction: {
          ...adminNextCaseWorkspaceFixture.nextAction,
          href: "/admin-v2/cases/13",
        },
        evidence: [],
        measurementReview: undefined,
        documentPreflight: undefined,
        timelineState,
      };
      const html = renderToStaticMarkup(
        createElement(AdminNextCaseWorkspace, {
          locale: "lt",
          source: "canonical",
          value,
        }),
      );

      expect(html).toContain(`data-audit-history-state="${status}"`);
      expect(html).toContain(message);
      expect(html).not.toContain("R4 matavimas paruoštas peržiūrai");
      expect(html).not.toContain("Matavimo variklis");
      expect(html).not.toMatch(/Demo ·|TF-1042/u);
    },
  );
});
