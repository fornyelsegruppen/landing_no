"use client";

import { useEffect, useState, type ReactNode } from "react";

const sectionIds = [
  "case-summary",
  "case-customer-record",
  "case-evidence",
  "case-history",
] as const;
type SectionId = (typeof sectionIds)[number];

function sectionFromHash(hash: string): SectionId {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  return sectionIds.includes(value as SectionId)
    ? (value as SectionId)
    : "case-summary";
}

export function AdminNextCaseWorkspaceContextNav({
  labels,
  navigationLabel,
}: {
  labels: Readonly<Record<SectionId, string>>;
  navigationLabel: string;
}) {
  const [activeSection, setActiveSection] = useState<SectionId>("case-summary");

  useEffect(() => {
    const syncHash = () =>
      setActiveSection(sectionFromHash(window.location.hash));
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <nav
      aria-label={navigationLabel}
      className="an-surface grid grid-cols-2 gap-1 rounded-2xl border p-1.5 sm:flex sm:w-fit"
      data-case-context-nav
    >
      {sectionIds.map((sectionId) => (
        <a
          aria-current={activeSection === sectionId ? "location" : undefined}
          className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl px-2 text-center text-xs font-bold text-[var(--an-text-muted)] hover:bg-[var(--an-soft)] hover:text-[var(--an-amber)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)] aria-[current=location]:bg-[var(--an-amber-soft)] aria-[current=location]:text-[var(--an-amber)] sm:px-4 sm:text-sm"
          data-case-context-link={sectionId}
          href={`#${sectionId}`}
          key={sectionId}
          onClick={() => {
            setActiveSection(sectionId);
            window.requestAnimationFrame(() => {
              document
                .getElementById(sectionId)
                ?.focus({ preventScroll: true });
            });
          }}
        >
          {labels[sectionId]}
        </a>
      ))}
    </nav>
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
