import { createHash } from "node:crypto";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import type { GeoPoint } from "./types";

export type SchematicEvidenceInput = {
  address: string;
  addressPoint: GeoPoint;
  candidates: Pick<BuildingFootprintCandidate, "id" | "label" | "polygon">[];
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
  snapshot: SchematicEvidenceInput & { schemaVersion: 1 };
};

export interface MapEvidenceProvider {
  render(input: SchematicEvidenceInput): Promise<MeasurementEvidence>;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function project(points: GeoPoint[], width: number, height: number) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes); const maxLon = Math.max(...longitudes);
  const latitudeMid = (minLat + maxLat) / 2;
  const lonScale = Math.max(Math.cos(latitudeMid * Math.PI / 180), 0.1);
  const spanX = Math.max((maxLon - minLon) * lonScale, 0.00002);
  const spanY = Math.max(maxLat - minLat, 0.00002);
  const scale = Math.min(width / spanX, height / spanY);
  const usedWidth = spanX * scale; const usedHeight = spanY * scale;
  const offsetX = (width - usedWidth) / 2; const offsetY = (height - usedHeight) / 2;
  return (point: GeoPoint) => ({
    x: offsetX + (point.longitude - minLon) * lonScale * scale,
    y: offsetY + (maxLat - point.latitude) * scale,
  });
}

function centroid(points: GeoPoint[]) {
  return {
    latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
  };
}

export class SchematicRoofEvidenceProvider implements MapEvidenceProvider {
  async render(input: SchematicEvidenceInput): Promise<MeasurementEvidence> {
    if (!input.candidates.length) throw new TypeError("Schematic evidence requires at least one building polygon");
    const ordered = [...input.candidates].sort((left, right) => left.id.localeCompare(right.id));
    const allPoints = [input.addressPoint, ...ordered.flatMap((candidate) => candidate.polygon)];
    const map = project(allPoints, 1000, 560);
    const address = map(input.addressPoint);
    const polygons = ordered.map((candidate, index) => {
      const selected = candidate.id === input.selectedBuildingId;
      const points = candidate.polygon.map(map).map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
      const label = map(centroid(candidate.polygon));
      return `<g data-building-id="${escapeXml(candidate.id)}"><polygon points="${points}" fill="${selected ? "#f2a900" : "#303746"}" fill-opacity="${selected ? "0.72" : "0.38"}" stroke="${selected ? "#ffd05b" : "#94a3b8"}" stroke-width="${selected ? 6 : 3}"/><circle cx="${label.x.toFixed(1)}" cy="${label.y.toFixed(1)}" r="18" fill="#0b0f17" stroke="#ffffff"/><text x="${label.x.toFixed(1)}" y="${(label.y + 6).toFixed(1)}" text-anchor="middle" font-size="18" font-weight="700" fill="#ffffff">${index + 1}</text></g>`;
    }).join("");
    const selected = ordered.find((candidate) => candidate.id === input.selectedBuildingId);
    const snapshot = { ...input, candidates: ordered, schemaVersion: 1 as const };
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-labelledby="title description"><title id="title">Takmåling – ${escapeXml(input.address)}</title><description id="description">Skjematisk målebevis med valgt bygningskontur og nærliggende kandidater.</description><rect width="1200" height="800" fill="#0b0f17"/><rect x="70" y="90" width="1060" height="590" rx="22" fill="#141a24" stroke="#344154"/><g transform="translate(100 105)">${polygons}<path d="M${address.x.toFixed(1)} ${(address.y - 14).toFixed(1)} L${(address.x - 11).toFixed(1)} ${(address.y + 8).toFixed(1)} L${(address.x + 11).toFixed(1)} ${(address.y + 8).toFixed(1)} Z" fill="#ef4444" stroke="#ffffff" stroke-width="2"/></g><text x="70" y="50" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#ffffff">TAKFORNYELSE · MÅLEBEVIS</text><text x="70" y="82" font-family="Arial,sans-serif" font-size="18" fill="#d1d5db">${escapeXml(input.address)}</text><g transform="translate(1060 120)" font-family="Arial,sans-serif" fill="#ffffff"><path d="M0 45 L18 0 L36 45 L18 34 Z" fill="#ffffff"/><text x="18" y="66" text-anchor="middle" font-size="16">N</text></g><text x="100" y="710" font-family="Arial,sans-serif" font-size="17" fill="#f2a900">Valgt bygg: ${escapeXml(selected?.label || "ikke valgt")}</text><text x="100" y="740" font-family="Arial,sans-serif" font-size="14" fill="#cbd5e1">Skjematisk kontroll av lagret bygningskontur – ikke en konstruksjonstegning.</text><text x="100" y="766" font-family="Arial,sans-serif" font-size="13" fill="#94a3b8">${escapeXml(input.source)} · ${escapeXml(input.attribution)} · ${escapeXml(input.generatedAt)}</text></svg>`;
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
  async render() { return this.result; }
}
