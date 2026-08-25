import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { buildPlatformHealth, loadOperationalHealth } from "./health";

describe("platform health", () => {
  it("returns only safe configuration metadata", () => {
    const result = buildPlatformHealth({
      FEATURE_AI_DRAFTS: "true",
      GEMINI_API_KEY: "a-secret-key",
      RESEND_API_KEY: "another-secret",
    });

    expect(result.features.aiDrafts).toMatchObject({
      enabled: true,
      ready: true,
      unavailable: [],
    });
    expect(result.integrations.ai).toMatchObject({
      readiness: "ready",
      provider: "gemini",
      missing: [],
    });
    expect(JSON.stringify(result)).not.toContain("a-secret-key");
    expect(JSON.stringify(result)).not.toContain("another-secret");
  });

  it("summarizes operational evidence without exposing message or job payloads", async () => {
    const totals = [2, 3, 4, 5, 6];
    const count = vi.fn().mockImplementation(async () => ({ totalDocs: totals.shift() }));
    const find = vi.fn()
      .mockResolvedValueOnce({ docs: [{ completedAt: "2026-08-25T10:00:00.000Z", payload: { secret: "hidden" } }] })
      .mockResolvedValueOnce({ docs: [{ deliveredAt: "2026-08-25T11:00:00.000Z", bodyText: "private message" }] })
      .mockResolvedValueOnce({ docs: [{ finishedAt: "2026-08-25T12:00:00.000Z", qualityResult: { prompt: "hidden" } }] });

    const result = await loadOperationalHealth(
      { count, find } as unknown as Pick<Payload, "count" | "find">,
      new Date("2026-08-25T13:00:00.000Z"),
      { BACKUP_LAST_VERIFIED_AT: "2026-08-24T08:00:00.000Z", RESTORE_TEST_REFERENCE: "RESTORE-1" },
    );

    expect(result).toEqual({
      backup: { lastVerifiedAt: "2026-08-24T08:00:00.000Z", referenceConfigured: true },
      email: { failed: 5, lastDeliveredAt: "2026-08-25T11:00:00.000Z" },
      jobs: { failed: 2, overdue: 3, quotaWarnings: 4, lastCompletedAt: "2026-08-25T10:00:00.000Z" },
      seo: { failed: 6, lastCompletedAt: "2026-08-25T12:00:00.000Z" },
    });
    expect(JSON.stringify(result)).not.toContain("private message");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
