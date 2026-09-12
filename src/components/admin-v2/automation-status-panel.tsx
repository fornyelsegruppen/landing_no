export type AutomationStatus =
  | { kind: "unavailable" }
  | { kind: "configured" }
  | { kind: "verified"; nextRunAt: string; timeZone: string }
  | { kind: "paused"; reason?: string };

export function AutomationStatusPanel({ status, locale = "en" }: { status: AutomationStatus; locale?: "no" | "en" | "lt" }) {
  const copy = locale === "lt"
    ? { unavailable: "Automatizavimo būsena nepasiekiama.", configured: "Automatizavimas sukonfigūruotas, bet vykdymas nepatvirtintas.", paused: "Automatizavimas sustabdytas", verified: "Patvirtintas kitas vykdymas", approval: "Žmogaus patvirtinimas vis dar būtinas." }
    : locale === "no"
      ? { unavailable: "Automatiseringsstatus er ikke tilgjengelig.", configured: "Automatiseringen er konfigurert, men kjøringen er ikke verifisert.", paused: "Automatiseringen er satt på pause", verified: "Verifisert neste kjøring", approval: "Menneskelig godkjenning er fortsatt påkrevd." }
      : { unavailable: "Automation status is unavailable.", configured: "Automation is configured, but its execution is not verified.", paused: "Automation is paused", verified: "Verified next run", approval: "Human approval remains required." };
  if (status.kind === "unavailable")
    return <p className="text-muted-foreground text-sm">{copy.unavailable}</p>;
  if (status.kind === "configured")
    return <p className="text-muted-foreground text-sm">{copy.configured}</p>;
  if (status.kind === "paused")
    return <p className="text-muted-foreground text-sm">{copy.paused}{status.reason ? `: ${status.reason}` : "."}</p>;
  return <p className="text-muted-foreground text-sm">{copy.verified}: {status.nextRunAt} ({status.timeZone}). {copy.approval}</p>;
}
