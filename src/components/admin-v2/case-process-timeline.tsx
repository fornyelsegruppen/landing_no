"use client";

import { useRef, useState, type ReactNode } from "react";
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
import { CaseInspector } from "@/components/admin-v2/case-inspector";
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
  /** Exact ID of the matching section rendered inside the case inspector. */
  inspectorTargetId?: string;
  statusText?: string | null;
  timestamp?: string | null;
  relatedLinks?: readonly CaseProcessRelatedLink[];
};

export type CaseProcessHistoryItem = {
  content?: ReactNode;
  description: string;
  id: string;
  inspectorTargetId: string;
  status?: string;
  title: string;
};

export type CaseProcessInspectorSelection =
  | {
      kind: "stage";
      targetId: string;
      title: string;
    }
  | {
      content: ReactNode;
      description: string;
      kind: "history";
      targetId: string;
      title: string;
    };

export function resolveCaseProcessInspectorContent(
  selection: CaseProcessInspectorSelection | null,
  registryContent: ReactNode,
  historyFallback: ReactNode,
) {
  if (!selection) return null;
  return selection.kind === "history"
    ? (selection.content ?? historyFallback)
    : registryContent;
}

export function restoreInspectorTriggerFocus(
  trigger: Pick<HTMLElement, "focus"> | null,
  schedule: (callback: () => void) => unknown = (callback) =>
    window.requestAnimationFrame(callback),
) {
  if (!trigger) return;
  schedule(() => schedule(() => trigger.focus({ preventScroll: true })));
}

export type CaseProcessTimelineProps = {
  activeStageId: CaseProcessStageId;
  activeStageState?: Extract<CaseProcessStageState, "current" | "blocked">;
  historyItems?: readonly CaseProcessHistoryItem[];
  historyId?: string;
  inspectorContent?: ReactNode;
  locale: PanelLocale;
  sectionId?: string;
  stageContent?: Partial<Record<CaseProcessStageId, CaseProcessStageContent>>;
  stagePanels?: Partial<Record<CaseProcessStageId, ReactNode>>;
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
  historyItems = [],
  historyId = "case-history",
  inspectorContent,
  locale,
  sectionId = "case-process-title",
  stageContent = {},
  stagePanels = {},
}: CaseProcessTimelineProps) {
  const workspaceLabels = getCaseWorkspaceCopy(locale);
  const labels = workspaceLabels.process;
  const stages = resolveCaseProcessStages({
    activeStageId,
    activeStageState,
  });
  const [openStageId, setOpenStageId] = useState<CaseProcessStageId | null>(
    stagePanels[activeStageId] ? activeStageId : null,
  );
  const [inspectorSelection, setInspectorSelection] =
    useState<CaseProcessInspectorSelection | null>(null);
  const inspectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openInspector = (
    selection: CaseProcessInspectorSelection,
    trigger: HTMLButtonElement,
  ) => {
    inspectorTriggerRef.current = trigger;
    setInspectorSelection(selection);
  };
  const closeInspector = () => {
    setInspectorSelection(null);
    restoreInspectorTriggerFocus(inspectorTriggerRef.current);
  };
  const historyFallback =
    inspectorSelection?.kind === "history" ? (
      <p className="text-muted-foreground text-sm">
        {inspectorSelection.description}
      </p>
    ) : null;
  const selectedInspectorContent = resolveCaseProcessInspectorContent(
    inspectorSelection,
    inspectorContent,
    historyFallback,
  );
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
          const canExpand =
            stage.state !== "not_started" && Boolean(stagePanels[stage.id]);
          const canInspect =
            stage.state !== "not_started" &&
            Boolean(inspectorContent && content?.inspectorTargetId);
          const isExpanded = canExpand && openStageId === stage.id;
          const relatedLinks =
            stage.state === "not_started"
              ? []
              : (content?.relatedLinks ?? []).filter(
                  (link) => !link.href.startsWith("#"),
                );
          const stageHeader = (
            <>
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-current/20">
                <StateIcon state={stage.state} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold tracking-wider uppercase">
                  {stateLabel}
                </span>
                <span className="mt-1 flex min-h-12 items-center text-base font-bold">
                  {stageLabel}
                </span>
                {content?.statusText && stage.state !== "not_started" ? (
                  <span className="mt-1 block text-sm">
                    {content.statusText}
                  </span>
                ) : null}
                {content?.timestamp && stage.state !== "not_started" ? (
                  <time className="text-muted-foreground mt-1 block text-xs">
                    {content.timestamp}
                  </time>
                ) : null}
              </span>
              {canExpand ? (
                <span className="mt-3 flex shrink-0 items-center gap-2 text-xs font-bold">
                  <span>
                    {isExpanded ? labels.closeStage : labels.openStage}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-5 shrink-0 transition-transform motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`}
                  />
                </span>
              ) : null}
            </>
          );

          return (
            <li
              key={stage.id}
              aria-current={stage.isCurrent ? "step" : undefined}
              className={`rounded-xl border p-3 ${stateStyles[stage.state]}`}
              data-process-stage={stage.id}
              data-process-state={stage.state}
            >
              {canExpand ? (
                <button
                  aria-controls={`case-process-panel-${stage.id}`}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? labels.closeStage : labels.openStage}: ${stageLabel}`}
                  className="focus-visible:outline-accent flex min-h-12 w-full items-start gap-3 rounded-lg p-1 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2"
                  onClick={() =>
                    setOpenStageId((current) =>
                      current === stage.id ? null : stage.id,
                    )
                  }
                  type="button"
                >
                  {stageHeader}
                </button>
              ) : (
                <div className="flex items-start gap-3">{stageHeader}</div>
              )}

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

              {canExpand ? (
                <div
                  className="mt-3 border-t border-current/15 pt-4"
                  hidden={!isExpanded}
                  id={`case-process-panel-${stage.id}`}
                >
                  {stagePanels[stage.id]}
                  {canInspect ? (
                    <button
                      className="focus-visible:outline-accent mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-current/25 bg-black/15 px-4 text-sm font-bold hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto"
                      onClick={(event) =>
                        openInspector(
                          {
                            kind: "stage",
                            targetId: content!.inspectorTargetId!,
                            title: stageLabel,
                          },
                          event.currentTarget,
                        )
                      }
                      type="button"
                    >
                      {labels.openInspector}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {historyItems.length ? (
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
          <ol className="relative ml-6 border-l border-white/10 p-4 pl-5">
            {historyItems.map((item) => (
              <li className="relative pb-3 last:pb-0" key={item.id}>
                <span className="bg-accent ring-background-elevated absolute top-4 -left-[1.57rem] size-2.5 rounded-full ring-4" />
                <button
                  aria-label={`${labels.openInspector}: ${item.title}`}
                  className="focus-visible:outline-accent block min-h-12 w-full rounded-xl p-2 text-left transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2"
                  onClick={(event) =>
                    openInspector(
                      {
                        content: item.content,
                        description: item.description,
                        kind: "history",
                        targetId: item.inspectorTargetId,
                        title: item.title,
                      },
                      event.currentTarget,
                    )
                  }
                  type="button"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{item.title}</strong>
                    {item.status ? (
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[.68rem] font-bold tracking-wider text-white/75 uppercase">
                        {item.status}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {item.description}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {inspectorSelection &&
      (inspectorSelection.kind === "history" || inspectorContent) ? (
        <CaseInspector
          busyCloseMessage={labels.waitForAction}
          closeLabel={labels.closeInspector}
          description={
            inspectorSelection.kind === "history"
              ? inspectorSelection.description
              : labels.inspectorHelp
          }
          initialTargetId={inspectorSelection.targetId}
          discardChangesMessage={labels.discardChanges}
          onClose={closeInspector}
          open
          returnFocusRef={inspectorTriggerRef}
          title={inspectorSelection.title}
        >
          {selectedInspectorContent}
        </CaseInspector>
      ) : null}
    </section>
  );
}
