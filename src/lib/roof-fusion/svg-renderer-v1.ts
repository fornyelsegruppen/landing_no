import { createHash } from "node:crypto";
import type {
  approvedRoofRendererPayloadV1,
  RoofMeasurementValueV1,
} from "./roof-snapshot-v1";

export const ROOF_SVG_RENDERER_VERSION = "roof-svg-renderer.v1.0.0" as const;

type ApprovedRendererEnvelopeV1 = ReturnType<
  typeof approvedRoofRendererPayloadV1
>;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function displayMeasurement(value: RoofMeasurementValueV1, decimals: number) {
  if (value.mode === "unknown" || value.min === null || value.max === null) {
    return "Unknown";
  }
  const suffix = value.unit === "m2" ? "m²" : value.unit === "deg" ? "°" : "m";
  const format = (number: number) => number.toFixed(decimals);
  return value.mode === "exact"
    ? `${format(value.min)} ${suffix}`
    : `${format(value.min)}–${format(value.max)} ${suffix}`;
}

function edgeColor(
  type: ApprovedRendererEnvelopeV1["payload"]["edges"][number]["type"],
) {
  return {
    ridge: "#f8d66d",
    hip: "#f6ad55",
    valley: "#60a5fa",
    eave: "#34d399",
    rake: "#c4b5fd",
    wall: "#fb7185",
    step: "#f472b6",
    unknown: "#94a3b8",
  }[type];
}

function qualityStroke(
  quality: ApprovedRendererEnvelopeV1["payload"]["surfaces"][number]["quality"],
) {
  if (quality === "verified") return "#34d399";
  if (quality === "conflicted") return "#fb7185";
  if (quality === "unknown") return "#94a3b8";
  return "#f8d66d";
}

export function renderApprovedRoofSnapshotSvgV1(
  envelope: ApprovedRendererEnvelopeV1,
) {
  if (envelope.schemaVersion !== "approved-roof-renderer-envelope.v1") {
    throw new TypeError("Unsupported approved roof renderer envelope");
  }
  if (envelope.payload.schemaVersion !== "roof-renderer.v1") {
    throw new TypeError("Unsupported roof renderer payload");
  }
  if (envelope.payload.displayState !== "approved") {
    throw new TypeError("SVG proof requires an approved roof renderer payload");
  }
  if (!envelope.payload.vertices.length || !envelope.payload.surfaces.length) {
    throw new TypeError("SVG proof requires roof geometry");
  }

  const width = 1200;
  const height = 800;
  const plot = { x: 52, y: 132, width: 720, height: 540, padding: 44 };
  const minX = Math.min(
    ...envelope.payload.vertices.map((vertex) => vertex.xM),
  );
  const maxX = Math.max(
    ...envelope.payload.vertices.map((vertex) => vertex.xM),
  );
  const minY = Math.min(
    ...envelope.payload.vertices.map((vertex) => vertex.yM),
  );
  const maxY = Math.max(
    ...envelope.payload.vertices.map((vertex) => vertex.yM),
  );
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min(
    (plot.width - plot.padding * 2) / spanX,
    (plot.height - plot.padding * 2) / spanY,
  );
  const usedWidth = spanX * scale;
  const usedHeight = spanY * scale;
  const offsetX = plot.x + (plot.width - usedWidth) / 2;
  const offsetY = plot.y + (plot.height - usedHeight) / 2;
  const vertices = new Map(
    envelope.payload.vertices.map((vertex) => [vertex.vertexId, vertex]),
  );
  const contours = new Map(
    envelope.payload.contours.map((contour) => [contour.contourId, contour]),
  );
  const point = (vertexId: string) => {
    const vertex = vertices.get(vertexId);
    if (!vertex) throw new TypeError(`Renderer vertex ${vertexId} is missing`);
    return {
      x: offsetX + (vertex.xM - minX) * scale,
      y: offsetY + usedHeight - (vertex.yM - minY) * scale,
    };
  };
  const polygon = (contourId: string) => {
    const contour = contours.get(contourId);
    if (!contour)
      throw new TypeError(`Renderer contour ${contourId} is missing`);
    return contour.vertexIds
      .map(point)
      .map((value) => `${value.x.toFixed(2)},${value.y.toFixed(2)}`)
      .join(" ");
  };
  const center = (contourId: string) => {
    const contour = contours.get(contourId);
    if (!contour)
      throw new TypeError(`Renderer contour ${contourId} is missing`);
    const points = contour.vertexIds.map(point);
    return {
      x: points.reduce((sum, value) => sum + value.x, 0) / points.length,
      y: points.reduce((sum, value) => sum + value.y, 0) / points.length,
    };
  };

  const surfaceColors = ["#153a52", "#1d4f63", "#24465f", "#2d4868"];
  const surfaces = envelope.payload.surfaces
    .map((surface, index) => {
      const label = center(surface.outerContourId);
      return `<g data-surface-id="${escapeXml(surface.surfaceId)}"><polygon points="${polygon(surface.outerContourId)}" fill="${surfaceColors[index % surfaceColors.length]}" fill-opacity="0.92" stroke="${qualityStroke(surface.quality)}" stroke-width="3"/><text x="${label.x.toFixed(2)}" y="${(label.y - 7).toFixed(2)}" text-anchor="middle" font-size="16" font-weight="700" fill="#ffffff">${escapeXml(surface.surfaceId)}</text><text x="${label.x.toFixed(2)}" y="${(label.y + 15).toFixed(2)}" text-anchor="middle" font-size="13" fill="#dbeafe">${escapeXml(displayMeasurement(surface.pitch, envelope.payload.units.precision.angleDecimals))} · ${escapeXml(displayMeasurement(surface.netSurfaceArea, envelope.payload.units.precision.areaDecimals))}</text></g>`;
    })
    .join("");
  const edges = envelope.payload.edges
    .map((edge) => {
      const from = point(edge.fromVertexId);
      const to = point(edge.toVertexId);
      const dash =
        edge.quality === "conflicted" || edge.quality === "unknown"
          ? ' stroke-dasharray="8 7"'
          : "";
      return `<line data-edge-id="${escapeXml(edge.edgeId)}" data-edge-type="${edge.type}" x1="${from.x.toFixed(2)}" y1="${from.y.toFixed(2)}" x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}" stroke="${edgeColor(edge.type)}" stroke-width="${edge.type === "ridge" ? 6 : 4}" stroke-linecap="round"${dash}/>`;
    })
    .join("");
  const openings = envelope.payload.openings
    .map(
      (opening) =>
        `<polygon data-opening-id="${escapeXml(opening.openingId)}" points="${polygon(opening.contourId)}" fill="#07111d" stroke="#38bdf8" stroke-width="3"/>`,
    )
    .join("");
  const obstacles = envelope.payload.obstacles
    .filter((obstacle) => obstacle.contourId)
    .map(
      (obstacle) =>
        `<polygon data-obstacle-id="${escapeXml(obstacle.obstacleId)}" points="${polygon(obstacle.contourId!)}" fill="#7c2d12" fill-opacity="0.88" stroke="#fb923c" stroke-width="3" stroke-dasharray="7 5"/>`,
    )
    .join("");

  const summaryRows = [
    [
      "Measurement class",
      envelope.payload.measurementClass.replaceAll("_", " "),
    ],
    [
      "Gross horizontal area",
      displayMeasurement(
        envelope.payload.totals.grossHorizontalArea,
        envelope.payload.units.precision.areaDecimals,
      ),
    ],
    [
      "Gross surface area",
      displayMeasurement(
        envelope.payload.totals.grossSurfaceArea,
        envelope.payload.units.precision.areaDecimals,
      ),
    ],
    [
      "Net surface area",
      displayMeasurement(
        envelope.payload.totals.netSurfaceArea,
        envelope.payload.units.precision.areaDecimals,
      ),
    ],
    [
      "Footprint perimeter",
      displayMeasurement(
        envelope.payload.totals.footprintPerimeter,
        envelope.payload.units.precision.lengthDecimals,
      ),
    ],
    [
      "Eave length",
      displayMeasurement(
        envelope.payload.totals.eaveLength,
        envelope.payload.units.precision.lengthDecimals,
      ),
    ],
    [
      "Gutter candidate",
      displayMeasurement(
        envelope.payload.totals.gutterCandidateLength,
        envelope.payload.units.precision.lengthDecimals,
      ),
    ],
    [
      "Verified gutter",
      displayMeasurement(
        envelope.payload.totals.verifiedGutterLength,
        envelope.payload.units.precision.lengthDecimals,
      ),
    ],
  ];
  const rows = summaryRows
    .map(
      ([label, value], index) =>
        `<g transform="translate(824 ${194 + index * 48})"><text x="0" y="0" font-size="13" fill="#94a3b8">${escapeXml(label)}</text><text x="0" y="22" font-size="18" font-weight="700" fill="#f8fafc">${escapeXml(value)}</text></g>`,
    )
    .join("");
  const sources = envelope.payload.sources
    .map((source) => `${source.attribution} (${source.licenseStatus})`)
    .join(" · ");
  const description = `Approved roof snapshot ${envelope.snapshotId} revision ${envelope.snapshotRevision}. ${envelope.payload.surfaces.length} surfaces, ${envelope.payload.edges.length} edges, net area ${displayMeasurement(envelope.payload.totals.netSurfaceArea, envelope.payload.units.precision.areaDecimals)}.`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="roof-title roof-description"><title id="roof-title">Approved Roof Snapshot · ${escapeXml(envelope.snapshotId)}</title><description id="roof-description">${escapeXml(description)}</description><rect width="1200" height="800" fill="#07111d"/><rect x="28" y="24" width="1144" height="752" rx="26" fill="#0b1726" stroke="#26364a" stroke-width="2"/><text x="52" y="68" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="#f8fafc">ROOF FUSION · APPROVED SNAPSHOT</text><text x="52" y="100" font-family="Arial,sans-serif" font-size="15" fill="#94a3b8">${escapeXml(envelope.snapshotId)} · revision ${envelope.snapshotRevision} · snapshot ${envelope.sourceSnapshotHash.slice(0, 16)}… · renderer ${envelope.payload.renderHash.slice(0, 16)}…</text><rect x="52" y="132" width="720" height="540" rx="20" fill="#0f2032" stroke="#263f59"/><g font-family="Arial,sans-serif">${surfaces}${edges}${openings}${obstacles}</g><rect x="800" y="132" width="344" height="540" rx="20" fill="#101d2c" stroke="#263f59"/><text x="824" y="166" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#f8d66d">MEASUREMENT SUMMARY</text><g font-family="Arial,sans-serif">${rows}</g><g transform="translate(824 596)" font-family="Arial,sans-serif"><line x1="0" y1="0" x2="26" y2="0" stroke="#f8d66d" stroke-width="5"/><text x="38" y="5" font-size="13" fill="#cbd5e1">ridge</text><line x1="112" y1="0" x2="138" y2="0" stroke="#34d399" stroke-width="5"/><text x="150" y="5" font-size="13" fill="#cbd5e1">eave</text><line x1="220" y1="0" x2="246" y2="0" stroke="#c4b5fd" stroke-width="5"/><text x="258" y="5" font-size="13" fill="#cbd5e1">rake</text></g><text x="52" y="712" font-family="Arial,sans-serif" font-size="13" fill="#94a3b8">Customer-safe source: ${escapeXml(sources || "Derived geometry only")}</text><text x="52" y="742" font-family="Arial,sans-serif" font-size="12" fill="#64748b">${ROOF_SVG_RENDERER_VERSION} · ${escapeXml(envelope.payload.coordinateSystem.reference)} · exact approved snapshot and renderer hashes shown above</text></svg>`;
  const bytes = Buffer.from(svg, "utf8");
  return {
    schemaVersion: "roof-svg-artifact.v1" as const,
    rendererVersion: ROOF_SVG_RENDERER_VERSION,
    sourceSnapshotHash: envelope.sourceSnapshotHash,
    sourceRendererHash: envelope.payload.renderHash,
    mimeType: "image/svg+xml" as const,
    filename: `roof-snapshot-${envelope.snapshotId}.svg`,
    svg,
    bytes,
    artifactHash: createHash("sha256").update(bytes).digest("hex"),
  };
}
