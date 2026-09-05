import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  CloudCheck,
  CloudOff,
  UserRound,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";

export type AdminStatusKind =
  | "active"
  | "attention"
  | "blocked"
  | "draft"
  | "resolved"
  | "superseded"
  | "waiting";
export type AdminSyncKind = "offline" | "pending" | "synced";

const statusContract: Record<
  AdminStatusKind,
  { className: string; icon: typeof CircleDot }
> = {
  active: {
    className:
      "border-[var(--an-info)] bg-[var(--an-info-soft)] text-[var(--an-info)]",
    icon: CircleDot,
  },
  attention: {
    className:
      "border-[var(--an-amber)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]",
    icon: AlertTriangle,
  },
  blocked: {
    className:
      "border-[var(--an-danger)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]",
    icon: AlertTriangle,
  },
  draft: {
    className:
      "border-[var(--an-border-strong)] bg-[var(--an-surface-soft)] text-[var(--an-text-muted)]",
    icon: CircleDot,
  },
  resolved: {
    className:
      "border-[var(--an-success)] bg-[var(--an-success-soft)] text-[var(--an-success)]",
    icon: CheckCircle2,
  },
  superseded: {
    className:
      "border-[var(--an-border)] bg-[var(--an-surface-soft)] text-[var(--an-text-subtle)]",
    icon: Clock3,
  },
  waiting: {
    className:
      "border-[var(--an-info)] bg-[var(--an-info-soft)] text-[var(--an-info)]",
    icon: Clock3,
  },
};

const semanticCopy: Record<
  PanelLocale,
  {
    blocker: string;
    current: string;
    noOwner: string;
    offline: string;
    overdue: string;
    pending: string;
    previous: string;
    statuses: Record<AdminStatusKind, string>;
    synced: string;
  }
> = {
  nb: {
    blocker: "Blokkering",
    current: "gjeldende",
    noOwner: "Ikke tildelt",
    offline: "Frakoblet",
    overdue: "Forsinket",
    pending: "Venter på nettverk",
    previous: "tidligere",
    statuses: {
      active: "Aktiv",
      attention: "Krever oppmerksomhet",
      blocked: "Blokkert",
      draft: "Utkast",
      resolved: "Løst",
      superseded: "Tidligere versjon",
      waiting: "Venter",
    },
    synced: "Synkronisert",
  },
  lt: {
    blocker: "Blokatorius",
    current: "dabartinė",
    noOwner: "Be atsakingo",
    offline: "Nėra ryšio",
    overdue: "Vėluoja",
    pending: "Laukia ryšio",
    previous: "ankstesnė",
    statuses: {
      active: "Aktyvi",
      attention: "Reikia dėmesio",
      blocked: "Užblokuota",
      draft: "Juodraštis",
      resolved: "Išspręsta",
      superseded: "Ankstesnė versija",
      waiting: "Laukia",
    },
    synced: "Sinchronizuota",
  },
  en: {
    blocker: "Blocker",
    current: "current",
    noOwner: "Unassigned",
    offline: "Offline",
    overdue: "Overdue",
    pending: "Waiting for a connection",
    previous: "previous",
    statuses: {
      active: "Active",
      attention: "Needs attention",
      blocked: "Blocked",
      draft: "Draft",
      resolved: "Resolved",
      superseded: "Previous version",
      waiting: "Waiting",
    },
    synced: "Synced",
  },
};

export function StatusBadge({
  kind,
  label,
  locale = "lt",
}: {
  kind: AdminStatusKind;
  label?: string;
  locale?: PanelLocale;
}) {
  const item = statusContract[kind];
  const Icon = item.icon;
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${item.className}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label || semanticCopy[locale].statuses[kind]}
    </span>
  );
}

export function OwnerChip({
  locale = "lt",
  name,
  unassigned = false,
}: {
  locale?: PanelLocale;
  name?: string | null;
  unassigned?: boolean;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${unassigned || !name ? "border-[var(--an-danger)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]" : "border-[var(--an-border)] bg-[var(--an-surface-soft)] text-[var(--an-text-muted)]"}`}
    >
      <UserRound aria-hidden="true" className="size-3.5" />
      {name || semanticCopy[locale].noOwner}
    </span>
  );
}

export function DueIndicator({
  label,
  locale = "lt",
  overdue = false,
  state,
}: {
  label: string;
  locale?: PanelLocale;
  overdue?: boolean;
  state?: "due_soon" | "on_track" | "overdue";
}) {
  const resolvedState = state || (overdue ? "overdue" : "on_track");
  const className =
    resolvedState === "overdue"
      ? "text-[var(--an-danger)]"
      : resolvedState === "due_soon"
        ? "text-[var(--an-info)]"
        : "text-[var(--an-text-muted)]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}
    >
      <Clock3 aria-hidden="true" className="size-3.5" />
      {resolvedState === "overdue"
        ? `${semanticCopy[locale].overdue} · ${label}`
        : label}
    </span>
  );
}

export function BlockerSummary({
  children,
  locale = "lt",
  recovery,
}: {
  children: React.ReactNode;
  locale?: PanelLocale;
  recovery?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl border border-[var(--an-danger)] bg-[var(--an-danger-soft)] p-3 text-sm"
      aria-label={semanticCopy[locale].blocker}
    >
      <div className="flex items-start gap-2 text-[var(--an-danger)]">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <strong>{children}</strong>
      </div>
      {recovery ? (
        <div className="mt-3 pl-7 text-[var(--an-text-primary)]">
          {recovery}
        </div>
      ) : null}
    </section>
  );
}

export function VersionBadge({
  current = true,
  locale = "lt",
  version,
}: {
  current?: boolean;
  locale?: PanelLocale;
  version: string;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-bold ${current ? "border-[var(--an-success)] bg-[var(--an-success-soft)] text-[var(--an-success)]" : "border-[var(--an-border)] bg-[var(--an-surface-soft)] text-[var(--an-text-subtle)]"}`}
    >
      {version} ·{" "}
      {current ? semanticCopy[locale].current : semanticCopy[locale].previous}
    </span>
  );
}

export function SyncState({
  kind,
  locale = "lt",
}: {
  kind: AdminSyncKind;
  locale?: PanelLocale;
}) {
  const copy =
    kind === "synced"
      ? semanticCopy[locale].synced
      : kind === "pending"
        ? semanticCopy[locale].pending
        : semanticCopy[locale].offline;
  const Icon = kind === "synced" ? CloudCheck : CloudOff;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold ${kind === "synced" ? "text-[var(--an-success)]" : "text-[var(--an-info)]"}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {copy}
    </span>
  );
}
