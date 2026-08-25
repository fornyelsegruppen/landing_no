export function measurementPipelineUpdate(
  currentStatus: string,
  nextAction: string,
) {
  if (["converted", "closed"].includes(currentStatus)) return null;
  return { status: "measuring" as const, nextAction };
}

export function documentedPipelineUpdate() {
  return {
    status: "converted" as const,
    nextAction: "Oppdrag fullført og dokumentert.",
    nextActionAt: null,
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
      return { ...common, nextAction: "Tildel en ansatt til det signerte oppdraget.", nextActionAt: input.now };
    case "assigned":
      return { ...common, nextAction: "Planlegg dato og ankomstvindu for oppdraget.", nextActionAt: input.now };
    case "scheduled":
      return { ...common, nextAction: "Oppdraget er tildelt og planlagt.", nextActionAt: null };
    case "on_way":
    case "arrived":
    case "precheck":
    case "ready":
    case "in_progress":
      return { ...common, nextAction: "Oppdraget håndteres i ansattportalen.", nextActionAt: null };
    case "blocked":
      return { ...common, nextAction: "Kontroller blokkeringen og avklar neste steg før arbeidet fortsetter.", nextActionAt: input.now };
    case "completed":
      return { ...common, nextAction: "Sluttkontroller utført arbeid, pris og dokumentasjon.", nextActionAt: input.now };
    case "documented":
      return documentedPipelineUpdate();
    case "cancelled":
      return { ...common, nextAction: "Oppdraget er avbrutt. Kontroller dokumentasjon og videre kundeoppfølging.", nextActionAt: input.now };
    default:
      return null;
  }
}
