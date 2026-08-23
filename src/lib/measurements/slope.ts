export function slopeFactor(angleDegrees: number): number {
  if (!Number.isFinite(angleDegrees) || angleDegrees < 0 || angleDegrees > 60) {
    throw new TypeError("Roof angle must be between 0 and 60 degrees");
  }
  return 1 / Math.cos((angleDegrees * Math.PI) / 180);
}

export function displayedSlopeFactor(angleDegrees: number): number {
  return Math.round(slopeFactor(angleDegrees) * 1_000) / 1_000;
}
