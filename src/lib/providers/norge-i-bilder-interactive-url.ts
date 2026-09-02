import { etrs89ToUtm33 } from "./kartverket-hoydedata-provider";
import type {
  NorgeIBilderCaptureRequest,
  NorgeIBilderEpsg25833Bounds,
  NorgeIBilderUrlBuilder,
} from "./norge-i-bilder-capture-provider";

const INTERACTIVE_ORIGIN = "https://norgeibilder.no/";
// A small roof-context extent. The vertical context is constant and the
// horizontal extent follows the final capture viewport's aspect ratio.
const HALF_HEIGHT_METERS = 27;

function roundedCoordinate(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

/**
 * Single source of truth for both the interactive deep-link and the raster
 * georeference returned with the final frame. This is not a WMS/WMTS extent.
 */
export function norgeIBilderInteractiveExtent(
  input: Pick<NorgeIBilderCaptureRequest, "target" | "viewport">,
): NorgeIBilderEpsg25833Bounds {
  const point = etrs89ToUtm33(input.target);
  const halfWidthMeters =
    HALF_HEIGHT_METERS * (input.viewport.width / input.viewport.height);
  return {
    minEastingM: roundedCoordinate(point.eastingM - halfWidthMeters),
    maxEastingM: roundedCoordinate(point.eastingM + halfWidthMeters),
    minNorthingM: roundedCoordinate(point.northingM - HALF_HEIGHT_METERS),
    maxNorthingM: roundedCoordinate(point.northingM + HALF_HEIGHT_METERS),
  };
}

/** Builds only the permitted first-party interactive Norge i bilder URL. */
export class NorgeIBilderInteractiveUrlBuilder implements NorgeIBilderUrlBuilder {
  build(input: Pick<NorgeIBilderCaptureRequest, "target" | "viewport">) {
    const bounds = norgeIBilderInteractiveExtent(input);
    const url = new URL(INTERACTIVE_ORIGIN);
    url.searchParams.set("wkid", "25833");
    url.searchParams.set("is3d", "false");
    url.searchParams.set("xmin", String(bounds.minEastingM));
    url.searchParams.set("xmax", String(bounds.maxEastingM));
    url.searchParams.set("ymin", String(bounds.minNorthingM));
    url.searchParams.set("ymax", String(bounds.maxNorthingM));
    return { url, bounds };
  }
}
