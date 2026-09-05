import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminNextCaseWorkspace,
  formatCaseSlaDeadline,
} from "@/components/admin-next/admin-next-case-workspace";
import type { AdminNextCaseWorkspaceView } from "@/lib/admin-next/case-workspace-contract";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";
import { parseAdminNextRfRoute } from "@/lib/admin-next/rf-route-contract";

describe("Admin Next Case Workspace preview", () => {
  it.each([
    ["nb", "Navigasjon i saken", ["Kundedialog", "Dokumentasjon", "Historikk"]],
    ["lt", "Navigacija byloje", ["Kliento dialogas", "Įrodymai", "Istorija"]],
    ["en", "Case navigation", ["Customer dialogue", "Evidence", "History"]],
  ] as const)(
    "renders a localized, bounded workspace panel switcher for %s",
    (locale, navigationLabel, labels) => {
      const html = renderToStaticMarkup(
        createElement(AdminNextCaseWorkspace, {
          locale,
          value: adminNextCaseWorkspaceFixture,
        }),
      );

      expect(html).toContain(`aria-label="${navigationLabel}"`);
      expect(html).toContain('role="tablist"');
      expect(html.match(/data-case-context-link=/gu)).toHaveLength(3);
      expect(html.match(/aria-selected="true"/gu)).toHaveLength(1);
      expect(html.match(/role="tab"/gu)).toHaveLength(3);
      expect(html.match(/role="tabpanel"/gu)).toHaveLength(3);
      expect(html.match(/ hidden=""/gu)).toHaveLength(2);
      expect(html).toContain("data-case-sticky-navigation");
      expect(html).toContain("sticky top-16");
      expect(html).toContain("bg-[var(--an-canvas)]");
      expect(html.match(/scroll-mt-36/gu)?.length).toBeGreaterThanOrEqual(4);
      for (const [index, target] of [
        "case-customer-record",
        "case-evidence",
        "case-history",
      ].entries()) {
        expect(html).toContain(`id="${target}"`);
        expect(html).toContain(
          `aria-controls="case-workspace-panel-${target}"`,
        );
        expect(html).toContain(`>${labels[index]}</button>`);
      }
    },
  );

  it("uses the server-validated Work Queue return path for the back link", () => {
    const returnTo =
      "/admin-next-preview/work?view=today&queue=mine&limit=10&selected=case%3A1042#work-queue-detail";
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        returnTo,
        value: adminNextCaseWorkspaceFixture,
      }),
    );

    expect(html).toContain("Grįžti į darbų eilę");
    expect(html).toContain(
      'href="/admin-next-preview/work?view=today&amp;queue=mine&amp;limit=10&amp;selected=case%3A1042#work-queue-detail"',
    );
  });

  it("keeps the no-action fallback inside the new Work Queue", () => {
    const returnTo =
      "/admin-next-preview/work?view=today&queue=mine&limit=10&selected=case%3A1042#work-queue-detail";
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        returnTo,
        value: {
          ...adminNextCaseWorkspaceFixture,
          nextAction: {
            ...adminNextCaseWorkspaceFixture.nextAction,
            kind: "none",
            href: null,
            interaction: { mode: "read_only", reason: "no_action" },
            label: null,
            reviewMode: "none",
          },
        },
      }),
    );

    expect(html.match(/>Grįžti į darbų eilę</gu)).toHaveLength(2);
    expect(
      html.match(
        /href="\/admin-next-preview\/work\?view=today&amp;queue=mine&amp;limit=10&amp;selected=case%3A1042#work-queue-detail"/gu,
      ),
    ).toHaveLength(2);
    expect(html).toContain('data-case-action-mode="read_only"');
    expect(html).toContain("Šiuo metu bylai veiksmo nereikia.");
  });

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
    expect(html).toContain("Žinutės · 2 iš 27");
    expect(html).toContain("Rodyti ankstesnes žinutes (25)");
    expect(html).toContain("Pristatymo eiga");
    expect(html).toContain("Istorinis gavėjas");
    expect(html).toContain("kari.nilsen@example.no");
    expect(html).toContain('data-delivery-stage="approved"');
    expect(html).toContain('data-delivery-stage="delivered"');
    expect(html).toContain("Priedai · 2");
    expect(html).toContain("tilbud-T-1042-V1.pdf");
    expect(html).toContain("kontrakt-K-1042-V1.pdf");
    expect(html).toContain('data-customer-question-state="unresolved"');
    expect(html).toContain('data-customer-question-focus="true"');
    expect(html).toContain("Kliento klausimas, kuriam reikia veiksmo");
    expect(html).toContain("Reikia parengti atsakymą");
    expect(html).toContain("Atidaryti atsakymo darbo vietą");
    expect(html).toContain('data-commercial-versions="true"');
    expect(html).toContain("K-1042-V1");
    expect(html).toContain("Aktyvios versijos");
    expect(html).toContain("Juodraštis");
    expect(html).toContain("Rengiama");
    expect(html).not.toContain("draft · working");
    expect(html).toContain("sha256:demo-contract-1042-v1");
    expect(html).toContain('data-document-register="true"');
    expect(html).toContain("kontrakt-K-1042-V1.pdf");
    expect(html).toContain('data-business-history="true"');
    expect(html).toContain("Kundespørsmål mottatt");
    expect(html.match(/<details/gu)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain("group-open:rotate-180");
    expect(html).not.toMatch(/\smax-h-(?:\[24rem\]|64|80)\b/u);
    expect(html).not.toMatch(/\soverflow-auto\b/u);
    expect(html).toContain("sm:max-h-[24rem]");
    expect(html).toContain("sm:max-h-64");
    expect(html).toContain("sm:max-h-80");
  });

  it("keeps the effective signed contract visible in the collapsed commercial summary", () => {
    const record = adminNextCaseWorkspaceFixture.customerRecord;
    if (!record) throw new Error("Expected fixture customer record");
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        value: {
          ...adminNextCaseWorkspaceFixture,
          customerRecord: {
            ...record,
            commercialVersions: [
              {
                id: "contract-104201",
                kind: "contract",
                reference: "K-1042-V2",
                version: 2,
                status: "signed",
                role: "effective",
                supersedesReference: "K-1042-V1",
                createdAt: "2026-09-03T15:12:00.000Z",
                signedAt: "2026-09-03T16:00:00.000Z",
                companySignedAt: "2026-09-03T16:05:00.000Z",
                documentHash: "sha256:signed-contract-v2",
                pdfHref: "/api/admin/quotes/104201/pdf",
                fallbackHref: "/admin-v2/cases/1042",
              },
            ],
          },
        },
      }),
    );

    expect(html).toContain("Sutartis K-1042-V2");
    expect(html).toContain("Pasirašyta");
    expect(html).toContain("Galiojanti");
    expect(html).toContain("Klientas pasirašė");
    expect(html).toContain("Įmonė pasirašė");
    expect(html).toContain("Pakeičia");
    expect(html).toContain("sha256:signed-contract-v2");
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

  it.each([
    ["lt", "Rytoj · 10:30"],
    ["nb", "I morgen · 10:30"],
    ["en", "Tomorrow · 10:30"],
  ] as const)(
    "formats the SLA relative day and clock in Europe/Oslo for %s",
    (locale, expected) => {
      expect(
        formatCaseSlaDeadline(
          "2026-09-06T08:30:00.000Z",
          locale,
          new Date("2026-09-05T10:00:00.000Z"),
        ),
      ).toBe(expected);
      expect(formatCaseSlaDeadline("09:30", locale)).toBe("09:30");
    },
  );

  it("labels canonical data accurately instead of calling it synthetic", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "en",
        source: "canonical",
        value: adminNextCaseWorkspaceFixture,
      }),
    );
    expect(html).toContain("Live Preview case data");
    expect(html).not.toContain("Synthetic Preview test data");
    expect(html).not.toContain("Regression test data");
    expect(html).toContain("data-case-technical-diagnostics");
    expect(html.indexOf("canonical")).toBeGreaterThan(
      html.indexOf("data-case-technical-diagnostics"),
    );
  });

  it("marks only explicit frozen regression content as test data without changing recorded delivery state", () => {
    const customerRecord = adminNextCaseWorkspaceFixture.customerRecord;
    if (!customerRecord) throw new Error("Expected fixture customer record");
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        source: "canonical",
        value: {
          ...adminNextCaseWorkspaceFixture,
          customer: "Preview klientas",
          address: "CAS cas-mtnu7go1 left 12, 0184 Oslo",
          service: "takvask_impregnering",
          customerRecord: {
            ...customerRecord,
            questions: {
              ...customerRecord.questions,
              active: customerRecord.questions.active
                ? {
                    ...customerRecord.questions.active,
                    bodyText: "Sintetinis regresijos bandymas.",
                  }
                : undefined,
            },
            communications: customerRecord.communications.map(
              (message, index) =>
                index === 0
                  ? {
                      ...message,
                      bodyText: "Tai nėra realus siuntimas.",
                    }
                  : message,
            ),
          },
        },
      }),
    );

    expect(html).toContain('data-case-test-data-cue="explicit_content"');
    expect(html).toContain("Tiesioginiai Preview bylos duomenys");
    expect(html).toContain("Regresijos bandymo duomenys");
    expect(html).toContain(
      "left 12, 0184 Oslo · Stogo plovimas ir impregnavimas",
    );
    expect(html).toContain("Klientų portalas");
    expect(html).toContain("Kliento klausimas");
    expect(html).toContain("Pristatyta");
    expect(html.indexOf("takvask_impregnering")).toBeGreaterThan(
      html.indexOf("data-case-technical-diagnostics"),
    );
    expect(html.indexOf("CAS cas-mtnu7go1 left 12, 0184 Oslo")).toBeGreaterThan(
      html.indexOf("data-case-technical-diagnostics"),
    );
  });

  it.each([
    ["lt", "Klientų portalas", "Kliento klausimas", "Gauta"],
    ["nb", "Kundeportal", "Kundespørsmål", "Mottatt"],
    ["en", "Customer portal", "Customer question", "Received"],
  ] as const)(
    "shows localized customer-message labels and confines the raw category to diagnostics for %s",
    (locale, portal, category, status) => {
      const html = renderToStaticMarkup(
        createElement(AdminNextCaseWorkspace, {
          locale,
          value: adminNextCaseWorkspaceFixture,
        }),
      );

      expect(html).toContain(portal);
      expect(html).toContain(category);
      expect(html).toContain(status);
      expect(html).toContain("data-message-technical-diagnostics");
      expect(html.indexOf("customer_question")).toBeGreaterThan(
        html.indexOf("data-message-technical-diagnostics"),
      );
      expect(html).not.toMatch(/Atidaryti Admin V2|veikiančią bylą/iu);
    },
  );

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

  it("contains only working links and three real workspace controls", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextCaseWorkspace, {
        locale: "lt",
        value: adminNextCaseWorkspaceFixture,
      }),
    );

    expect(html.match(/<button/gu)).toHaveLength(4);
    expect(html.match(/href="\/admin-v2\//g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain(">Peržiūrėti R4<");
    expect(html).toContain(
      'href="/admin-next-preview/cases/TF-1042/documents/preflight"',
    );
    expect(html).toContain("data-case-fallback-tools");
    expect(html).toContain("Papildomi bylos įrankiai");
    expect(html).toContain(
      "Esami dokumentų ir darbų maršrutai palikti saugiam grįžimui.",
    );
    expect(html).not.toMatch(/Atidaryti Admin V2|veikiančią bylą/iu);
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
          title: "case.address_corrected",
          summary: "",
          at: atUtc,
          actor: "Aistė",
          audit: {
            action: "case.address_corrected",
            label: "Bylos adresas pataisytas",
            actor: { kind: "user", display: "Aistė" },
            atUtc,
            changedFields: ["caseRevision", "status"],
            changedFieldsStatus: "projected",
            result: "succeeded",
            reason: "stale_revision",
            version: "v2",
            source: "admin-api",
            trace: [
              "Byla r8 · adresas r2",
              "Pasiūlymas: T-13-V3",
              "Sutartis: K-13-V3",
            ],
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
    expect(html).toContain("Bylos adresas pataisytas");
    expect(html).toContain("data-audit-event-diagnostics");
    expect(html.indexOf("case.address_corrected")).toBeGreaterThan(
      html.indexOf("data-audit-event-diagnostics"),
    );
    expect(html).toContain("data-audit-event-trace");
    expect(html).toContain("Pasiūlymas: T-13-V3");
    expect(html).toContain("Sutartis: K-13-V3");
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
