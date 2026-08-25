"use client";

import { type FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { PanelLocale } from "@/lib/panel-i18n";

type Candidate = {
  confidence: "high" | "medium" | "low";
  distanceToAddressMeters: number;
  horizontalAreaSquareMeters: number;
  id: string;
  label: string;
  polygon: Array<{ latitude: number; longitude: number }>;
};
type Address = { id: string; label: string; latitude: number; longitude: number };

const text = {
  nb: {
    title: "Kontroller bygning og takareal", intro: "Velg riktig bygning og takvinkel. Endringen lagres først når du bekrefter den.",
    address: "Adresse", postal: "Postnummer", city: "Sted", service: "Tjeneste", saveIntake: "Lagre adresse og tjeneste",
    find: "Finn bygninger", finding: "Søker …", candidates: "Mulige bygninger", selected: "Valgt", area: "Horisontalt areal", distance: "Fra adressepunkt", confidence: "Sikkerhet",
    slope: "Takvinkel", reason: "Begrunnelse", reasonHint: "Hvorfor er dette riktig bygg / riktig grunnlag?", saveBuilding: "Velg dette bygget og beregn på nytt",
    formula: "Forhåndsvisning", manualTitle: "Manuelt areal uten kart", manualHelp: "Bruk bare når ingen pålitelig bygningskontur kan velges. Ingen kartillustrasjon legges ved tilbudet.",
    source: "Kilde", manualArea: "Kontrollert takareal (m²)", createManual: "Lagre manuelt areal", largeDeviation: "Arealet avviker mer enn 20 %. Kontroller en gang til og bekreft eksplisitt.",
    confirmDeviation: "Jeg har kontrollert det store avviket", approve: "Godkjenn takmålingen", approveSend: "Kontroller hele pakken og send", processing: "Behandler …", failed: "Handlingen kunne ikke fullføres.", saved: "Lagret. Siden oppdateres.", currentEvidence: "Lagret målebevis", noCandidates: "Ingen brukbar bygningskontur ble funnet. Bruk manuelt areal uten kart eller korriger adressen.",
  },
  lt: {
    title: "Patikrinkite pastatą ir stogo plotą", intro: "Pasirinkite tinkamą pastatą ir stogo nuolydį. Pakeitimas išsaugomas tik jį patvirtinus.",
    address: "Adresas", postal: "Pašto kodas", city: "Miestas", service: "Paslauga", saveIntake: "Išsaugoti adresą ir paslaugą",
    find: "Rasti pastatus", finding: "Ieškoma …", candidates: "Galimi pastatai", selected: "Pasirinkta", area: "Horizontalus plotas", distance: "Nuo adreso taško", confidence: "Patikimumas",
    slope: "Stogo nuolydis", reason: "Pagrindimas", reasonHint: "Kodėl tai tinkamas pastatas ir skaičiavimo pagrindas?", saveBuilding: "Pasirinkti šį pastatą ir perskaičiuoti",
    formula: "Peržiūros skaičiavimas", manualTitle: "Rankinis plotas be žemėlapio", manualHelp: "Naudokite tik tada, kai negalima patikimai pasirinkti pastato kontūro. Prie pasiūlymo nebus pridėtas žemėlapio vaizdas.",
    source: "Šaltinis", manualArea: "Patikrintas stogo plotas (m²)", createManual: "Išsaugoti rankinį plotą", largeDeviation: "Plotas skiriasi daugiau nei 20 %. Patikrinkite dar kartą ir aiškiai patvirtinkite.",
    confirmDeviation: "Patikrinau didelį skirtumą", approve: "Patvirtinti stogo matavimą", approveSend: "Patikrinti visą paketą ir siųsti", processing: "Vykdoma …", failed: "Veiksmo atlikti nepavyko.", saved: "Išsaugota. Puslapis atnaujinamas.", currentEvidence: "Išsaugotas matavimo įrodymas", noCandidates: "Tinkamo pastato kontūro nerasta. Naudokite rankinį plotą be žemėlapio arba pataisykite adresą.",
  },
  en: {
    title: "Verify building and roof area", intro: "Select the correct building and roof slope. Nothing is saved until you confirm it.",
    address: "Address", postal: "Postal code", city: "City", service: "Service", saveIntake: "Save address and service",
    find: "Find buildings", finding: "Searching …", candidates: "Possible buildings", selected: "Selected", area: "Horizontal area", distance: "From address point", confidence: "Confidence",
    slope: "Roof slope", reason: "Reason", reasonHint: "Why is this the correct building and basis?", saveBuilding: "Select this building and recalculate",
    formula: "Preview calculation", manualTitle: "Manual area without map", manualHelp: "Use only when no reliable building outline can be selected. No map image will be attached to the quote.",
    source: "Source", manualArea: "Verified roof area (m²)", createManual: "Save manual area", largeDeviation: "The area differs by more than 20%. Check it again and explicitly confirm.",
    confirmDeviation: "I verified the large difference", approve: "Approve roof measurement", approveSend: "Review full package and send", processing: "Processing …", failed: "The action could not be completed.", saved: "Saved. Refreshing the page.", currentEvidence: "Saved measurement evidence", noCandidates: "No usable building outline was found. Use manual area without map or correct the address.",
  },
} as const;

function CandidateMap({ address, candidates, selectedId, onSelect }: { address?: Address; candidates: Candidate[]; selectedId?: string; onSelect: (id: string) => void }) {
  const projected = useMemo(() => {
    const points = candidates.flatMap((candidate) => candidate.polygon);
    if (address) points.push({ latitude: address.latitude, longitude: address.longitude });
    if (!points.length) return [];
    const minLat = Math.min(...points.map((point) => point.latitude)); const maxLat = Math.max(...points.map((point) => point.latitude));
    const minLon = Math.min(...points.map((point) => point.longitude)); const maxLon = Math.max(...points.map((point) => point.longitude));
    const spanLat = Math.max(maxLat - minLat, 0.00002); const spanLon = Math.max(maxLon - minLon, 0.00002);
    const map = (point: { latitude: number; longitude: number }) => ({ x: 25 + (point.longitude - minLon) / spanLon * 550, y: 25 + (maxLat - point.latitude) / spanLat * 310 });
    return candidates.map((candidate, index) => ({ ...candidate, index: index + 1, points: candidate.polygon.map(map), center: map({ latitude: candidate.polygon.reduce((sum, point) => sum + point.latitude, 0) / candidate.polygon.length, longitude: candidate.polygon.reduce((sum, point) => sum + point.longitude, 0) / candidate.polygon.length }) }));
  }, [address, candidates]);
  if (!projected.length) return null;
  return <svg aria-label="Building candidate map" className="h-auto w-full rounded-2xl border border-white/10 bg-[#0b0f17]" role="img" viewBox="0 0 600 360">
    {projected.map((candidate) => <g className="cursor-pointer" key={candidate.id} onClick={() => onSelect(candidate.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(candidate.id); }}>
      <polygon fill={candidate.id === selectedId ? "#f2a900" : "#344154"} fillOpacity={candidate.id === selectedId ? .72 : .45} points={candidate.points.map((point) => `${point.x},${point.y}`).join(" ")} stroke={candidate.id === selectedId ? "#ffd05b" : "#94a3b8"} strokeWidth={candidate.id === selectedId ? 5 : 2} />
      <circle cx={candidate.center.x} cy={candidate.center.y} fill="#0b0f17" r="15" stroke="#fff"/><text fill="#fff" fontSize="15" fontWeight="700" textAnchor="middle" x={candidate.center.x} y={candidate.center.y + 5}>{candidate.index}</text>
    </g>)}
    <path d="M550 62 L565 24 L580 62 L565 52 Z" fill="#fff"/><text fill="#fff" fontSize="14" textAnchor="middle" x="565" y="80">N</text>
  </svg>;
}

export function MeasurementReviewPanel(props: {
  canApprovePackage: boolean; city?: string; currentAreaTenths?: number; currentBuildingId?: string; currentMode?: string;
  evidenceHref?: string; inquiryType: string; leadAddress: string; leadId: number; locale: PanelLocale; measurementId?: number;
  measurementStatus?: string; postal?: string; revision: number;
}) {
  const copy = text[props.locale];
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); const [notice, setNotice] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]); const [address, setAddress] = useState<Address>();
  const [candidates, setCandidates] = useState<Candidate[]>([]); const [selectedId, setSelectedId] = useState(props.currentBuildingId || "");
  const [requiresLargeConfirmation, setRequiresLargeConfirmation] = useState(false);
  const selected = candidates.find((candidate) => candidate.id === selectedId);
  const [slope, setSlope] = useState(32);
  const slopeFactor = 1 / Math.cos(slope * Math.PI / 180);

  async function jsonAction(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({})) as { error?: string; requiresConfirmation?: boolean; differencePercent?: number };
    if (!response.ok) {
      if (result.requiresConfirmation) setRequiresLargeConfirmation(true);
      throw new Error(result.error || copy.failed);
    }
    return result;
  }

  async function saveIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("intake"); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await jsonAction(`/api/admin/leads/${props.leadId}`, { action: "update_intake", expectedRevision: props.revision, address: form.get("address"), postal: form.get("postal"), city: form.get("city"), inquiryType: form.get("inquiryType") });
      setNotice(copy.saved); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.failed); } finally { setBusy(null); }
  }

  async function loadCandidates() {
    setBusy("candidates"); setNotice("");
    try {
      const response = await fetch(`/api/admin/measurements?leadId=${props.leadId}`);
      const result = await response.json() as { error?: string; addresses?: Address[]; selectedAddress?: Address; candidates?: Candidate[] };
      if (!response.ok) throw new Error(result.error || copy.failed);
      setAddresses(result.addresses || []); setAddress(result.selectedAddress); setCandidates(result.candidates || []);
      if (result.candidates?.some((candidate) => candidate.id === props.currentBuildingId)) setSelectedId(props.currentBuildingId || "");
      else setSelectedId(result.candidates?.[0]?.id || "");
      if (!result.candidates?.length) setNotice(copy.noCandidates);
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.failed); } finally { setBusy(null); }
  }

  async function saveCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!address || !selected) return;
    const form = new FormData(event.currentTarget); setBusy("candidate"); setNotice("");
    try {
      await jsonAction("/api/admin/measurements", { action: "create_from_candidate", leadId: props.leadId, expectedRevision: props.revision, addressId: address.id, buildingId: selected.id, slopeDegrees: slope, reason: form.get("candidateReason") });
      setNotice(copy.saved); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.failed); } finally { setBusy(null); }
  }

  async function saveManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy("manual"); setNotice("");
    try {
      await jsonAction("/api/admin/measurements", { action: "create_manual", leadId: props.leadId, expectedRevision: props.revision, areaSquareMeters: Number(form.get("manualArea")), manualAreaSource: form.get("manualSource"), reason: form.get("manualReason"), confirmLargeDeviation: form.get("confirmLargeDeviation") === "on" });
      setNotice(copy.saved); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.failed); } finally { setBusy(null); }
  }

  async function approveMeasurement() {
    if (!props.measurementId) return; setBusy("approve"); setNotice("");
    try { await jsonAction(`/api/admin/measurements/${props.measurementId}`, { action: "approve" }); setNotice(copy.saved); router.refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : copy.failed); } finally { setBusy(null); }
  }

  async function approveAndSend() {
    if (!window.confirm(copy.approveSend)) return; setBusy("send"); setNotice("");
    try { await jsonAction(`/api/admin/leads/${props.leadId}`, { action: "approve_package" }); setNotice(copy.saved); router.refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : copy.failed); } finally { setBusy(null); }
  }

  return <div className="mt-5 space-y-5 rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:p-5">
    <div><h3 className="font-bold">{copy.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.intro}</p></div>
    {props.evidenceHref && props.currentMode !== "manual_no_visual" ? <figure><figcaption className="mb-2 text-sm font-semibold">{copy.currentEvidence}</figcaption><Image alt={copy.currentEvidence} className="h-auto w-full rounded-2xl border border-white/10" height={800} src={props.evidenceHref} unoptimized width={1200} /></figure> : null}
    <form className="grid gap-3 rounded-2xl border border-white/10 p-4" onSubmit={saveIntake}>
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">{copy.address}<input className="min-h-12 rounded-xl border border-white/15 bg-background px-4" defaultValue={props.leadAddress} name="address" required /></label><label className="grid gap-2 text-sm font-semibold">{copy.postal}<input className="min-h-12 rounded-xl border border-white/15 bg-background px-4" defaultValue={props.postal} inputMode="numeric" name="postal" pattern="[0-9]{4}" required /></label><label className="grid gap-2 text-sm font-semibold">{copy.city}<input className="min-h-12 rounded-xl border border-white/15 bg-background px-4" defaultValue={props.city} name="city" /></label><label className="grid gap-2 text-sm font-semibold">{copy.service}<select className="min-h-12 rounded-xl border border-white/15 bg-background px-4" defaultValue={props.inquiryType} name="inquiryType">{[["takvask","Takvask"],["takvask_impregnering","Takvask + impregnering"],["impregnering","Impregnering"],["takmaling","Takmaling"],["nytt_tak","Nytt tak"],["usikker","Usikker – taksjekk"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
      <button className="min-h-12 rounded-xl border border-white/15 px-4 font-bold hover:border-accent/50" disabled={Boolean(busy)}>{busy === "intake" ? copy.processing : copy.saveIntake}</button>
    </form>
    <button className="min-h-12 w-full rounded-xl border border-accent/50 px-5 font-bold text-accent hover:bg-accent/10" disabled={Boolean(busy)} onClick={() => void loadCandidates()}>{busy === "candidates" ? copy.finding : copy.find}</button>
    {candidates.length ? <form className="space-y-4" onSubmit={saveCandidate}><CandidateMap address={address} candidates={candidates} onSelect={setSelectedId} selectedId={selectedId}/><fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 font-bold">{copy.candidates}</legend>{candidates.map((candidate,index)=><label className={`cursor-pointer rounded-2xl border p-4 ${candidate.id===selectedId ? "border-accent bg-accent/10" : "border-white/10"}`} key={candidate.id}><input checked={candidate.id===selectedId} className="mr-2" name="building" onChange={()=>setSelectedId(candidate.id)} type="radio" value={candidate.id}/><strong>{index+1}. {candidate.label}</strong><span className="mt-2 block text-sm text-muted-foreground">{copy.area}: {candidate.horizontalAreaSquareMeters.toFixed(1)} m² · {copy.distance}: {candidate.distanceToAddressMeters.toFixed(1)} m · {copy.confidence}: {candidate.confidence}</span></label>)}</fieldset><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">{copy.slope}<select className="min-h-12 rounded-xl border border-white/15 bg-background px-4" onChange={(event)=>setSlope(Number(event.target.value))} value={slope}>{[22,27,32,36,40,45].map(value=><option key={value} value={value}>{value}°</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">{copy.reason}<input className="min-h-12 rounded-xl border border-white/15 bg-background px-4" minLength={5} name="candidateReason" placeholder={copy.reasonHint} required/></label></div>{selected?<p className="rounded-xl border border-white/10 p-3 text-sm"><strong>{copy.formula}:</strong> {selected.horizontalAreaSquareMeters.toFixed(1)} m² × {slopeFactor.toFixed(3)} = {(selected.horizontalAreaSquareMeters*slopeFactor).toFixed(1)} m²</p>:null}<button className="min-h-12 w-full rounded-xl bg-accent px-5 font-bold text-accent-foreground" disabled={Boolean(busy)||!selected}>{busy==="candidate"?copy.processing:copy.saveBuilding}</button></form>:null}
    <details className="rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer font-bold text-accent">{copy.manualTitle}</summary><p className="mt-2 text-sm text-muted-foreground">{copy.manualHelp}</p><form className="mt-4 grid gap-3" onSubmit={saveManual}><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">{copy.manualArea}<input className="min-h-12 rounded-xl border border-white/15 bg-background px-4" defaultValue={props.currentAreaTenths ? (props.currentAreaTenths/10).toFixed(1) : ""} inputMode="decimal" max="5000" min="10" name="manualArea" required step="0.1" type="number"/></label><label className="grid gap-2 text-sm font-semibold">{copy.source}<select className="min-h-12 rounded-xl border border-white/15 bg-background px-4" name="manualSource" required><option value="customer">Kunde</option><option value="drawing">Tegning</option><option value="admin_estimate">Administrator</option><option value="onsite">På stedet</option></select></label></div><label className="grid gap-2 text-sm font-semibold">{copy.reason}<textarea className="min-h-24 rounded-xl border border-white/15 bg-background p-4" maxLength={500} minLength={5} name="manualReason" required/></label>{requiresLargeConfirmation?<label className="flex items-start gap-3 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm"><input className="mt-1" name="confirmLargeDeviation" required type="checkbox"/><span><strong>{copy.largeDeviation}</strong><br/>{copy.confirmDeviation}</span></label>:null}<button className="min-h-12 rounded-xl border border-accent/50 px-5 font-bold text-accent" disabled={Boolean(busy)}>{busy==="manual"?copy.processing:copy.createManual}</button></form></details>
    <div className="flex flex-col gap-3 sm:flex-row">{props.measurementId && ["draft","review_required"].includes(props.measurementStatus||"")?<button className="min-h-12 flex-1 rounded-xl border border-accent/50 px-5 font-bold text-accent" disabled={Boolean(busy)} onClick={()=>void approveMeasurement()}>{busy==="approve"?copy.processing:copy.approve}</button>:null}{props.canApprovePackage?<button className="min-h-12 flex-1 rounded-xl bg-accent px-5 font-bold text-accent-foreground" disabled={Boolean(busy)} onClick={()=>void approveAndSend()}>{busy==="send"?copy.processing:copy.approveSend}</button>:null}</div>
    {addresses.length>1?<p className="text-xs text-muted-foreground">{addresses.length} addressetreff ble funnet; første treff i riktig postnummer brukes.</p>:null}
    {notice?<p aria-live="polite" className="text-sm text-muted-foreground" role="status">{notice}</p>:null}
  </div>;
}
