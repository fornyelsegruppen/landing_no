export function measurementPipelineUpdate(
  currentStatus: string,
  nextAction: string,
) {
  if (["converted", "closed"].includes(currentStatus)) return null;
  return { status: "measuring" as const, nextAction, nextActionOwner: "administrator" as const };
}

export function documentedPipelineUpdate(now = new Date().toISOString()) {
  return {
    status: "converted" as const,
    nextAction: "Kontroller dokumentene og arkiver den fullførte kundesaken.",
    nextActionAt: now,
    nextActionOwner: "administrator" as const,
  };
}

export function workOrderPipelineUpdate(input: {
  now: string;
  scheduledAt?: string | null;
  status: string;
}) {
  const common = { status: "converted" as const };
  switch (input.status) {
    case "unassigned":
      return { ...common, nextAction: "Tildel en ansatt til det signerte oppdraget.", nextActionAt: input.now, nextActionOwner: "administrator" as const };
    case "assigned":
      return { ...common, nextAction: "Planlegg dato og ankomstvindu for oppdraget.", nextActionAt: input.now, nextActionOwner: "administrator" as const };
    case "scheduled":
      return { ...common, nextAction: "Følg opp planlagte påminnelser og oppdragets start.", nextActionAt: input.scheduledAt || input.now, nextActionOwner: "system" as const };
    case "on_way":
    case "arrived":
    case "precheck":
    case "ready":
    case "in_progress":
      return { ...common, nextAction: "Oppdraget håndteres i ansattportalen.", nextActionAt: input.now, nextActionOwner: "worker" as const };
    case "blocked":
      return { ...common, nextAction: "Kontroller blokkeringen og avklar neste steg før arbeidet fortsetter.", nextActionAt: input.now, nextActionOwner: "administrator" as const, nextActionBlocker: "WORK_BLOCKED" };
    case "completed":
      return { ...common, nextAction: "Sluttkontroller utført arbeid, pris og dokumentasjon.", nextActionAt: input.now, nextActionOwner: "administrator" as const };
    case "documented":
      return documentedPipelineUpdate(input.now);
    case "cancelled":
      return { ...common, nextAction: "Oppdraget er avbrutt. Kontroller dokumentasjon og videre kundeoppfølging.", nextActionAt: input.now, nextActionOwner: "administrator" as const, nextActionBlocker: "WORK_CANCELLED" };
    default:
      return null;
  }
}
