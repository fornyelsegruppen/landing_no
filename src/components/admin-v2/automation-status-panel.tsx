export type AutomationStatus =
  | { kind: "unavailable" }
  | { kind: "configured" }
  | { kind: "verified"; nextRunAt: string; timeZone: string }
  | { kind: "paused"; reason?: string };

export function AutomationStatusPanel({ status }: { status: AutomationStatus }) {
  if (status.kind === "unavailable")
    return <p className="text-muted-foreground text-sm">Automation status is unavailable.</p>;
  if (status.kind === "configured")
    return <p className="text-muted-foreground text-sm">Automation is configured, but its execution is not verified.</p>;
  if (status.kind === "paused")
    return <p className="text-muted-foreground text-sm">Automation is paused{status.reason ? `: ${status.reason}` : "."}</p>;
  return <p className="text-muted-foreground text-sm">Verified next run: {status.nextRunAt} ({status.timeZone}). Human approval remains required.</p>;
}
