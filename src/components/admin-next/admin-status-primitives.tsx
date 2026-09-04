import { AlertTriangle, CheckCircle2, CircleDot, Clock3, CloudOff, UserRound } from "lucide-react";

export type AdminStatusKind = "active" | "blocked" | "draft" | "resolved" | "superseded" | "waiting";
export type AdminSyncKind = "offline" | "pending" | "synced";

const statusContract: Record<AdminStatusKind, { label: string; className: string; icon: typeof CircleDot }> = {
  active: { label: "Aktyvi", className: "border-[var(--an-info)] bg-[var(--an-info-soft)] text-[var(--an-info)]", icon: CircleDot },
  blocked: { label: "Užblokuota", className: "border-[var(--an-danger)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]", icon: AlertTriangle },
  draft: { label: "Juodraštis", className: "border-[var(--an-border-strong)] bg-[var(--an-surface-soft)] text-[var(--an-text-muted)]", icon: CircleDot },
  resolved: { label: "Išspręsta", className: "border-[var(--an-success)] bg-[var(--an-success-soft)] text-[var(--an-success)]", icon: CheckCircle2 },
  superseded: { label: "Ankstesnė versija", className: "border-[var(--an-border)] bg-[var(--an-surface-soft)] text-[var(--an-text-subtle)]", icon: Clock3 },
  waiting: { label: "Laukia", className: "border-[var(--an-info)] bg-[var(--an-info-soft)] text-[var(--an-info)]", icon: Clock3 },
};

export function StatusBadge({ kind, label }: { kind: AdminStatusKind; label?: string }) {
  const item = statusContract[kind];
  const Icon = item.icon;
  return <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${item.className}`}><Icon aria-hidden="true" className="size-3.5" />{label || item.label}</span>;
}

export function OwnerChip({ name, unassigned = false }: { name?: string | null; unassigned?: boolean }) {
  return <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${unassigned || !name ? "border-[var(--an-danger)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]" : "border-[var(--an-border)] bg-[var(--an-surface-soft)] text-[var(--an-text-muted)]"}`}><UserRound aria-hidden="true" className="size-3.5" />{name || "Be atsakingo"}</span>;
}

export function DueIndicator({ label, overdue = false }: { label: string; overdue?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${overdue ? "text-[var(--an-danger)]" : "text-[var(--an-text-muted)]"}`}><Clock3 aria-hidden="true" className="size-3.5" />{overdue ? `Vėluoja · ${label}` : label}</span>;
}

export function BlockerSummary({ children, recovery }: { children: React.ReactNode; recovery?: React.ReactNode }) {
  return <section className="rounded-xl border border-[var(--an-danger)] bg-[var(--an-danger-soft)] p-3 text-sm" aria-label="Blokatorius"><div className="flex items-start gap-2 text-[var(--an-danger)]"><AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" /><strong>{children}</strong></div>{recovery ? <div className="mt-3 pl-7 text-[var(--an-text-primary)]">{recovery}</div> : null}</section>;
}

export function VersionBadge({ current = true, version }: { current?: boolean; version: string }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-bold ${current ? "border-[var(--an-success)] bg-[var(--an-success-soft)] text-[var(--an-success)]" : "border-[var(--an-border)] bg-[var(--an-surface-soft)] text-[var(--an-text-subtle)]"}`}>{version} · {current ? "dabartinė" : "ankstesnė"}</span>;
}

export function SyncState({ kind }: { kind: AdminSyncKind }) {
  const copy = kind === "synced" ? "Sinchronizuota" : kind === "pending" ? "Laukia ryšio" : "Nėra ryšio";
  return <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${kind === "synced" ? "text-[var(--an-success)]" : "text-[var(--an-info)]"}`}><CloudOff aria-hidden="true" className="size-3.5" />{copy}</span>;
}
