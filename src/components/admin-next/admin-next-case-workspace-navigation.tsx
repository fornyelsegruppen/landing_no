"use client";

import {
  Children,
  useEffect,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

const panelIds = [
  "case-customer-record",
  "case-evidence",
  "case-history",
] as const;
type PanelId = (typeof panelIds)[number];

const panelByAnchor: Readonly<Record<string, PanelId>> = {
  "case-commercial-versions-title": "case-customer-record",
  "case-communications-history": "case-customer-record",
  "case-customer-record-title": "case-customer-record",
  "case-document-register-title": "case-customer-record",
  "case-evidence-title": "case-evidence",
  "case-outstanding-questions": "case-customer-record",
  "case-recent-communications": "case-customer-record",
  "case-timeline-title": "case-history",
};

const panelByTab: Readonly<Record<string, PanelId>> = {
  customer: "case-customer-record",
  evidence: "case-evidence",
  history: "case-history",
};

function panelFromLocation({
  hash,
  search,
}: Pick<Location, "hash" | "search">) {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  if (panelIds.includes(value as PanelId)) return value as PanelId;
  if (panelByAnchor[value]) return panelByAnchor[value];
  const tab = new URLSearchParams(search).get("tab");
  return (tab && panelByTab[tab]) || "case-customer-record";
}

export function AdminNextCaseWorkspacePanelSwitcher({
  children,
  labels,
  navigationLabel,
}: {
  children: ReactNode;
  labels: Readonly<Record<PanelId, string>>;
  navigationLabel: string;
}) {
  const panels = Children.toArray(children);
  const [activePanel, setActivePanel] = useState<PanelId>(
    "case-customer-record",
  );

  useEffect(() => {
    const syncLocation = () =>
      setActivePanel(panelFromLocation(window.location));
    syncLocation();
    window.addEventListener("hashchange", syncLocation);
    window.addEventListener("popstate", syncLocation);
    return () => {
      window.removeEventListener("hashchange", syncLocation);
      window.removeEventListener("popstate", syncLocation);
    };
  }, []);

  useEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (!anchor || panelFromLocation(window.location) !== activePanel) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView?.({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePanel]);

  function activate(panelId: PanelId) {
    setActivePanel(panelId);
    if (window.location.hash !== `#${panelId}`) {
      window.history.pushState(null, "", `#${panelId}`);
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % panelIds.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + panelIds.length) % panelIds.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = panelIds.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const panelId = panelIds[nextIndex];
    activate(panelId);
    document.getElementById(`case-workspace-tab-${panelId}`)?.focus();
  }

  return (
    <section className="space-y-4" data-case-panel-switcher>
      <div
        className="sticky top-16 z-20 -mx-1 bg-[var(--an-canvas)] px-1 py-2"
        data-case-sticky-navigation
      >
        <div
          aria-label={navigationLabel}
          className="an-surface grid grid-cols-3 gap-1 rounded-2xl border p-1.5 shadow-xl shadow-black/20 sm:w-fit"
          role="tablist"
        >
          {panelIds.map((panelId, index) => (
            <button
              aria-controls={`case-workspace-panel-${panelId}`}
              aria-selected={activePanel === panelId}
              className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl px-2 text-center text-xs font-bold text-[var(--an-text-muted)] hover:bg-[var(--an-soft)] hover:text-[var(--an-amber)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)] aria-selected:bg-[var(--an-amber-soft)] aria-selected:text-[var(--an-amber)] sm:px-4 sm:text-sm"
              data-case-context-link={panelId}
              id={`case-workspace-tab-${panelId}`}
              key={panelId}
              onClick={() => activate(panelId)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              role="tab"
              tabIndex={activePanel === panelId ? 0 : -1}
              type="button"
            >
              {labels[panelId]}
            </button>
          ))}
        </div>
      </div>
      {panelIds.map((panelId, index) => (
        <div
          aria-labelledby={`case-workspace-tab-${panelId}`}
          data-case-panel={panelId}
          hidden={activePanel !== panelId}
          id={`case-workspace-panel-${panelId}`}
          key={panelId}
          role="tabpanel"
          tabIndex={0}
        >
          {panels[index] || null}
        </div>
      ))}
    </section>
  );
}

export function AdminNextCaseWorkspaceHistoryRail({
  children,
  controlsId,
  state,
  stateLabel,
  toggleLabel,
}: {
  children: ReactNode;
  controlsId: string;
  state: "denied" | "empty" | "ready" | "unavailable";
  stateLabel: string;
  toggleLabel: string;
}) {
  const [open, setOpen] = useState(true);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const syncViewport = () => setWide(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  return (
    <details
      className="group"
      data-case-history-rail
      onToggle={(event) => {
        if (wide && !event.currentTarget.open) {
          setOpen(true);
          return;
        }
        setOpen(event.currentTarget.open);
      }}
      open={wide || open}
    >
      <summary
        aria-controls={controlsId}
        className="mb-5 flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] px-4 py-3 text-sm font-bold text-[var(--an-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)] xl:hidden"
        data-case-history-state-summary={state}
      >
        <span>{toggleLabel}</span>
        <span className="text-xs text-[var(--an-amber)]">{stateLabel}</span>
      </summary>
      <div data-case-history-content id={controlsId}>
        {children}
      </div>
    </details>
  );
}
