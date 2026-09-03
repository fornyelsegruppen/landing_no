import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import {
  summarizeBlogReview,
  type BlogReviewInput,
  type PublicationBlocker,
} from "@/lib/admin-v2/blog-review";
import type { PanelLocale } from "@/lib/panel-i18n";

type Props = BlogReviewInput & {
  locale: PanelLocale;
};

function severityClasses(kind: "pass" | "warning" | "blocker") {
  if (kind === "pass") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }
  if (kind === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-100";
}

export function BlogReviewPanel({ locale, ...input }: Props) {
  const copy = getAdminV2Copy(locale).blogAdmin;
  const review = summarizeBlogReview(input);
  const publicationBlockerLabels: Record<PublicationBlocker, string> = {
    approval: copy.approvalRequired,
    precise_source: copy.preciseSourceRequired,
    quality: copy.qualityFailed,
    review_record: copy.reviewRecordRequired,
  };
  const blockerCount =
    review.blockers.length + review.publicationBlockers.length;

  return (
    <section className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">
            {copy.reviewGate}
          </p>
          <h2 className="mt-3 text-2xl font-bold">
            {review.publishReady ? copy.gateReady : copy.gateBlocked}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
            {copy.gateRule}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${severityClasses(
            review.publishReady ? "pass" : "blocker",
          )}`}
        >
          <p className="font-bold">
            {copy.quality}:{" "}
            {review.qualityScore === null ? "—" : review.qualityScore}
          </p>
          <p className="mt-1">
            {review.qualityPassed ? copy.qualityPassed : copy.qualityFailed}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                {copy.blockers}
              </p>
              <p className="mt-2 text-2xl font-bold">{blockerCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                {copy.warnings}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {review.warnings.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                {copy.reviewFlags}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {review.reviewFlags.length}
              </p>
            </div>
          </div>

          {blockerCount || review.warnings.length ? (
            <div className="grid gap-3">
              {review.publicationBlockers.map((blocker) => (
                <article
                  className={`rounded-2xl border p-4 ${severityClasses("blocker")}`}
                  key={`publication-${blocker}`}
                >
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <p className="font-bold">
                      {publicationBlockerLabels[blocker]}
                    </p>
                  </div>
                </article>
              ))}
              {review.blockers.map((issue, index) => (
                <article
                  className={`rounded-2xl border p-4 ${severityClasses("blocker")}`}
                  key={`blocker-${issue.code || index}`}
                >
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-bold">
                        {issue.message || issue.code || "Issue"}
                      </p>
                      {issue.gate ? (
                        <p className="mt-1 text-xs tracking-wide uppercase opacity-80">
                          {issue.gate}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
              {review.warnings.map((issue, index) => (
                <article
                  className={`rounded-2xl border p-4 ${severityClasses("warning")}`}
                  key={`warning-${issue.code || index}`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-bold">
                        {issue.message || issue.code || "Issue"}
                      </p>
                      {issue.gate ? (
                        <p className="mt-1 text-xs tracking-wide uppercase opacity-80">
                          {issue.gate}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div
              className={`rounded-2xl border p-4 ${severityClasses("pass")}`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-4 shrink-0" />
                <p className="font-bold">{copy.noIssues}</p>
              </div>
            </div>
          )}

          {review.reviewFlags.length ? (
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <h3 className="font-bold">{copy.reviewFlags}</h3>
              <ul className="text-muted-foreground mt-3 grid gap-2 text-sm">
                {review.reviewFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <h3 className="font-bold">{copy.sources}</h3>
            <div className="mt-3 grid gap-3">
              {review.sources.length ? (
                review.sources.map((source, index) => (
                  <div
                    className="rounded-xl border border-white/10 p-3"
                    key={`${source.url || source.label || index}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {source.label || source.url || "Source"}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {source.publisher || source.url || "—"}
                        </p>
                      </div>
                      {source.url ? (
                        <a
                          className="text-accent inline-flex shrink-0 items-center gap-1 text-sm font-bold"
                          href={source.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      ) : null}
                    </div>
                    {review.homepageOnlySources.some(
                      (item) => item.url === source.url,
                    ) ? (
                      <p className="mt-2 text-sm text-amber-300">
                        {copy.homepageRisk}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">—</p>
              )}
            </div>
          </div>

          {review.stockImage ? (
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <h3 className="font-bold">{copy.stockImageCard}</h3>
              <dl className="mt-3 grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    Provider
                  </dt>
                  <dd className="mt-1">{review.stockImage.provider || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    {copy.photographer}
                  </dt>
                  <dd className="mt-1">
                    {review.stockImage.photographerUrl ? (
                      <a
                        className="text-accent inline-flex items-center gap-1 font-medium"
                        href={review.stockImage.photographerUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {review.stockImage.photographer ||
                          review.stockImage.photographerUrl}
                        <ExternalLink className="size-4" />
                      </a>
                    ) : (
                      review.stockImage.photographer || "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    {copy.sourcePage}
                  </dt>
                  <dd className="mt-1">
                    {review.stockImage.sourceUrl ? (
                      <a
                        className="text-accent inline-flex items-center gap-1 font-medium"
                        href={review.stockImage.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {review.stockImage.sourceUrl}
                        <ExternalLink className="size-4" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    {copy.license}
                  </dt>
                  <dd className="mt-1">
                    {review.stockImage.licenseUrl ? (
                      <a
                        className="text-accent inline-flex items-center gap-1 font-medium"
                        href={review.stockImage.licenseUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {review.stockImage.licenseUrl}
                        <ExternalLink className="size-4" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    {copy.searchQuery}
                  </dt>
                  <dd className="mt-1">{review.stockImage.query || "—"}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
