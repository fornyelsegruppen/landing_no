import { describe, expect, it } from "vitest";
import { blogAutomationStatus } from "./automation-status";
function payload() {
  return { find: async () => ({ docs: [], totalDocs: 3 }) } as never;
}
describe("automation status evidence", () => {
  const environment = {
    GOOGLE_SEARCH_CONSOLE_CREDENTIALS: "synthetic",
    GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:takfornyelsenorge.no",
  };
  function evidencePayload(runs: unknown[]) {
    return {
      find: async (input: {
        where?: { jobType?: { in?: unknown }; and?: unknown[] };
      }) => ({ docs: input.where?.jobType?.in ? [] : runs, totalDocs: 0 }),
    } as never;
  }
  function success(property?: string) {
    return {
      id: 1,
      status: "completed",
      startedAt: "2026-09-10T09:00:00Z",
      finishedAt: "2026-09-10T09:01:00Z",
      qualityResult: {
        kind: "seo-source-refresh-v1",
        access: "verified",
        observationStatus: "available",
        ...(property ? { property } : {}),
      },
    };
  }
  it.each([undefined, "https://www.takfornyelse.as/"])(
    "never verifies a changed property from old/legacy evidence (%s)",
    async (property) => {
      const dto = await blogAutomationStatus(
        evidencePayload([success(property)]),
        new Date("2026-09-12T00:00:00Z"),
        environment,
      );
      expect(dto.sources.searchConsole).toEqual({
        access: "unverified",
        freshness: "unknown",
        lastSuccessAt: null,
      });
    },
  );
  it("retains the matching property's successful observation after a failed refresh", async () => {
    const previous = success(environment.GOOGLE_SEARCH_CONSOLE_SITE_URL);
    const failure = {
      ...previous,
      id: 2,
      status: "failed",
      startedAt: "2026-09-11T09:00:00Z",
      finishedAt: "2026-09-11T09:01:00Z",
      qualityResult: { ...previous.qualityResult, access: "failed" },
    };
    const dto = await blogAutomationStatus(
      evidencePayload([failure, previous]),
      new Date("2026-09-12T00:00:00Z"),
      environment,
    );
    expect(dto.sources.searchConsole).toEqual({
      access: "failed",
      freshness: "fresh",
      lastSuccessAt: previous.finishedAt,
    });
    const stale = await blogAutomationStatus(
      evidencePayload([failure, previous]),
      new Date("2026-09-16T00:00:00Z"),
      environment,
    );
    expect(stale.sources.searchConsole.freshness).toBe("stale");
  });
  it("verifies only success for the configured property", async () => {
    const dto = await blogAutomationStatus(
      evidencePayload([success(environment.GOOGLE_SEARCH_CONSOLE_SITE_URL)]),
      new Date("2026-09-12T00:00:00Z"),
      environment,
    );
    expect(dto.sources.searchConsole.access).toBe("verified");
  });
  it("distinguishes flags from executor evidence and never returns credentials", async () => {
    const dto = await blogAutomationStatus(
      payload(),
      new Date("2026-09-12T00:00:00Z"),
      {
        FEATURE_SEO_SCHEDULER: "true",
        FEATURE_AI_DRAFTS: "true",
        FEATURE_SEO_AUTO_PUBLISH: "true",
        GOOGLE_SEARCH_CONSOLE_CREDENTIALS: "secret-test",
        GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:takfornyelsenorge.no",
      },
    );
    expect(dto.executor.state).toBe("unknown");
    expect(dto.sources.searchConsole.access).toBe("unverified");
    expect(dto.pendingApprovalCount).toBe(3);
    expect(JSON.stringify(dto)).not.toContain("secret-test");
  });
  it("keeps configured next date separate from paused executor", async () => {
    const dto = await blogAutomationStatus(
      payload(),
      new Date("2026-09-12T00:00:00Z"),
      {},
    );
    expect(dto.executor.state).toBe("paused");
    expect(dto.nextConfiguredRunAt).toBe("2026-09-14T07:00:00.000Z");
    expect(dto.sources.searchConsole.access).toBe("configuration_required");
  });
});
