import { createHash } from "node:crypto";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import type { GeoPoint } from "./types";

type EvidenceCandidate = Pick<
  BuildingFootprintCandidate,
  | "id"
  | "label"
  | "polygon"
  | "addressHouseNumber"
  | "addressStreet"
  | "buildingName"
>;

export type SchematicEvidenceInput = {
  address: string;
  addressPoint: GeoPoint;
  candidates: EvidenceCandidate[];
  generatedAt: string;
  selectedBuildingId?: string | null;
  source: string;
  attribution: string;
};

export type MeasurementEvidence = {
  bytes: Buffer;
  filename: string;
  hash: string;
  mimeType: "image/svg+xml";
  snapshot: SchematicEvidenceInput & { schemaVersion: 2 };
};

export interface MapEvidenceProvider {
  render(input: SchematicEvidenceInput): Promise<MeasurementEvidence>;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function centroid(points: GeoPoint[]) {
  return {
    latitude:
      points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude:
      points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
  };
}

function addressContext(address: string) {
  const streetAddress = address.split(",")[0]?.trim() || address.trim();
  const match = streetAddress.match(
    /^(.*?)[\s,]+(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)$/u,
  );
  return {
    streetAddress,
    streetName: match?.[1]?.trim() || streetAddress,
    houseNumber: match?.[2]?.trim(),
  };
}

function projector(
  points: GeoPoint[],
  width: number,
  height: number,
  padding = 34,
) {
  const origin = centroid(points);
  const longitudeMeters =
    111_320 * Math.max(Math.cos((origin.latitude * Math.PI) / 180), 0.1);
  const local = (point: GeoPoint) => ({
    x: (point.longitude - origin.longitude) * longitudeMeters,
    y: (point.latitude - origin.latitude) * 111_320,
  });
  const projected = points.map(local);
  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  const spanX = Math.max(maxX - minX, 12);
  const spanY = Math.max(maxY - minY, 12);
  const pixelsPerMeter = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY,
  );
  const usedWidth = spanX * pixelsPerMeter;
  const usedHeight = spanY * pixelsPerMeter;
  const offsetX = (width - usedWidth) / 2;
  const offsetY = (height - usedHeight) / 2;
  return {
    map: (point: GeoPoint) => {
      const value = local(point);
      return {
        x: offsetX + (value.x - minX) * pixelsPerMeter,
        y: height - offsetY - (value.y - minY) * pixelsPerMeter,
      };
    },
    pixelsPerMeter,
  };
}

function niceScaleMeters(pixelsPerMeter: number, maximumPixels = 120) {
  const candidates = [100, 50, 25, 20, 10, 5, 2, 1];
  return (
    candidates.find((value) => value * pixelsPerMeter <= maximumPixels) || 1
  );
}

function polygonPoints(
  candidate: EvidenceCandidate,
  map: (point: GeoPoint) => { x: number; y: number },
) {
  return candidate.polygon
    .map(map)
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
}

function buildingMarker(
  candidate: EvidenceCandidate,
  index: number,
  selected: boolean,
  targetHouseNumber?: string,
) {
  return selected
    ? targetHouseNumber || candidate.addressHouseNumber || String(index + 1)
    : candidate.addressHouseNumber || String(index + 1);
}

function northArrow(x: number, y: number) {
  return `<g transform="translate(${x} ${y})" font-family="Arial,sans-serif" fill="#ffffff"><path d="M0 34 L14 0 L28 34 L14 26 Z" fill="#ffffff"/><text x="14" y="54" text-anchor="middle" font-size="14">N</text></g>`;
}

export class SchematicRoofEvidenceProvider implements MapEvidenceProvider {
  async render(input: SchematicEvidenceInput): Promise<MeasurementEvidence> {
    if (!input.candidates.length)
      throw new TypeError(
        "Schematic evidence requires at least one building polygon",
      );
    const ordered = [...input.candidates].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const selected = ordered.find(
      (candidate) => candidate.id === input.selectedBuildingId,
    );
    if (!selected)
      throw new TypeError(
        "Schematic evidence requires the selected building polygon",
      );

    const context = addressContext(input.address);
    const allPoints = [
      input.addressPoint,
      ...ordered.flatMap((candidate) => candidate.polygon),
    ];
    const overview = projector(allPoints, 650, 340);
    const detail = projector(selected.polygon, 310, 300, 46);
    const addressPoint = overview.map(input.addressPoint);
    const selectedOverviewCenter = overview.map(centroid(selected.polygon));
    const selectedDetailCenter = detail.map(centroid(selected.polygon));
    const calloutX = Math.min(selectedOverviewCenter.x + 75, 500);
    const calloutY = Math.max(selectedOverviewCenter.y - 48, 42);
    const selectedMarker =
      context.houseNumber || selected.addressHouseNumber || "VALGT";
    const overviewScaleMeters = niceScaleMeters(overview.pixelsPerMeter);
    const overviewScaleWidth = overviewScaleMeters * overview.pixelsPerMeter;

    const overviewBuildings = ordered
      .map((candidate, index) => {
        const isSelected = candidate.id === input.selectedBuildingId;
        const center = overview.map(centroid(candidate.polygon));
        const marker = buildingMarker(
          candidate,
          index,
          isSelected,
          context.houseNumber,
        );
        const radius = marker.length > 2 ? 21 : 17;
        return `<g data-building-id="${escapeXml(candidate.id)}"><polygon points="${polygonPoints(candidate, overview.map)}" fill="${isSelected ? "#f2a900" : "#303746"}" fill-opacity="${isSelected ? "0.78" : "0.42"}" stroke="${isSelected ? "#ffd05b" : "#94a3b8"}" stroke-width="${isSelected ? 5 : 2.5}"/><circle cx="${center.x.toFixed(1)}" cy="${center.y.toFixed(1)}" r="${radius}" fill="#0b0f17" stroke="${isSelected ? "#ffd05b" : "#ffffff"}" stroke-width="2"/><text x="${center.x.toFixed(1)}" y="${(center.y + 5).toFixed(1)}" text-anchor="middle" font-size="${marker.length > 2 ? 12 : 15}" font-weight="700" fill="#ffffff">${escapeXml(marker)}</text></g>`;
      })
      .join("");

    const detailPolygon = `<polygon points="${polygonPoints(selected, detail.map)}" fill="#f2a900" fill-opacity="0.78" stroke="#ffd05b" stroke-width="6"/><circle cx="${selectedDetailCenter.x.toFixed(1)}" cy="${selectedDetailCenter.y.toFixed(1)}" r="28" fill="#0b0f17" stroke="#ffffff" stroke-width="2"/><text x="${selectedDetailCenter.x.toFixed(1)}" y="${(selectedDetailCenter.y + 7).toFixed(1)}" text-anchor="middle" font-size="18" font-weight="700" fill="#ffffff">${escapeXml(context.houseNumber || selected.addressHouseNumber || "✓")}</text>`;
    const selectedContext = selected.buildingName || selected.label;
    const snapshot = {
      ...input,
      candidates: ordered,
      schemaVersion: 2 as const,
    };
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-labelledby="title description"><title id="title">Takmåling – ${escapeXml(input.address)}</title><description id="description">Målebevis med oversiktskart, valgt bygningskontur, adressepunkt, gatenavn, husnummer, nordpil og målestokk.</description><rect width="1200" height="800" fill="#0b0f17"/><text x="50" y="44" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="#ffffff">TAKFORNYELSE · MÅLEBEVIS</text><text x="50" y="76" font-family="Arial,sans-serif" font-size="18" fill="#d1d5db">${escapeXml(input.address)}</text><rect x="50" y="100" width="700" height="520" rx="20" fill="#141a24" stroke="#344154"/><rect x="780" y="100" width="370" height="520" rx="20" fill="#141a24" stroke="#344154"/><text x="75" y="137" font-family="Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="2" fill="#f2a900">OVERSIKT</text><text x="805" y="137" font-family="Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="2" fill="#f2a900">VALGT BYGG</text><g transform="translate(75 155)" font-family="Arial,sans-serif">${overviewBuildings}<path d="M${addressPoint.x.toFixed(1)} ${(addressPoint.y - 18).toFixed(1)} C${(addressPoint.x - 14).toFixed(1)} ${(addressPoint.y - 18).toFixed(1)} ${(addressPoint.x - 17).toFixed(1)} ${(addressPoint.y - 2).toFixed(1)} ${addressPoint.x.toFixed(1)} ${(addressPoint.y + 18).toFixed(1)} C${(addressPoint.x + 17).toFixed(1)} ${(addressPoint.y - 2).toFixed(1)} ${(addressPoint.x + 14).toFixed(1)} ${(addressPoint.y - 18).toFixed(1)} ${addressPoint.x.toFixed(1)} ${(addressPoint.y - 18).toFixed(1)} Z" fill="#ef4444" stroke="#ffffff" stroke-width="2"/><circle cx="${addressPoint.x.toFixed(1)}" cy="${(addressPoint.y - 7).toFixed(1)}" r="5" fill="#ffffff"/><line x1="${selectedOverviewCenter.x.toFixed(1)}" y1="${selectedOverviewCenter.y.toFixed(1)}" x2="${calloutX.toFixed(1)}" y2="${calloutY.toFixed(1)}" stroke="#ffd05b" stroke-width="2" stroke-dasharray="6 5"/><rect x="${(calloutX - 7).toFixed(1)}" y="${(calloutY - 18).toFixed(1)}" width="110" height="30" rx="10" fill="#0b0f17" stroke="#ffd05b"/><text x="${(calloutX + 48).toFixed(1)}" y="${(calloutY + 2).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">VALGT: ${escapeXml(selectedMarker)}</text><g transform="translate(20 306)"><line x1="0" y1="0" x2="${overviewScaleWidth.toFixed(1)}" y2="0" stroke="#ffffff" stroke-width="5"/><line x1="0" y1="-6" x2="0" y2="6" stroke="#ffffff" stroke-width="2"/><line x1="${overviewScaleWidth.toFixed(1)}" y1="-6" x2="${overviewScaleWidth.toFixed(1)}" y2="6" stroke="#ffffff" stroke-width="2"/><text x="${(overviewScaleWidth / 2).toFixed(1)}" y="-10" text-anchor="middle" font-size="13" fill="#ffffff">Målestokk ${overviewScaleMeters} m</text></g>${northArrow(600, 18)}</g><g transform="translate(810 160)" font-family="Arial,sans-serif">${detailPolygon}${northArrow(265, 8)}</g><g font-family="Arial,sans-serif"><rect x="75" y="515" width="650" height="78" rx="12" fill="#0b0f17" stroke="#344154"/><text x="95" y="542" font-size="17" font-weight="700" fill="#ffffff">Målt bygning: ${escapeXml(context.streetAddress)}</text><text x="95" y="568" font-size="15" fill="#cbd5e1">Nærmeste gate: ${escapeXml(selected.addressStreet || context.streetName)}</text><text x="95" y="588" font-size="12" fill="#94a3b8">Rød markør = offisielt adressepunkt · gult omriss = valgt bygningskontur</text><rect x="805" y="490" width="320" height="103" rx="12" fill="#0b0f17" stroke="#344154"/><text x="825" y="518" font-size="16" font-weight="700" fill="#ffffff">Målt bygning</text><text x="825" y="544" font-size="15" fill="#f2a900">${escapeXml(context.streetAddress)}</text><text x="825" y="568" font-size="13" fill="#cbd5e1">${escapeXml(selectedContext)}</text><text x="825" y="588" font-size="12" fill="#94a3b8">Bygg-ID: ${escapeXml(selected.id)}</text><rect x="50" y="645" width="1100" height="62" rx="14" fill="#141a24" stroke="#344154"/><circle cx="78" cy="675" r="10" fill="#ef4444" stroke="#ffffff"/><text x="98" y="681" font-size="14" fill="#d1d5db">Adressepunkt</text><rect x="235" y="665" width="22" height="18" fill="#f2a900" stroke="#ffd05b"/><text x="269" y="681" font-size="14" fill="#d1d5db">Valgt bygg</text><rect x="405" y="665" width="22" height="18" fill="#303746" stroke="#94a3b8"/><text x="439" y="681" font-size="14" fill="#d1d5db">Nabobygg · husnummer vises når kilden har det</text><text x="50" y="738" font-size="14" fill="#cbd5e1">Skjematisk kontroll av lagret bygningskontur – ikke en konstruksjonstegning.</text><text x="50" y="766" font-size="12" fill="#94a3b8">${escapeXml(input.source)} · ${escapeXml(input.attribution)} · ${escapeXml(input.generatedAt)}</text></g></svg>`;
    const bytes = Buffer.from(svg, "utf8");
    return {
      bytes,
      filename: `takmaling-${createHash("sha256").update(input.address).digest("hex").slice(0, 12)}.svg`,
      hash: createHash("sha256").update(bytes).digest("hex"),
      mimeType: "image/svg+xml",
      snapshot,
    };
  }
}

export class FakeMapEvidenceProvider implements MapEvidenceProvider {
  constructor(private readonly result: MeasurementEvidence) {}
  async render() {
    return this.result;
  }
}
