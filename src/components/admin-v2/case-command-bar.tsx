import { ChevronDown } from "lucide-react";
import type { CaseWorkspaceTone } from "@/lib/admin-v2/case-workspace-view-model";

type CaseCommandBarProps = {
  action: string;
  amount: string;
  caseLabel: string;
  caseNumber: number;
  customer: string;
  effectiveLabel: string;
  effectiveReference: string;
  nextActionLabel: string;
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
  customer,
  effectiveLabel,
  effectiveReference,
  nextActionLabel,
  status,
  tone = "default",
  workingLabel,
  workingReference,
}: CaseCommandBarProps) {
  const styles = toneStyles[normalizedTone(tone)];

  return (
    <aside
      aria-label={`${caseLabel} #${caseNumber}`}
      className={`sticky top-16 z-20 rounded-2xl border bg-[#0d1118]/95 shadow-[0_14px_45px_rgba(0,0,0,.38)] backdrop-blur-xl ${styles.border}`}
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
        <a
          className={`group min-w-0 rounded-xl border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 ${styles.actionCard}`}
          data-case-primary-shortcut="desktop"
          href="#next-action-title"
        >
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
        </a>
      </div>

      <details className="group md:hidden">
        <summary className="focus-visible:outline-accent flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2">
          <span className="min-w-0 flex-1">
            <span
              className={`block text-[.65rem] font-bold tracking-[.14em] uppercase ${styles.emphasis}`}
            >
              {caseLabel} #{caseNumber} · {workingReference}
            </span>
            <span className="block truncate text-sm font-bold">
              {status} · {action}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-5 shrink-0 transition-transform group-open:rotate-180 ${styles.emphasis}`}
          />
        </summary>
        <div className="grid gap-3 border-t border-white/10 px-4 py-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">{customer}</p>
            <p className="mt-1 font-semibold">
              {workingLabel}: {workingReference}
            </p>
            <p className="text-muted-foreground mt-1">
              {effectiveLabel}: {effectiveReference} · {amount}
            </p>
          </div>
          <a
            className={`rounded-xl px-3 py-2.5 text-center font-bold focus-visible:outline-2 focus-visible:outline-offset-2 ${styles.mobileAction}`}
            data-case-primary-shortcut="mobile"
            href="#next-action-title"
          >
            {action}
          </a>
        </div>
      </details>
    </aside>
  );
}
