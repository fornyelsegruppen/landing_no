"use client";

import { useMemo, useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";
import { useRouter } from "next/navigation";

type Point = { latitude: number; longitude: number };
type Plane = { id: string; polygon: Point[]; angleMinDegrees: number; angleMaxDegrees: number };

function PolygonPreview({ planes }: { planes: Plane[] }) {
  const points = planes.flatMap((plane) => plane.polygon);
  if (points.length < 3) return <p>Ingen gyldig polygon å forhåndsvise.</p>;
  const minX = Math.min(...points.map((point) => point.longitude));
  const maxX = Math.max(...points.map((point) => point.longitude));
  const minY = Math.min(...points.map((point) => point.latitude));
  const maxY = Math.max(...points.map((point) => point.latitude));
  const scaleX = (value: number) => 10 + ((value - minX) / Math.max(maxX - minX, 0.000001)) * 280;
  const scaleY = (value: number) => 190 - ((value - minY) / Math.max(maxY - minY, 0.000001)) * 180;
  return <svg aria-label="Forhåndsvisning av takpolygon" role="img" viewBox="0 0 300 200">
    {planes.map((plane, index) => <polygon key={plane.id} points={plane.polygon.map((point) => `${scaleX(point.longitude)},${scaleY(point.latitude)}`).join(" ")} fill={`hsl(${35 + index * 55} 85% 55% / .28)`} stroke="currentColor" strokeWidth="2" />)}
  </svg>;
}

export const MeasurementActions: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo();
  const router = useRouter();
  const rawPlanes = useFormFields(([fields]) => fields.roofPlanes?.value);
  const confidenceValue = useFormFields(([fields]) => fields.confidence?.value);
  const reasoningValue = useFormFields(([fields]) => fields.confidenceReasoning?.value);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const planes = useMemo(() => {
    try { return (typeof rawPlanes === "string" ? JSON.parse(rawPlanes) : rawPlanes) as Plane[] ?? []; }
    catch { return []; }
  }, [rawPlanes]);

  async function action(name: "approve" | "create_version" | "calculate_price") {
    if (!id || busy) return;
    setBusy(true); setNotice("");
    try {
      const body = name === "create_version"
        ? { action: name, roofPlanes: planes, confidence: confidenceValue, confidenceReasoning: reasoningValue }
        : { action: name };
      const response = await fetch(`/api/admin/measurements/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; measurement?: { id: number }; calculation?: { id: number } };
      if (!response.ok) throw new Error(result.error ?? "Handlingen feilet");
      if (result.measurement?.id && name === "create_version") router.push(`/admin/collections/roof-measurements/${result.measurement.id}`);
      else if (result.calculation?.id) router.push(`/admin/collections/price-calculations/${result.calculation.id}`);
      else { setNotice("Takmålingen er godkjent."); window.setTimeout(() => router.refresh(), 500); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Handlingen feilet"); }
    finally { setBusy(false); }
  }

  if (!id) return <p>Lagre målingen før kontrollhandlinger blir tilgjengelige.</p>;
  return <section className="measurement-actions">
    <h3>Kontrollert takmåling</h3>
    <p>Kontroller polygon, hver takflate og vinkelintervall. Endringer skal lagres som en ny versjon.</p>
    <PolygonPreview planes={planes} />
    <div className="measurement-actions__buttons">
      <button type="button" disabled={busy} onClick={() => action("create_version")}>Lagre feltene som ny versjon</button>
      <button type="button" disabled={busy} onClick={() => action("approve")}>Godkjenn måling</button>
      <button type="button" disabled={busy} onClick={() => action("calculate_price")}>Beregn pris</button>
    </div>
    {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
  </section>;
};

export default MeasurementActions;
