import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type VercelConfiguration = {
  crons?: Array<{ path: string; schedule: string }>;
  functions?: Record<string, { maxDuration?: number }>;
};

const vercelConfiguration = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../vercel.json", import.meta.url)),
    "utf8",
  ),
) as VercelConfiguration;

const operationalWorkflow = readFileSync(
  fileURLToPath(
    new URL("../../../.github/workflows/operational-jobs.yml", import.meta.url),
  ),
  "utf8",
);

describe("operational scheduler configuration", () => {
  it("uses GitHub Actions as the only periodic operational-jobs scheduler", () => {
    expect(
      vercelConfiguration.crons?.filter((cron) =>
        cron.path.startsWith("/api/cron/operational-jobs"),
      ),
    ).toEqual([]);

    expect(
      operationalWorkflow.match(/cron: "7,22,37,52 \* \* \* \*"/g),
    ).toHaveLength(1);
    const minuteOffsets = [7, 22, 37, 52];
    expect(
      minuteOffsets.map((minute, index) => {
        const nextMinute = minuteOffsets[(index + 1) % minuteOffsets.length]!;
        return (nextMinute - minute + 60) % 60;
      }),
    ).toEqual([15, 15, 15, 15]);
    expect(operationalWorkflow).toContain("takfornyelse-operational-jobs");
    expect(operationalWorkflow).toContain("cancel-in-progress: false");
    expect(operationalWorkflow).toContain("permissions:\n  contents: read");
    expect(operationalWorkflow).toContain(
      "CRON_SECRET: ${{ secrets.TAKFORNYELSE_CRON_SECRET }}",
    );
    expect(operationalWorkflow).toContain(
      '-H "Authorization: Bearer ${CRON_SECRET}"',
    );
    expect(operationalWorkflow).toContain(
      "/api/cron/operational-jobs?limit=50",
    );
  });

  it("keeps the operational endpoint deployed and other Vercel crons unchanged", () => {
    expect(
      vercelConfiguration.functions?.[
        "src/app/api/cron/operational-jobs/route.ts"
      ],
    ).toEqual({ maxDuration: 60 });

    expect(vercelConfiguration.crons).toEqual([
      { path: "/api/cron/purge-leads", schedule: "0 3 * * 0" },
      { path: "/api/cron/seo-drafts", schedule: "0 7 * * 1,4" },
      { path: "/api/cron/publish-posts", schedule: "15 6 * * *" },
    ]);
  });
});
