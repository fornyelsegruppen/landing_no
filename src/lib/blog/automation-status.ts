import type { Payload } from "payload";
import { enabled } from "./automation-policy";
import { nextConfiguredSeoDraftAt, SEO_TIME_ZONE } from "./schedule";

export async function blogAutomationStatus(
  payload: Payload,
  now = new Date(),
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const draftsEnabled =
    enabled(environment.FEATURE_SEO_SCHEDULER) &&
    enabled(environment.FEATURE_AI_DRAFTS);
  const approvedPublisherEnabled =
    enabled(environment.FEATURE_SEO_SCHEDULER) &&
    enabled(environment.FEATURE_SEO_AUTO_PUBLISH);
  const property = environment.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim();
  const [runs, pending, sourceRuns, successfulSourceRuns] = await Promise.all([
    payload.find({
      collection: "seo-runs",
      depth: 0,
      overrideAccess: true,
      limit: 1,
      sort: "-startedAt",
      where: {
        jobType: { in: ["blog.article.draft", "blog.approved.publish"] },
      },
    }),
    payload.find({
      collection: "posts",
      draft: true,
      depth: 0,
      limit: 1,
      select: { titleNo: true },
      overrideAccess: true,
      where: {
        and: [
          { _status: { equals: "draft" } },
          { editorialStatus: { in: ["draft", "ai_qa", "human_review"] } },
        ],
      },
    }),
    payload.find({
      collection: "seo-runs",
      depth: 0,
      overrideAccess: true,
      limit: 50,
      sort: "-startedAt",
      where: { jobType: { equals: "blog.signals.refresh" } },
    }),
    payload.find({
      collection: "seo-runs",
      depth: 0,
      overrideAccess: true,
      limit: 50,
      sort: "-startedAt",
      where: {
        and: [
          { jobType: { equals: "blog.signals.refresh" } },
          { status: { equals: "completed" } },
        ],
      },
    }),
  ]);
  const run = runs.docs[0];
  // Bounded evidence scans. Legacy snapshots without a property cannot verify
  // this property, nor can success for the old domain verify the migrated one.
  const propertySnapshot = (snapshot: unknown) => {
    if (
      !property ||
      !snapshot ||
      typeof snapshot !== "object" ||
      Array.isArray(snapshot)
    )
      return null;
    const value = snapshot as Record<string, unknown>;
    return value.kind === "seo-source-refresh-v1" && value.property === property
      ? value
      : null;
  };
  const sourceRun = sourceRuns.docs.find((item) =>
    propertySnapshot(item.qualityResult),
  );
  const observation = propertySnapshot(sourceRun?.qualityResult);
  const lastSuccess = successfulSourceRuns.docs.find(
    (item) =>
      item.status === "completed" &&
      propertySnapshot(item.qualityResult)?.access === "verified",
  );
  const successfulObservation = propertySnapshot(lastSuccess?.qualityResult);
  const verifiedSource =
    sourceRun?.status === "completed" && observation?.access === "verified";
  return {
    features: { draftsEnabled, approvedPublisherEnabled },
    // Neither an enabled environment flag nor an HTTP canary proves a live
    // periodic executor. A future verified attestation must carry expiry.
    executor: {
      state:
        draftsEnabled || approvedPublisherEnabled
          ? ("unknown" as const)
          : ("paused" as const),
      verifiedAt: null,
      targetMatches: null,
    },
    timeZone: SEO_TIME_ZONE,
    lastRun: run
      ? {
          id: run.id,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt || null,
          errorCode: run.errorCode || null,
        }
      : null,
    nextConfiguredRunAt: nextConfiguredSeoDraftAt(now),
    pendingApprovalCount: pending.totalDocs,
    sources: {
      searchConsole: {
        access:
          !environment.GOOGLE_SEARCH_CONSOLE_CREDENTIALS?.trim() || !property
            ? "configuration_required"
            : verifiedSource
              ? "verified"
              : sourceRun?.status === "failed"
                ? "failed"
                : "unverified",
        freshness: !lastSuccess
          ? "unknown"
          : now.getTime() -
                new Date(
                  lastSuccess.finishedAt || lastSuccess.startedAt,
                ).getTime() >
              4 * 86_400_000
            ? "stale"
            : successfulObservation?.observationStatus === "no-data"
              ? "no-data"
              : "fresh",
        lastSuccessAt: lastSuccess?.finishedAt || null,
      },
      trends: {
        access: "unverified",
        freshness: "unknown",
        lastSuccessAt: null,
      },
    },
  };
}
