import type { CaseWorkspaceTone } from "@/lib/admin-v2/case-workspace-view-model";

export type CaseStatusStampProps = {
  dateTime?: string;
  label: string;
  timestamp?: string;
  tone?: CaseWorkspaceTone | "accent" | "danger";
};

const toneClasses: Record<NonNullable<CaseStatusStampProps["tone"]>, string> = {
  accent: "border-accent/25 bg-accent/10 text-accent",
  action: "border-accent/25 bg-accent/10 text-accent",
  critical: "border-danger/45 bg-danger/15 text-danger",
  danger: "border-danger/45 bg-danger/15 text-danger",
  neutral: "border-white/20 bg-white/5 text-white/75",
  success: "border-success/45 bg-success/15 text-success",
  waiting: "border-white/25 bg-white/10 text-white/85",
  warning: "border-warning/45 bg-warning/15 text-warning",
};

/**
 * Compact lifecycle status with its exact transition time when one exists.
 * References and versions intentionally continue to use their own pills.
 */
export function CaseStatusStamp({
  dateTime,
  label,
  timestamp,
  tone = "accent",
}: CaseStatusStampProps) {
  return (
    <span
      className={`inline-flex max-w-full min-w-0 flex-col items-start rounded-2xl border px-3 py-1.5 ${toneClasses[tone]}`}
    >
      <span className="max-w-full text-xs leading-tight font-bold tracking-wider [overflow-wrap:anywhere] uppercase">
        {label}
      </span>
      {timestamp ? (
        <time
          className="mt-1 text-[.68rem] leading-none font-semibold tracking-normal whitespace-nowrap text-white/85 normal-case"
          dateTime={dateTime}
        >
          {timestamp}
        </time>
      ) : null}
    </span>
  );
}
