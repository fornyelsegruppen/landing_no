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
