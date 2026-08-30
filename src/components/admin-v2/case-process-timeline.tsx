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
  artifactCount?: number;
  category: "communication" | "decision" | "document";
  content?: ReactNode;
  description: string;
  id: string;
  inspectorTargetId: string;
  status?: string;
  title: string;
};

export type CaseProcessHistoryFilter =
  "all" | CaseProcessHistoryItem["category"];

export function filterCaseProcessHistoryItems(
  items: readonly CaseProcessHistoryItem[],
  filter: CaseProcessHistoryFilter,
) {
  return filter === "all"
    ? items
    : items.filter((item) => item.category === filter);
}

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
    null,
  );
  const [historyFilter, setHistoryFilter] =
    useState<CaseProcessHistoryFilter>("all");
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
  const filteredHistoryItems = filterCaseProcessHistoryItems(
    historyItems,
    historyFilter,
  );
  const historyFilters: Array<{
    id: CaseProcessHistoryFilter;
    label: string;
  }> = [
    { id: "all", label: labels.historyAll },
    { id: "document", label: labels.historyArtifacts },
    { id: "decision", label: labels.historyDecisions },
    { id: "communication", label: labels.historyCommunication },
  ];
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
          const canInspect =
            stage.state !== "not_started" &&
            Boolean(inspectorContent && content?.inspectorTargetId);
          const relatedLinks =
            stage.state === "not_started"
              ? []
              : (content?.relatedLinks ?? []).filter(
                  (link) => !link.href.startsWith("#"),
                );
          const canExpand =
            stage.state !== "not_started" &&
            Boolean(stagePanels[stage.id] || relatedLinks.length || canInspect);
          const isExpanded = canExpand && openStageId === stage.id;
          const stageHeader = (
            <>
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-current/20">
                <StateIcon state={stage.state} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[.68rem] font-bold tracking-wider uppercase">
                  <span>{stateLabel}</span>
                  {content?.timestamp && stage.state !== "not_started" ? (
                    <time className="text-muted-foreground normal-case">
                      {content.timestamp}
                    </time>
                  ) : null}
                  {relatedLinks.length ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-current/20 px-1.5 py-0.5 normal-case">
                      <FileText aria-hidden="true" className="size-3" />
                      {relatedLinks.length}
                      <span className="sr-only">{labels.historyArtifacts}</span>
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-[.95rem] leading-snug font-bold [overflow-wrap:anywhere] break-words sm:text-base">
                  {stageLabel}
                </span>
                {content?.statusText && stage.state !== "not_started" ? (
                  <span className="mt-1 line-clamp-2 block text-xs leading-snug [overflow-wrap:anywhere] break-words text-white/75 sm:text-sm">
                    {content.statusText}
                  </span>
                ) : null}
              </span>
              {canExpand ? (
                <span className="mt-3 flex shrink-0 items-center gap-2 text-xs font-bold">
                  <span
                    className="hidden sm:inline"
                    data-process-disclosure-label=""
                  >
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
              className={`rounded-xl border p-2.5 sm:p-3 ${stateStyles[stage.state]}`}
              data-process-stage={stage.id}
              data-process-state={stage.state}
            >
              {canExpand ? (
                <button
                  aria-controls={`case-process-panel-${stage.id}`}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? labels.closeStage : labels.openStage}: ${stageLabel}`}
                  className="focus-visible:outline-accent flex min-h-11 w-full items-start gap-2.5 rounded-lg p-1 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 sm:gap-3"
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

              {canExpand ? (
                <div
                  className="mt-2.5 border-t border-current/15 pt-3"
                  hidden={!isExpanded}
                  id={`case-process-panel-${stage.id}`}
                >
                  {stagePanels[stage.id]}
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
          <div
            aria-label={labels.historyFilters}
            className="flex gap-2 overflow-x-auto border-t border-white/10 px-3 py-3"
            role="group"
          >
            {historyFilters.map((filter) => (
              <button
                aria-pressed={historyFilter === filter.id}
                className={`focus-visible:outline-accent min-h-11 shrink-0 rounded-full border px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  historyFilter === filter.id
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-white/10 bg-white/[.025] text-white/70 hover:bg-white/5"
                }`}
                key={filter.id}
                onClick={() => setHistoryFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          {filteredHistoryItems.length ? (
            <ol className="relative ml-5 border-l border-white/10 p-3 pl-4 sm:ml-6 sm:p-4 sm:pl-5">
              {filteredHistoryItems.map((item) => (
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
                      <strong className="min-w-0 text-sm [overflow-wrap:anywhere]">
                        {item.title}
                      </strong>
                      {item.status ? (
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[.68rem] font-bold tracking-wider text-white/75 uppercase">
                          {item.status}
                        </span>
                      ) : null}
                      {item.artifactCount ? (
                        <span className="border-accent/25 bg-accent/8 text-accent inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[.68rem] font-bold">
                          <FileText aria-hidden="true" className="size-3" />
                          {item.artifactCount}
                          <span className="sr-only">
                            {labels.historyArtifacts}
                          </span>
                        </span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs [overflow-wrap:anywhere]">
                      {item.description}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground border-t border-white/10 p-4 text-sm">
              {labels.historyEmpty}
            </p>
          )}
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
