import type { GeoPoint } from "@/lib/measurements/types";

export type GeoReference = {
  crs: "EPSG:25833";
  bounds: {
    minEastingM: number;
    minNorthingM: number;
    maxEastingM: number;
    maxNorthingM: number;
  };
  imageWidth: number;
  imageHeight: number;
};

/** Projects WGS84 points into ETRS89 / UTM zone 33N (EPSG:25833). */
export function projectWgs84ToOrthoPixels(
  points: GeoPoint[],
  ref: GeoReference,
) {
  if (
    points.length < 3 ||
    !Number.isFinite(ref.imageWidth) ||
    !Number.isFinite(ref.imageHeight) ||
    ref.imageWidth <= 0 ||
    ref.imageHeight <= 0 ||
    ref.bounds.maxEastingM <= ref.bounds.minEastingM ||
    ref.bounds.maxNorthingM <= ref.bounds.minNorthingM
  ) {
    return null;
  }
  const a = 6378137;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const toUtm = (p: GeoPoint) => {
    const lat = (p.latitude * Math.PI) / 180;
    const lon = (p.longitude * Math.PI) / 180;
    const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    const t = Math.tan(lat) ** 2;
    const c = ep2 * Math.cos(lat) ** 2;
    const aa = Math.cos(lat) * (lon - (15 * Math.PI) / 180);
    const m =
      a *
      ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lat -
        ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) *
          Math.sin(2 * lat) +
        ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lat) -
        ((35 * e2 ** 3) / 3072) * Math.sin(6 * lat));
    return {
      x:
        500000 +
        k0 *
          n *
          (aa +
            ((1 - t + c) * aa ** 3) / 6 +
            ((5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * aa ** 5) / 120),
      y:
        k0 *
        (m +
          n *
            Math.tan(lat) *
            (aa ** 2 / 2 +
              ((5 - t + 9 * c + 4 * c ** 2) * aa ** 4) / 24 +
              ((61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * aa ** 6) / 720)),
    };
  };
  const projected = points.map(toUtm);
  const b = ref.bounds;
  const result = projected.map((u) => {
    const x =
      ((u.x - b.minEastingM) / (b.maxEastingM - b.minEastingM)) *
      ref.imageWidth;
    const y =
      ((b.maxNorthingM - u.y) / (b.maxNorthingM - b.minNorthingM)) *
      ref.imageHeight;
    return { x, y };
  });
  if (
    result.some(
      (p) =>
        p.x < 0 || p.x > ref.imageWidth || p.y < 0 || p.y > ref.imageHeight,
    )
  )
    return null;
  return result.map((p) => `${p.x},${p.y}`).join(" ");
}
