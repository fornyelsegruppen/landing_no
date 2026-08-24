"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UIFieldClientComponent } from "payload";
import { useDocumentInfo, useFormFields, useTranslation } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import { getAdminMeasurementCopy } from "@/lib/admin-measurement-i18n";

type Message = {
  id: number;
  category: string;
  channel: string;
  subject: string;
  bodyText: string;
  status: string;
  aiAssisted?: boolean;
  createdAt: string;
  sentAt?: string | null;
  failureMessage?: string | null;
};

type AddressCandidate = {
  id: string;
  label: string;
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
  source: string;
};

type BuildingCandidate = {
  id: string;
  label: string;
  polygon: Array<{ latitude: number; longitude: number }>;
  horizontalAreaSquareMeters: number;
  distanceToAddressMeters: number;
  containsAddress: boolean;
  confidence: "high" | "medium" | "low";
  confidenceReasoning: string;
  source: string;
  sourceUrl: string;
  license: string;
  credits: string;
};

type Discovery = {
  address: AddressCandidate;
  candidates: BuildingCandidate[];
  selectedCandidateId: string;
};

const slopes = {
  unknown: [22, 32],
  "22": [22, 22],
  "27": [27, 27],
  "32": [32, 32],
  "36": [36, 36],
  "40": [40, 40],
  "45": [45, 45],
} as const;

type SlopeKey = keyof typeof slopes;

function slopeAdjustedArea(horizontal: number, degrees: number) {
  return horizontal / Math.cos(degrees * Math.PI / 180);
}

export const LeadWorkflowActions: UIFieldClientComponent = () => {
  const { id } = useDocumentInfo();
  const router = useRouter();
  const { i18n } = useTranslation();
  const measurementCopy = getAdminMeasurementCopy(i18n.language);
  const status = useFormFields(([fields]) => fields.status?.value);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [measurementBusy, setMeasurementBusy] = useState(false);
  const [measurementNotice, setMeasurementNotice] = useState("");
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [slope, setSlope] = useState<SlopeKey>("unknown");

  const selectedCandidate = useMemo(
    () => discovery?.candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [discovery, selectedCandidateId],
  );

  const areaRange = useMemo(() => {
    if (!selectedCandidate) return null;
    const [minimumSlope, maximumSlope] = slopes[slope];
    return {
      minimum: Math.round(slopeAdjustedArea(selectedCandidate.horizontalAreaSquareMeters, minimumSlope)),
      maximum: Math.round(slopeAdjustedArea(selectedCandidate.horizontalAreaSquareMeters, maximumSlope)),
    };
  }, [selectedCandidate, slope]);

  const load = useCallback(async () => {
    if (!id) return;
    const response = await fetch(`/api/admin/leads/${id}`, { cache: "no-store" });
    if (!response.ok) return;
    const result = (await response.json()) as { messages: Message[] };
    setMessages(result.messages);
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(action: "generate_reply" | "approve_send" | "retry_send" | "request_information" | "start_measurement" | "close", messageId?: number) {
    if (!id || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(messageId ? { messageId } : {}) }),
      });
      const result = (await response.json()) as { error?: string; sent?: boolean; configurationRequired?: boolean };
      if (!response.ok) throw new Error(result.error || "Handlingen feilet");
      setNotice(result.configurationRequired ? "Godkjent og lagt i kø. E-postleverandøren må konfigureres." : result.sent ? "Meldingen er sendt." : "Handlingen er fullført.");
      await load();
      if (["start_measurement", "close"].includes(action)) window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Handlingen feilet");
    } finally {
      setBusy(false);
    }
  }

  async function discoverRoof() {
    if (!id || measurementBusy) return;
    setMeasurementBusy(true);
    setMeasurementNotice("");
    setDiscovery(null);
    try {
      const response = await fetch("/api/admin/measurements/free-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: Number(id) }),
      });
      const result = await response.json() as Discovery & { error?: string; code?: string };
      if (!response.ok) {
        if (result.code === "ADDRESS_REQUIRED") throw new Error(measurementCopy.addressRequired);
        if (result.code === "BUILDING_NOT_FOUND") throw new Error(measurementCopy.buildingNotFound);
        throw new Error(result.error || measurementCopy.failed);
      }
      setDiscovery(result);
      setSelectedCandidateId(result.selectedCandidateId);
    } catch (error) {
      setMeasurementNotice(error instanceof Error ? error.message : measurementCopy.failed);
    } finally {
      setMeasurementBusy(false);
    }
  }

  async function createMeasurement() {
    if (!id || !discovery || !selectedCandidate || measurementBusy) return;
    setMeasurementBusy(true);
    setMeasurementNotice("");
    try {
      const [angleMinDegrees, angleMaxDegrees] = slopes[slope];
      const response = await fetch("/api/admin/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          leadId: Number(id),
          address: discovery.address,
          proposal: {
            buildingIdentifier: selectedCandidate.id,
            confidence: selectedCandidate.confidence,
            confidenceReasoning: selectedCandidate.confidenceReasoning,
            roofPlanes: [{
              id: "osm-building-footprint",
              polygon: selectedCandidate.polygon,
              angleMinDegrees,
              angleMaxDegrees,
            }],
          },
          // Legacy storage field: true means the selected data source and its
          // reuse terms have been recorded, not that an aerial image was used.
          imageryLicensed: true,
          imagerySource: selectedCandidate.source,
          imagerySourceUrl: selectedCandidate.sourceUrl,
          license: selectedCandidate.license,
          credits: selectedCandidate.credits,
        }),
      });
      const result = await response.json() as { error?: string; measurement?: { id: number } };
      if (!response.ok || !result.measurement?.id) throw new Error(result.error || measurementCopy.failed);
      router.push(`/admin/collections/roof-measurements/${result.measurement.id}`);
    } catch (error) {
      setMeasurementNotice(error instanceof Error ? error.message : measurementCopy.failed);
    } finally {
      setMeasurementBusy(false);
    }
  }

  if (!id) return <p>Lagre henvendelsen før arbeidsflyten blir tilgjengelig.</p>;

  return (
    <section className="lead-workflow-actions" aria-labelledby="lead-workflow-title">
      <div className="lead-workflow-actions__header">
        <div>
          <h3 id="lead-workflow-title">Henvendelsesflyt</h3>
          <p>Status: <strong>{String(status || "new")}</strong>. AI lager bare utkast.</p>
        </div>
        <div className="lead-workflow-actions__buttons">
          <button disabled={busy} onClick={() => act("generate_reply")} type="button">Lag AI-svarutkast</button>
          <button disabled={busy} onClick={() => act("request_information")} type="button">Be om informasjon</button>
          <button disabled={busy} onClick={() => act("start_measurement")} type="button">Start måling</button>
          <button className="is-danger" disabled={busy} onClick={() => act("close")} type="button">Lukk</button>
        </div>
      </div>
      <div className="lead-workflow-actions__timeline">
        {messages.length ? messages.map((message) => (
          <article key={message.id}>
            <div><strong>{message.subject}</strong><span>{message.category} · {message.channel} · {message.status}</span></div>
            <p>{message.bodyText}</p>
            {message.failureMessage ? <p className="is-danger">{message.failureMessage}</p> : null}
            {message.status === "draft" ? (
              <div className="lead-workflow-actions__message-actions">
                <a href={`/admin/collections/messages/${message.id}`}>Rediger utkast</a>
                <button disabled={busy} onClick={() => act("approve_send", message.id)} type="button">Godkjenn og send</button>
              </div>
            ) : null}
            {["attention", "failed"].includes(message.status) ? (
              <div className="lead-workflow-actions__message-actions">
                <a href={`/admin/collections/messages/${message.id}`}>Se leveringsfeil</a>
                <button disabled={busy} onClick={() => act("retry_send", message.id)} type="button">Prøv sending igjen</button>
              </div>
            ) : null}
          </article>
        )) : <p>Ingen meldinger er opprettet ennå.</p>}
      </div>
      <div className="automatic-measurement">
        <div>
          <h3>{measurementCopy.title}</h3>
          <p>{measurementCopy.intro}</p>
        </div>
        <button disabled={measurementBusy} onClick={discoverRoof} type="button">
          {measurementBusy && !discovery ? measurementCopy.finding : measurementCopy.find}
        </button>
        {discovery ? (
          <div className="automatic-measurement__result">
            <p><strong>{discovery.address.label}</strong></p>
            <fieldset>
              <legend>{measurementCopy.candidate}</legend>
              <div className="automatic-measurement__candidates">
                {discovery.candidates.map((candidate) => (
                  <label className={candidate.id === selectedCandidateId ? "is-selected" : ""} key={candidate.id}>
                    <input
                      checked={candidate.id === selectedCandidateId}
                      name="buildingCandidate"
                      onChange={() => setSelectedCandidateId(candidate.id)}
                      type="radio"
                      value={candidate.id}
                    />
                    <span>
                      <strong>{candidate.label}</strong>
                      <small>{candidate.containsAddress ? measurementCopy.contains : measurementCopy.nearby}</small>
                      <small>{measurementCopy.distance}: {candidate.distanceToAddressMeters} m · {measurementCopy.confidence}: {candidate.confidence}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="automatic-measurement__slope">
              <strong>{measurementCopy.slope}</strong>
              <select onChange={(event) => setSlope(event.target.value as SlopeKey)} value={slope}>
                <option value="unknown">{measurementCopy.unknownSlope}</option>
                {[22, 27, 32, 36, 40, 45].map((degrees) => <option key={degrees} value={degrees}>{degrees}°</option>)}
              </select>
            </label>
            {selectedCandidate && areaRange ? (
              <div className="automatic-measurement__summary">
                <span>{measurementCopy.horizontal}: <strong>{selectedCandidate.horizontalAreaSquareMeters} m²</strong></span>
                <span>{measurementCopy.estimate}: <strong>{areaRange.minimum}–{areaRange.maximum} m²</strong></span>
                <a href={selectedCandidate.sourceUrl} rel="noreferrer" target="_blank">{measurementCopy.openMap}</a>
              </div>
            ) : null}
            <p className="automatic-measurement__notice">{measurementCopy.review}</p>
            <button disabled={measurementBusy || !selectedCandidate} onClick={createMeasurement} type="button">
              {measurementBusy ? measurementCopy.creating : measurementCopy.create}
            </button>
            <p className="automatic-measurement__credit">© OpenStreetMap contributors · ODbL 1.0</p>
          </div>
        ) : null}
        {measurementNotice ? <p aria-live="polite" className="is-danger" role="status">{measurementNotice}</p> : null}
      </div>
      {notice ? <p aria-live="polite" role="status">{notice}</p> : null}
    </section>
  );
};

export default LeadWorkflowActions;
