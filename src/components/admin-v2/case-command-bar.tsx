"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CaseWorkspaceTone } from "@/lib/admin-v2/case-workspace-view-model";

type CaseCommandBarProps = {
  action: string;
  amount: string;
  caseLabel: string;
  caseNumber: number;
  children: ReactNode;
  closeDetailsLabel: string;
  customer: string;
  effectiveLabel: string;
  effectiveReference: string;
  nextActionLabel: string;
  openDetailsLabel: string;
  status: string;
  tone?: CaseWorkspaceTone | "default" | "danger";
  workingLabel: string;
  workingReference: string;
};

type CaseCommandBarToneStyles = {
  actionCard: string;
  border: string;
  emphasis: string;
  mobileAction: string;
};

const toneStyles = {
  critical: {
    border: "border-danger/45",
    emphasis: "text-danger",
    actionCard:
      "border-danger/35 bg-danger/10 hover:border-danger/60 hover:bg-danger/15 focus-visible:outline-danger",
    mobileAction: "bg-danger text-white focus-visible:outline-danger",
  },
  warning: {
    border: "border-amber-400/45",
    emphasis: "text-amber-200",
    actionCard:
      "border-amber-400/35 bg-amber-400/10 hover:border-amber-300/60 hover:bg-amber-400/15 focus-visible:outline-amber-300",
    mobileAction: "bg-amber-300 text-amber-950 focus-visible:outline-amber-200",
  },
  action: {
    border: "border-accent/30",
    emphasis: "text-accent",
    actionCard:
      "border-accent/25 bg-accent/10 hover:border-accent/50 hover:bg-accent/15 focus-visible:outline-accent",
    mobileAction:
      "bg-accent text-accent-foreground focus-visible:outline-accent",
  },
  waiting: {
    border: "border-sky-400/35",
    emphasis: "text-sky-200",
    actionCard:
      "border-sky-400/30 bg-sky-400/10 hover:border-sky-300/55 hover:bg-sky-400/15 focus-visible:outline-sky-300",
    mobileAction: "bg-sky-300 text-sky-950 focus-visible:outline-sky-200",
  },
  success: {
    border: "border-success/45",
    emphasis: "text-success",
    actionCard:
      "border-success/35 bg-success/10 hover:border-success/60 hover:bg-success/15 focus-visible:outline-success",
    mobileAction: "bg-success text-black focus-visible:outline-success",
  },
  neutral: {
    border: "border-white/20",
    emphasis: "text-white/80",
    actionCard:
      "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10 focus-visible:outline-white",
    mobileAction: "bg-white/10 text-white focus-visible:outline-white",
  },
} as const satisfies Record<CaseWorkspaceTone, CaseCommandBarToneStyles>;

function normalizedTone(
  tone: NonNullable<CaseCommandBarProps["tone"]>,
): CaseWorkspaceTone {
  if (tone === "danger") return "critical";
  if (tone === "default") return "action";
  return tone;
}

export function CaseCommandBar({
  action,
  amount,
  caseLabel,
  caseNumber,
  children,
  closeDetailsLabel,
  customer,
  effectiveLabel,
  effectiveReference,
  nextActionLabel,
  openDetailsLabel,
  status,
  tone = "default",
  workingLabel,
  workingReference,
}: CaseCommandBarProps) {
  const styles = toneStyles[normalizedTone(tone)];
  const [panelOpen, setPanelOpen] = useState(false);
  const disclosureLabel = panelOpen ? closeDetailsLabel : openDetailsLabel;
  const positionClass = panelOpen
    ? "relative md:sticky md:top-16"
    : "sticky top-16";

  return (
    <aside
      aria-label={`${caseLabel} #${caseNumber}`}
      className={`${positionClass} z-20 rounded-2xl border bg-[#0d1118]/95 shadow-[0_14px_45px_rgba(0,0,0,.38)] backdrop-blur-xl ${styles.border}`}
      data-case-command-bar-state={panelOpen ? "open" : "closed"}
    >
      <div className="hidden min-h-16 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,.85fr)_minmax(0,1.25fr)] items-center gap-4 px-5 md:grid">
        <div className="min-w-0">
          <p className="text-accent text-[.68rem] font-bold tracking-[.15em] uppercase">
            {caseLabel} #{caseNumber}
          </p>
          <p className="truncate text-sm font-bold" title={customer}>
            {customer}
          </p>
        </div>
        <div className="min-w-0 border-l border-white/10 pl-4">
          <p className="text-muted-foreground text-[.68rem] font-bold tracking-wider uppercase">
            {workingLabel}
          </p>
          <p className="truncate text-sm font-bold">
            {workingReference} · {status}
          </p>
        </div>
        <div className="min-w-0 border-l border-white/10 pl-4">
          <p className="text-muted-foreground text-[.68rem] font-bold tracking-wider uppercase">
            {effectiveLabel}
          </p>
          <p className="truncate text-sm font-bold">{effectiveReference}</p>
          <p className="text-muted-foreground truncate text-xs">{amount}</p>
        </div>
        <button
          aria-controls="case-primary-action-panel"
          aria-expanded={panelOpen}
          aria-label={`${disclosureLabel}: ${action}`}
          className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 ${styles.actionCard}`}
          data-case-primary-shortcut="desktop"
          onClick={() => setPanelOpen((current) => !current)}
          type="button"
        >
          <span className="min-w-0 flex-1">
            <span
              className={`block text-[.68rem] font-bold tracking-wider uppercase ${styles.emphasis}`}
            >
              {nextActionLabel}
            </span>
            <span
              className={`block truncate text-sm font-bold group-hover:underline ${styles.emphasis}`}
            >
              {action}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-5 shrink-0 transition-transform ${panelOpen ? "rotate-180" : ""} ${styles.emphasis}`}
          />
        </button>
      </div>

      <button
        aria-controls="case-primary-action-panel"
        aria-expanded={panelOpen}
        aria-label={`${disclosureLabel}: ${action}`}
        className="focus-visible:outline-accent flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 md:hidden"
        data-case-primary-shortcut="mobile"
        onClick={() => setPanelOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[.65rem] font-bold tracking-[.14em] uppercase ${styles.emphasis}`}
          >
            {caseLabel} #{caseNumber} · {workingReference}
          </span>
          <span className="mt-1 block truncate text-sm font-bold">
            {action}
          </span>
          <span
            className={`mt-1 block text-xs font-bold ${styles.emphasis}`}
            data-case-primary-disclosure-label=""
          >
            {disclosureLabel}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-5 shrink-0 transition-transform ${panelOpen ? "rotate-180" : ""} ${styles.emphasis}`}
        />
      </button>

      <div
        aria-label={nextActionLabel}
        className="border-t border-white/10 p-3 md:max-h-[calc(100dvh-8rem)] md:overflow-y-auto md:overscroll-contain md:p-4"
        hidden={!panelOpen}
        id="case-primary-action-panel"
        role="region"
      >
        <div
          className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/15 p-3 text-xs md:hidden"
          data-case-mobile-metadata=""
        >
          <div className="min-w-0">
            <p className="text-muted-foreground">{customer}</p>
            <p className="mt-1 font-semibold break-words">
              {workingLabel}: {workingReference}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">{status}</p>
            <p className="mt-1 font-semibold break-words">
              {effectiveLabel}: {effectiveReference}
            </p>
            <p className="text-muted-foreground mt-1 break-words">{amount}</p>
          </div>
        </div>
        {children}
        <button
          aria-controls="case-primary-action-panel"
          aria-expanded="true"
          className={`mt-4 min-h-12 w-full rounded-xl px-4 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 md:hidden ${styles.mobileAction}`}
          data-case-primary-close="mobile"
          onClick={() => setPanelOpen(false)}
          type="button"
        >
          {closeDetailsLabel}
        </button>
      </div>
    </aside>
  );
}
