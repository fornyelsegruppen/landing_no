export const NORGE_I_BILDER_SCREENSHOT_SOURCE =
  "norge-i-bilder-screenshot" as const;
export const NORGE_I_BILDER_EXACT_ATTRIBUTION =
  "©norgeibilder.no" as const;

export type NorgeIBilderScreenshotEvidence = {
  attribution: string | null | undefined;
  capturedAt: string | null | undefined;
  source: string | null | undefined;
  trainingProhibited: boolean | null | undefined;
};

export function isNorgeIBilderScreenshotSource(value: unknown) {
  return value === NORGE_I_BILDER_SCREENSHOT_SOURCE;
}

export function assertNorgeIBilderScreenshotEvidence(
  input: NorgeIBilderScreenshotEvidence,
) {
  if (!isNorgeIBilderScreenshotSource(input.source)) {
    throw new Error(
      `Approved screenshot evidence requires source ${NORGE_I_BILDER_SCREENSHOT_SOURCE}`,
    );
  }
  if (input.attribution !== NORGE_I_BILDER_EXACT_ATTRIBUTION) {
    throw new Error(
      `Approved screenshot evidence requires attribution ${NORGE_I_BILDER_EXACT_ATTRIBUTION}`,
    );
  }
  if (input.trainingProhibited !== true) {
    throw new Error(
      "Approved screenshot evidence must prohibit AI/ML training usage",
    );
  }
  if (
    !input.capturedAt ||
    Number.isNaN(new Date(input.capturedAt).getTime())
  ) {
    throw new Error(
      "Approved screenshot evidence requires an exact capturedAt timestamp",
    );
  }
}
