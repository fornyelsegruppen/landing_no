import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  Wrench,
} from "lucide-react";
import { getCaseWorkspaceCopy } from "@/lib/admin-v2/case-workspace-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  resolveCaseProcessStages,
  type CaseProcessStageId,
  type CaseProcessStageState,
} from "@/lib/admin-v2/case-process-stages";

export type CaseProcessRelatedLink = {
  /** A complete URL or an exact rendered fragment target. */
  href: string;
  /** Required accessible name; document links should include the version. */
  accessibleName: string;
  label: string;
  kind: "document" | "evidence" | "recovery";
  openInNewTab?: boolean;
};

export type CaseProcessStageContent = {
  /** Exact ID of a focusable rendered section heading, including '#'. */
  sectionHref?: `#${string}`;
  statusText?: string | null;
  timestamp?: string | null;
  relatedLinks?: readonly CaseProcessRelatedLink[];
};

export type CaseProcessTimelineProps = {
  activeStageId: CaseProcessStageId;
  activeStageState?: Extract<CaseProcessStageState, "current" | "blocked">;
  auditHistory?: ReactNode;
  historyId?: string;
  locale: PanelLocale;
  sectionId?: string;
  stageContent?: Partial<Record<CaseProcessStageId, CaseProcessStageContent>>;
};

const stateStyles: Record<CaseProcessStageState, string> = {
  not_started: "border-white/10 bg-black/10 text-muted-foreground",
  current: "border-accent/45 bg-accent/10 text-foreground",
  blocked: "border-danger/50 bg-danger/10 text-foreground",
  completed: "border-success/35 bg-success/10 text-foreground",
};

function StateIcon({ state }: { state: CaseProcessStageState }) {
  const iconClass =
    state === "blocked"
      ? "text-danger"
      : state === "completed"
        ? "text-success"
        : state === "current"
          ? "text-accent"
          : "text-muted-foreground";

  if (state === "blocked") {
    return (
      <AlertTriangle aria-hidden="true" className={`size-5 ${iconClass}`} />
    );
  }

  if (state === "completed") {
    return <Check aria-hidden="true" className={`size-5 ${iconClass}`} />;
  }

  if (state === "current") {
    return <Clock3 aria-hidden="true" className={`size-5 ${iconClass}`} />;
  }

  return <Circle aria-hidden="true" className={`size-5 ${iconClass}`} />;
}

function RelatedLink({ link }: { link: CaseProcessRelatedLink }) {
  const Icon =
    link.kind === "document"
      ? FileText
      : link.kind === "recovery"
        ? Wrench
        : ExternalLink;

  return (
    <a
      aria-label={link.accessibleName}
      className="focus-visible:outline-accent flex min-h-12 items-center gap-2 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-sm font-semibold break-words hover:border-white/25 focus-visible:outline-2 focus-visible:outline-offset-2"
      href={link.href}
      rel={link.openInNewTab ? "noreferrer" : undefined}
      target={link.openInNewTab ? "_blank" : undefined}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0">{link.label}</span>
    </a>
  );
}

export function CaseProcessTimeline({
  activeStageId,
  activeStageState = "current",
  auditHistory,
  historyId = "case-history",
  locale,
  sectionId = "case-process-title",
  stageContent = {},
}: CaseProcessTimelineProps) {
  const workspaceLabels = getCaseWorkspaceCopy(locale);
  const labels = workspaceLabels.process;
  const stages = resolveCaseProcessStages({
    activeStageId,
    activeStageState,
  });

  return (
    <section aria-labelledby={sectionId}>
      <div>
        <h2
          id={sectionId}
          className="scroll-mt-36 text-2xl font-bold"
          tabIndex={-1}
        >
          {labels.title}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{labels.help}</p>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {stages.map((stage) => {
          const content = stageContent[stage.id];
          const stageLabel = workspaceLabels.stages[stage.id];
          const stateLabel = labels.states[stage.state];
          const canNavigate =
            stage.state !== "not_started" && Boolean(content?.sectionHref);
          const relatedLinks =
            stage.state === "not_started" ? [] : (content?.relatedLinks ?? []);

          return (
            <li
              key={stage.id}
              aria-current={stage.isCurrent ? "step" : undefined}
              className={`rounded-xl border p-3 ${stateStyles[stage.state]}`}
              data-process-stage={stage.id}
              data-process-state={stage.state}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-current/20">
                  <StateIcon state={stage.state} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold tracking-wider uppercase">
                    {stateLabel}
                  </span>
                  {canNavigate ? (
                    <a
                      aria-label={`${labels.openStage}: ${stageLabel}`}
                      className="focus-visible:outline-accent mt-1 flex min-h-12 items-center rounded-lg text-base font-bold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      href={content?.sectionHref}
                    >
                      {stageLabel}
                    </a>
                  ) : (
                    <span className="mt-1 flex min-h-12 items-center text-base font-bold">
                      {stageLabel}
                    </span>
                  )}
                  {content?.statusText && stage.state !== "not_started" ? (
                    <p className="mt-1 text-sm">{content.statusText}</p>
                  ) : null}
                  {content?.timestamp && stage.state !== "not_started" ? (
                    <time className="text-muted-foreground mt-1 block text-xs">
                      {content.timestamp}
                    </time>
                  ) : null}
                </div>
              </div>

              {relatedLinks.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {relatedLinks.map((link) => (
                    <RelatedLink
                      key={`${link.kind}:${link.href}`}
                      link={link}
                    />
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {auditHistory ? (
        <details
          id={historyId}
          className="group mt-5 rounded-xl border border-white/10 bg-black/10"
        >
          <summary
            aria-label={labels.historyHelp}
            className="focus-visible:outline-accent flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span className="flex-1">{labels.history}</span>
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="border-t border-white/10 p-4">{auditHistory}</div>
        </details>
      ) : null}
    </section>
  );
}
