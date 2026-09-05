import { describe, expect, it } from "vitest";
import {
  ADMIN_NEXT_RF_ROUTE_VERSION,
  buildAdminNextRfRoute,
  parseAdminNextRfRoute,
  resolveAdminNextRfWorkbench,
  safeAdminNextRfReturnTo,
  validateAdminNextRfReturnTo,
  type AdminNextRfCanonicalWorkbenchBinding,
  type AdminNextRfRoute,
} from "./rf-route-contract";

const hash = "a".repeat(64);
const caseIdentity = {
  id: 1042,
  reference: "TF-1042" as const,
  revision: 7,
};

function roundTrip(value: AdminNextRfRoute) {
  const route = buildAdminNextRfRoute(value);
  const parsed = parseAdminNextRfRoute(route);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(parsed.reason);
  expect(parsed.value).toEqual(value);
  return route;
}

describe("Admin Next RF route contract", () => {
  it("round-trips a new measurement without inventing measurement or snapshot identity", () => {
    const value: AdminNextRfRoute = {
      version: ADMIN_NEXT_RF_ROUTE_VERSION,
      mode: "new",
      case: caseIdentity,
      measurement: null,
      snapshot: null,
      blocker: null,
      evidence: [],
      returnTo: "/admin-v2/cases/1042?tab=measurement#measurement-section",
    };

    const route = roundTrip(value);
    expect(route).toContain("/measurements/new?mode=new");
    expect(route).not.toContain("measurementRevision");
    expect(route).not.toContain("snapshotId");
  });

  it("round-trips resume context with an exact optional snapshot and evidence", () => {
    roundTrip({
      version: ADMIN_NEXT_RF_ROUTE_VERSION,
      mode: "resume",
      case: caseIdentity,
      measurement: { id: "rf-1042-r3", revision: 3 },
      snapshot: { id: "rf-1042-r3", revision: 3, hash },
      blocker: "measurement.review_required",
      evidence: ["EVD-R4-1042-01", "photo:1042:2"],
      returnTo:
        "/admin-next-preview/cases/TF-1042?tab=evidence#case-evidence-title",
    });
  });

  it("round-trips resume without a snapshot and requires a snapshot for review", () => {
    roundTrip({
      version: ADMIN_NEXT_RF_ROUTE_VERSION,
      mode: "resume",
      case: caseIdentity,
      measurement: { id: "R4-2026-1042", revision: 1 },
      snapshot: null,
      blocker: null,
      evidence: [],
      returnTo: "/admin-v2/cases/1042",
    });

    const missingSnapshot = parseAdminNextRfRoute(
      "/admin-next-preview/cases/TF-1042/measurements/R4-2026-1042?mode=review&caseRevision=7&measurementRevision=1&returnTo=%2Fadmin-v2%2Fcases%2F1042",
    );
    expect(missingSnapshot).toEqual({ ok: false, reason: "invalid_context" });
  });

  it("round-trips review only with complete measurement and snapshot identity", () => {
    const route = roundTrip({
      version: ADMIN_NEXT_RF_ROUTE_VERSION,
      mode: "review",
      case: caseIdentity,
      measurement: { id: "roof-case-1042-r4", revision: 4 },
      snapshot: { id: "roof-case-1042-r4", revision: 4, hash },
      blocker: "snapshot.conflicted_edges",
      evidence: ["source:osm:1042"],
      returnTo: "/admin-v2/cases/1042?tab=history#version-history-section",
    });
    expect(route).toContain("snapshotHash=" + hash);
  });

  it.each([
    [
      "new path carrying a measurement revision",
      "/admin-next-preview/cases/TF-1042/measurements/new?mode=new&caseRevision=7&measurementRevision=1&returnTo=%2Fadmin-v2%2Fcases%2F1042",
    ],
    [
      "resume with a partial snapshot identity",
      "/admin-next-preview/cases/TF-1042/measurements/R4-1?mode=resume&caseRevision=7&measurementRevision=1&snapshotId=rf-1&returnTo=%2Fadmin-v2%2Fcases%2F1042",
    ],
    [
      "zero revision",
      "/admin-next-preview/cases/TF-1042/measurements/R4-1?mode=resume&caseRevision=0&measurementRevision=1&returnTo=%2Fadmin-v2%2Fcases%2F1042",
    ],
    [
      "non-SHA-256 snapshot hash",
      "/admin-next-preview/cases/TF-1042/measurements/R4-1?mode=review&caseRevision=7&measurementRevision=1&snapshotId=rf-1&snapshotRevision=1&snapshotHash=abc&returnTo=%2Fadmin-v2%2Fcases%2F1042",
    ],
    [
      "duplicate evidence",
      "/admin-next-preview/cases/TF-1042/measurements/R4-1?mode=resume&caseRevision=7&measurementRevision=1&evidence=ev-1&evidence=ev-1&returnTo=%2Fadmin-v2%2Fcases%2F1042",
    ],
    [
      "measurement and pinned snapshot IDs differ",
      `/admin-next-preview/cases/TF-1042/measurements/R4-1?mode=review&caseRevision=7&measurementRevision=1&snapshotId=rf-1&snapshotRevision=1&snapshotHash=${hash}&returnTo=%2Fadmin-v2%2Fcases%2F1042`,
    ],
    [
      "measurement and pinned snapshot revisions differ",
      `/admin-next-preview/cases/TF-1042/measurements/rf-1?mode=resume&caseRevision=7&measurementRevision=1&snapshotId=rf-1&snapshotRevision=2&snapshotHash=${hash}&returnTo=%2Fadmin-v2%2Fcases%2F1042`,
    ],
  ])("fails closed for %s", (_label, route) => {
    expect(parseAdminNextRfRoute(route)).toEqual({
      ok: false,
      reason: "invalid_context",
    });
  });

  it("rejects unknown or duplicated route query parameters", () => {
    const base =
      "/admin-next-preview/cases/TF-1042/measurements/new?mode=new&caseRevision=7&returnTo=%2Fadmin-v2%2Fcases%2F1042";
    expect(parseAdminNextRfRoute(`${base}&debug=1`)).toEqual({
      ok: false,
      reason: "query_not_allowed",
    });
    expect(parseAdminNextRfRoute(`${base}&mode=new`)).toEqual({
      ok: false,
      reason: "query_not_allowed",
    });
  });

  it("rejects malformed encoding in the route and its nested return target", () => {
    expect(
      parseAdminNextRfRoute(
        "/admin-next-preview/cases/TF-1042/measurements/R4-%E0%A4%A?mode=resume",
      ),
    ).toEqual({ ok: false, reason: "malformed_encoding" });

    expect(
      parseAdminNextRfRoute(
        "/admin-next-preview/cases/TF-1042/measurements/new?mode=new&caseRevision=7&returnTo=%25E0%25A4%25A",
      ),
    ).toEqual({ ok: false, reason: "invalid_return_to" });
  });

  it("does not build inconsistent case identity or unsafe context", () => {
    expect(() =>
      buildAdminNextRfRoute({
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "new",
        case: { ...caseIdentity, id: 1043 },
        measurement: null,
        snapshot: null,
        blocker: null,
        evidence: [],
        returnTo: "/admin-v2/cases/1043",
      }),
    ).toThrow(/case id and reference/u);

    expect(() =>
      buildAdminNextRfRoute({
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "review",
        case: caseIdentity,
        measurement: { id: "measurement-1", revision: 4 },
        snapshot: { id: "snapshot-1", revision: 4, hash },
        blocker: null,
        evidence: [],
        returnTo: "/admin-v2/cases/1042",
      }),
    ).toThrow(/same RoofSnapshotV1 id and revision/u);
  });

  it("keeps valid new mode fail-closed until a canonical create workbench exists", () => {
    const route: AdminNextRfRoute = {
      version: ADMIN_NEXT_RF_ROUTE_VERSION,
      mode: "new",
      case: caseIdentity,
      measurement: null,
      snapshot: null,
      blocker: null,
      evidence: [],
      returnTo: "/admin-v2/cases/1042?tab=measurement#measurement-section",
    };

    expect(resolveAdminNextRfWorkbench(route, null)).toEqual({
      ok: false,
      reason: "new_measurement_unavailable",
      returnTo: route.returnTo,
    });
  });

  it("resolves exact resume and review bindings and preserves one return target", () => {
    const binding = {
      case: caseIdentity,
      measurement: { id: "roof-case-1042-r4", revision: 4 },
      snapshot: { id: "roof-case-1042-r4", revision: 4, hash },
    } as const;
    const resume: AdminNextRfRoute = {
      version: ADMIN_NEXT_RF_ROUTE_VERSION,
      mode: "resume",
      case: caseIdentity,
      measurement: binding.measurement,
      snapshot: null,
      blocker: null,
      evidence: [],
      returnTo: "/admin-v2/cases/1042?tab=measurement#measurement-section",
    };
    const review: AdminNextRfRoute = {
      ...resume,
      mode: "review",
      snapshot: binding.snapshot,
    };

    expect(resolveAdminNextRfWorkbench(resume, binding)).toEqual({
      ok: true,
      mode: "resume",
      returnTo: resume.returnTo,
    });
    expect(resolveAdminNextRfWorkbench(review, binding)).toEqual({
      ok: true,
      mode: "review",
      returnTo: review.returnTo,
    });
  });

  it.each([
    ["missing canonical", null, "canonical_snapshot_missing"],
    [
      "other case",
      {
        case: { id: 1043, reference: "TF-1043", revision: 7 },
        measurement: { id: "roof-case-1042-r4", revision: 4 },
        snapshot: { id: "roof-case-1042-r4", revision: 4, hash },
      },
      "case_context_mismatch",
    ],
    [
      "stale case revision",
      {
        case: { ...caseIdentity, revision: 8 },
        measurement: { id: "roof-case-1042-r4", revision: 4 },
        snapshot: { id: "roof-case-1042-r4", revision: 4, hash },
      },
      "case_revision_stale",
    ],
    [
      "stale measurement revision",
      {
        case: caseIdentity,
        measurement: { id: "roof-case-1042-r4", revision: 5 },
        snapshot: { id: "roof-case-1042-r4", revision: 5, hash },
      },
      "measurement_revision_stale",
    ],
    [
      "stale snapshot hash",
      {
        case: caseIdentity,
        measurement: { id: "roof-case-1042-r4", revision: 4 },
        snapshot: {
          id: "roof-case-1042-r4",
          revision: 4,
          hash: "b".repeat(64),
        },
      },
      "snapshot_hash_stale",
    ],
  ])(
    "returns recovery for %s instead of treating a valid route as missing",
    (_label, binding, reason) => {
      const route: AdminNextRfRoute = {
        version: ADMIN_NEXT_RF_ROUTE_VERSION,
        mode: "review",
        case: caseIdentity,
        measurement: { id: "roof-case-1042-r4", revision: 4 },
        snapshot: { id: "roof-case-1042-r4", revision: 4, hash },
        blocker: null,
        evidence: [],
        returnTo:
          "/admin-next-preview/cases/TF-1042?tab=evidence#case-evidence-title",
      };

      expect(
        resolveAdminNextRfWorkbench(
          route,
          binding as AdminNextRfCanonicalWorkbenchBinding | null,
        ),
      ).toEqual({
        ok: false,
        reason,
        returnTo: route.returnTo,
      });
    },
  );
});

describe("Admin Next RF same-case returnTo whitelist", () => {
  it.each([
    "/admin-v2/cases/1042",
    "/admin-v2/cases/1042?tab=work#work-planning",
    "/admin-next-preview/cases/TF-1042",
    "/admin-next-preview/cases/TF-1042?tab=timeline#case-timeline-title",
  ])("allows a same-case canonical or preview target: %s", (returnTo) => {
    expect(validateAdminNextRfReturnTo(returnTo, caseIdentity)).toEqual({
      ok: true,
      value: returnTo,
    });
    expect(safeAdminNextRfReturnTo(returnTo, caseIdentity)).toBe(returnTo);
  });

  it.each([
    ["protocol-relative", "//evil.example/admin-v2/cases/1042"],
    ["external", "https://evil.example/admin-v2/cases/1042"],
    ["other canonical case", "/admin-v2/cases/1043"],
    ["other preview case", "/admin-next-preview/cases/TF-1043"],
    ["unknown path", "/admin-v2/cases/1042/measurements"],
    ["unknown query", "/admin-v2/cases/1042?debug=1"],
    ["duplicate tab", "/admin-v2/cases/1042?tab=work&tab=work"],
    ["unknown tab", "/admin-v2/cases/1042?tab=system"],
    ["unknown canonical hash", "/admin-v2/cases/1042#admin-secrets"],
    [
      "preview-only hash on canonical path",
      "/admin-v2/cases/1042#case-timeline-title",
    ],
    ["malformed encoding", "/admin-v2/cases/1042?tab=%E0%A4%A"],
    ["encoded path ambiguity", "/admin-v2/cases/1042/%2e%2e/1042"],
  ])("rejects %s", (_label, returnTo) => {
    expect(validateAdminNextRfReturnTo(returnTo, caseIdentity).ok).toBe(false);
    expect(safeAdminNextRfReturnTo(returnTo, caseIdentity)).toBeNull();
  });

  it("rejects an internally inconsistent expected case identity", () => {
    expect(
      validateAdminNextRfReturnTo("/admin-v2/cases/1042", {
        id: 1042,
        reference: "TF-1043",
      }),
    ).toEqual({ ok: false, reason: "case_mismatch" });
  });
});
