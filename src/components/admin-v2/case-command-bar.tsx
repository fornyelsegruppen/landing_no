import { ChevronDown } from "lucide-react";

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
  workingLabel: string;
  workingReference: string;
};

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
  workingLabel,
  workingReference,
}: CaseCommandBarProps) {
  return (
    <aside
      aria-label={`${caseLabel} #${caseNumber}`}
      className="sticky top-16 z-20 rounded-2xl border border-accent/30 bg-[#0d1118]/95 shadow-[0_14px_45px_rgba(0,0,0,.38)] backdrop-blur-xl"
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
          className="group min-w-0 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 hover:border-accent/50 hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="#next-action-title"
        >
          <span className="text-accent block text-[.68rem] font-bold tracking-wider uppercase">
            {nextActionLabel}
          </span>
          <span className="block truncate text-sm font-bold group-hover:text-accent">
            {action}
          </span>
        </a>
      </div>

      <details className="group md:hidden">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <span className="min-w-0 flex-1">
            <span className="text-accent block text-[.65rem] font-bold tracking-[.14em] uppercase">
              {caseLabel} #{caseNumber} · {workingReference}
            </span>
            <span className="block truncate text-sm font-bold">
              {status} · {action}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="text-accent size-5 shrink-0 transition-transform group-open:rotate-180"
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
            className="rounded-xl bg-accent px-3 py-2.5 text-center font-bold text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="#next-action-title"
          >
            {action}
          </a>
        </div>
      </details>
    </aside>
  );
}
