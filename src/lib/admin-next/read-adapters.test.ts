import { describe, expect, it, vi } from "vitest";
import type { AdminCaseWorkspace } from "@/lib/admin-v2/case-read-model";
import {
  projectAdminCaseWorkspace,
  projectAdminNextCaseStages,
} from "@/lib/admin-next/case-read-adapter";
import { createAdminNextCanonicalTodayAdapter } from "@/lib/admin-next/today-read-adapter";

describe("Admin Next canonical read projections", () => {
  it("projects one canonical Admin V2 case batch through the Today Work Queue", async () => {
    const find = vi
      .fn()
      .mockImplementation(async ({ collection }: { collection: string }) => ({
        docs:
          collection === "leads"
            ? [
                {
                  id: 12,
                  name: "Ola Kunde",
                  address: "Testveien 12",
                  inquiryType: "takvask",
                  status: "new",
                  recordState: "active",
                  caseRevision: 1,
                  assignedTo: { id: 7, displayName: "Marius" },
                },
                {
                  id: 13,
                  name: "Kari Kunde",
                  address: "Testveien 13",
                  inquiryType: "takvask",
                  status: "new",
                  recordState: "active",
                  caseRevision: 2,
                  assignedTo: { id: 7, displayName: "Marius" },
                },
                {
                  id: 14,
                  name: "Per Kunde",
                  address: "Testveien 14",
                  inquiryType: "takvask",
                  status: "new",
                  recordState: "active",
                  caseRevision: 3,
                },
              ]
            : collection === "roof-measurements"
              ? [{ id: 21, lead: 13, status: "approved" }]
              : collection === "price-calculations"
                ? [{ id: 22, lead: 13, status: "ready" }]
                : collection === "quotes"
                  ? [{ id: 23, lead: 13, status: "draft" }]
                  : collection === "messages"
                    ? [
                        {
                          id: 24,
                          lead: 13,
                          status: "sent",
                          direction: "outbound",
                        },
                      ]
                    : collection === "work-orders"
                      ? [
                          {
                            id: 25,
                            lead: 14,
                            status: "scheduled",
                            assignedWorker: { id: 7, displayName: "Marius" },
                            scheduledAt: "2026-09-05T10:00:00.000Z",
                          },
                        ]
                      : [],
        totalDocs: 0,
      }));
    const result = await createAdminNextCanonicalTodayAdapter(
      { find } as never,
      "Marius",
      {
        currentUserId: "user:7",
        now: () => new Date("2026-09-04T10:00:00.000Z"),
      },
    ).load();
    expect(result.source).toBe("canonical");
    expect(result.workQueue?.items).toHaveLength(3);
    expect(new Set(result.value.map(({ stage }) => stage))).toEqual(
      new Set(["offer", "measurement", "visit"]),
    );
    expect(
      result.value.some(({ ownedByCurrentUser }) => ownedByCurrentUser),
    ).toBe(true);
  });

  it("projects the established Admin V2 case workspace without inventing Roof Fusion geometry", () => {
    const source = {
      lead: {
        id: 12,
        name: "Ola Kunde",
        address: "Testveien 4",
        postal: "0123",
        city: "Oslo",
        nextActionOverdue: false,
        nextActionOwner: "administrator",
        recordState: "active",
        revision: 1,
      },
      nextAction: { kind: "approve_measurement" },
      measurement: {
        id: 8,
        reference: "R3-8",
        status: "review_required",
        href: null,
      },
      quote: undefined,
      contract: undefined,
      workOrder: undefined,
      documents: [],
      timeline: [],
    } as unknown as AdminCaseWorkspace;
    const value = projectAdminCaseWorkspace(
      source,
      new Date("2026-09-01T08:00:00.000Z"),
    );
    expect(value).toMatchObject({
      reference: "TF-12",
      customer: "Ola Kunde",
      nextAction: {
        kind: "approve_measurement",
        title: "Takmålingen venter på godkjenning",
        label: null,
        href: null,
      },
    });
    expect(value.measurementReview).toBeUndefined();

    const localized = projectAdminCaseWorkspace(
      source,
      new Date("2026-09-01T08:00:00.000Z"),
      "lt",
    );
    expect(localized.nextAction.title).toBe(
      "Stogo matavimas laukia patvirtinimo",
    );
    expect(localized.nextAction.reason).not.toMatch(
      /Canonical case state|Godkjenn/,
    );
  });

  it.each([
    ["inquiry", {}],
    ["evidence", { measurement: { id: 1 } }],
    ["commercial", { price: { id: 2 } }],
    ["commercial", { quote: { id: 3 } }],
    ["agreement", { contract: { id: 4 } }],
    ["work", { workOrder: { id: 5 } }],
    [
      "completion",
      { workOrder: { id: 5, completedAt: "2026-09-01T09:00:00.000Z" } },
    ],
  ] as const)(
    "derives the six-stage monotonic process at %s",
    (expected, entities) => {
      const source = {
        nextAction: { kind: "approve_message" },
        ...entities,
      } as unknown as AdminCaseWorkspace;
      const stages = projectAdminNextCaseStages(source);
      expect(stages.map(({ id }) => id)).toEqual([
        "inquiry",
        "evidence",
        "commercial",
        "agreement",
        "work",
        "completion",
      ]);
      expect(stages.find(({ state }) => state === "current")?.id).toBe(
        expected,
      );
    },
  );
});
