"use client";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";

type Display = {
  reference: string; service: string; address: string; estimatedAreaMin: number; estimatedAreaMax: number;
  unitPriceExVatNok: number; subtotalExVatNok: number; vatPercent: number; vatNok: number; totalIncVatNok: number;
  tolerancePercent: number; maximumTotalIncVatNok: number | null; assumptions: string[]; source: string; credits: string;
  validUntil: string; termsVersion: string;
};

const nok = (value: number) => value.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CustomerQuote(props: {
  token: string; quoteStatus: string; contractStatus: string; contractReference: string; documentHash: string;
  customerName: string; display: Display; supplier: { name: string; orgNumber: string; address: string; email: string; phone: string };
  terms: { version: string; text: string; withdrawalInstructions: string; withdrawalFormUrl: string };
  signedAt?: string | null;
  companySignedAt?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [signed, setSigned] = useState(props.contractStatus === "signed");
  const [declined, setDeclined] = useState(props.quoteStatus === "declined");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [earlyStart, setEarlyStart] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d"); if (!context) return;
    context.scale(ratio, ratio); context.lineWidth = 2.5; context.lineCap = "round"; context.strokeStyle = "#111827";
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function start(event: PointerEvent<HTMLCanvasElement>) {
    drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d"); const p = point(event);
    context?.beginPath(); context?.moveTo(p.x, p.y);
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return; const context = event.currentTarget.getContext("2d"); const p = point(event);
    context?.lineTo(p.x, p.y); context?.stroke(); setHasSignature(true);
  }
  function stop() { drawing.current = false; }
  function clearSignature() {
    const canvas = canvasRef.current; const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function submitSign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canvasRef.current || !hasSignature || pending) { setNotice("Tegn signaturen før du fortsetter."); return; }
    const form = new FormData(event.currentTarget); setPending(true); setNotice("");
    try {
      const response = await fetch(`/api/customer/quote/${encodeURIComponent(props.token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "sign", signerName: form.get("signerName"), signatureData: canvasRef.current.toDataURL("image/png"), expectedDocumentHash: props.documentHash,
        paymentObligationAccepted: form.get("payment") === "on", termsAccepted: form.get("terms") === "on",
        withdrawalInformationReceived: form.get("withdrawal") === "on", earlyStartRequested: earlyStart,
        earlyStartLossAcknowledged: earlyStart ? form.get("earlyLoss") === "on" : false,
      }) });
      const result = await response.json() as { error?: string };
      if (response.ok) { setSigned(true); setNotice("Signaturen din er mottatt. Takfornyelse kontrollerer og medsignerer avtalen før den endelige kopien sendes til deg."); }
      else setNotice(result.error ?? "Signeringen kunne ikke fullføres.");
    } catch {
      setNotice("Signeringen kunne ikke fullføres. Kontroller forbindelsen og prøv igjen.");
    } finally {
      setPending(false);
    }
  }

  async function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setPending(true); setNotice("");
    const response = await fetch(`/api/customer/quote/${encodeURIComponent(props.token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "question", message: data.get("message") }) });
    setPending(false); if (response.ok) { form.reset(); setNotice("Spørsmålet er sendt. Vi følger opp så snart som mulig."); } else setNotice("Spørsmålet kunne ikke sendes. Ring oss gjerne.");
  }

  async function decline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/customer/quote/${encodeURIComponent(props.token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", reason: form.get("reason"), comment: form.get("comment") || undefined }),
      });
      if (response.ok) {
        setDeclined(true);
        setDeclineOpen(false);
        setNotice("Takk for tilbakemeldingen. Vi har registrert avslaget og sendt deg en bekreftelse.");
      } else {
        setNotice("Kunne ikke registrere avslaget. Prøv igjen eller kontakt oss direkte.");
      }
    } catch {
      setNotice("Kunne ikke registrere avslaget. Kontroller forbindelsen og prøv igjen.");
    } finally {
      setPending(false);
    }
  }

  const d = props.display;
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
    <header className="mb-8 border-b border-white/10 pb-6">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Takfornyelse</p>
      <h1 className="mt-2 text-3xl font-bold">Tilbud {d.reference}</h1>
      <p className="mt-2 text-muted-foreground">Hei {props.customerName}. Her kan du kontrollere tilbudet og kontrakten før du bestemmer deg.</p>
    </header>
    {notice ? <div className="mb-6 rounded-xl border border-accent/40 bg-accent/10 p-4" role="status" aria-live="polite">{notice}</div> : null}
    {signed ? <section className="mb-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6"><h2 className="text-xl font-bold">{props.companySignedAt ? "Kontrakten er signert av begge parter" : "Signaturen din er mottatt"}</h2><p className="mt-2">{props.companySignedAt ? "Den endelige kontrakten er sendt til e-postadressen din. Vi følger opp planlagt oppstart." : "Takfornyelse kontrollerer og medsignerer avtalen. Du får den endelige kontrakten på e-post når begge parter har signert."}</p><a className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-white px-4 font-bold text-black" href={`/api/customer/quote/${encodeURIComponent(props.token)}/pdf`}>{props.companySignedAt ? "Åpne endelig signert PDF" : "Åpne kundesignert PDF"}</a></section> : null}
    {declined ? <section className="mb-8 rounded-2xl border border-white/15 bg-white/5 p-6"><h2 className="text-xl font-bold">Tilbudet er avslått</h2><p className="mt-2">Takk for tilbakemeldingen. Ta kontakt dersom du ønsker en ny vurdering.</p></section> : null}

    <section className="grid gap-6 rounded-2xl border border-white/10 bg-[#12151c] p-5 sm:grid-cols-2 sm:p-7">
      <div><p className="text-sm text-muted-foreground">Tjeneste</p><p className="text-lg font-bold">{d.service}</p></div>
      <div><p className="text-sm text-muted-foreground">Arbeidssted</p><p className="text-lg font-bold">{d.address}</p></div>
      <div><p className="text-sm text-muted-foreground">Estimert takareal</p><p className="text-lg font-bold">{d.estimatedAreaMin}–{d.estimatedAreaMax} m²</p></div>
      <div><p className="text-sm text-muted-foreground">Enhetspris eks. mva.</p><p className="text-lg font-bold">{nok(d.unitPriceExVatNok)} kr/m²</p></div>
      <div><p className="text-sm text-muted-foreground">Pris eks. mva.</p><p className="text-lg font-bold">{nok(d.subtotalExVatNok)} kr</p></div>
      <div><p className="text-sm text-muted-foreground">Mva. {d.vatPercent}%</p><p className="text-lg font-bold">{nok(d.vatNok)} kr</p></div>
      <div className="sm:col-span-2 rounded-xl bg-accent/10 p-4"><p className="text-sm text-muted-foreground">Pris inkludert mva.</p><p className="text-3xl font-black text-accent">{nok(d.totalIncVatNok)} kr</p>{d.maximumTotalIncVatNok != null ? <p className="mt-2 text-sm">Avtalt maksimalpris inkl. mva.: <strong>{nok(d.maximumTotalIncVatNok)} kr</strong></p> : null}</div>
    </section>

    <section className="mt-8 rounded-2xl border border-white/10 p-5 sm:p-7"><h2 className="text-xl font-bold">Måling og forutsetninger</h2><ul className="mt-4 list-disc space-y-2 pl-5">{d.assumptions.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-4 text-sm text-muted-foreground">Kilde: {d.source}. {d.credits}</p></section>
    <section className="mt-8 rounded-2xl border border-white/10 p-5 sm:p-7"><h2 className="text-xl font-bold">Avtalevilkår og angrerett</h2><p className="mt-4 whitespace-pre-wrap leading-7">{props.terms.text}</p><h3 className="mt-6 font-bold">Angrerett</h3><p className="mt-2 whitespace-pre-wrap leading-7">{props.terms.withdrawalInstructions}</p><a className="mt-4 inline-flex min-h-11 items-center underline" href={props.terms.withdrawalFormUrl} rel="noreferrer" target="_blank">Åpne standard angreskjema</a><div><a className="mt-2 inline-flex min-h-11 items-center underline" href={`/api/customer/quote/${encodeURIComponent(props.token)}/pdf`} target="_blank">Last ned tilbud og kontrakt som PDF</a></div></section>

    {!signed && !declined ? <>
      <form className="mt-8 rounded-2xl border-2 border-accent/50 bg-[#12151c] p-5 sm:p-7" onSubmit={submitSign}>
        <h2 className="text-2xl font-bold">Godta og signer</h2>
        <label className="mt-5 block font-semibold" htmlFor="signerName">Fullt navn</label><input className="mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-black/20 px-4" defaultValue={props.customerName} id="signerName" name="signerName" required />
        <fieldset className="mt-5"><legend className="font-semibold">Tegn signaturen i feltet</legend><canvas aria-label="Signaturfelt" className="mt-2 h-44 w-full touch-none rounded-lg bg-white" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} ref={canvasRef} /><button className="mt-2 min-h-11 underline" onClick={clearSignature} type="button">Tøm signaturfeltet</button></fieldset>
        <div className="mt-5 space-y-4">
          <label className="flex gap-3"><input className="mt-1 size-5 shrink-0" name="terms" required type="checkbox" /><span>Jeg har lest og godtar tilbudet og avtalevilkårene (versjon {props.terms.version}).</span></label>
          <label className="flex gap-3"><input className="mt-1 size-5 shrink-0" name="withdrawal" required type="checkbox" /><span>Jeg har mottatt informasjon om 14 dagers angrerett og standard angreskjema.</span></label>
          <label className="flex gap-3"><input className="mt-1 size-5 shrink-0" name="payment" required type="checkbox" /><span>Jeg forstår at bestillingen medfører plikt til å betale avtalt pris.</span></label>
          <label className="flex gap-3"><input checked={earlyStart} className="mt-1 size-5 shrink-0" onChange={(event) => setEarlyStart(event.target.checked)} type="checkbox" /><span>Jeg ber uttrykkelig om at arbeidet kan starte før angrefristen er utløpt (valgfritt).</span></label>
          {earlyStart ? <label className="flex gap-3"><input className="mt-1 size-5 shrink-0" name="earlyLoss" required type="checkbox" /><span>Jeg forstår at angreretten går tapt når tjenesten er fullt utført, og at jeg kan måtte betale forholdsmessig for arbeid som er utført før jeg angrer.</span></label> : null}
        </div>
        <button className="mt-6 min-h-14 w-full rounded-xl bg-accent px-5 text-base font-black text-black hover:bg-accent-hover disabled:opacity-50" disabled={pending || !hasSignature} type="submit">{pending ? "Signerer …" : "Bestilling med forpliktelse til å betale og signer"}</button>
      </form>
      <form className="mt-8 rounded-2xl border border-white/10 p-5 sm:p-7" onSubmit={sendQuestion}><h2 className="text-xl font-bold">Har du spørsmål?</h2><textarea className="mt-4 min-h-28 w-full rounded-lg border border-white/20 bg-white/5 p-4" maxLength={2000} name="message" required /><button className="mt-3 min-h-12 rounded-lg border border-white/20 px-5 font-bold" disabled={pending} type="submit">Send spørsmål</button></form>
      {!declineOpen ? <button className="mt-8 min-h-12 text-sm text-muted-foreground underline" disabled={pending} onClick={() => setDeclineOpen(true)} type="button">Jeg ønsker å avslå tilbudet</button> : (
        <form className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-5 sm:p-7" onSubmit={decline}>
          <h2 className="text-xl font-bold">Før du avslår</h2>
          <p className="mt-2 text-sm text-muted-foreground">Fortell gjerne hva som gjorde at tilbudet ikke passer. Det hjelper oss å følge opp på en bedre måte.</p>
          <label className="mt-5 block font-semibold" htmlFor="declineReason">Hva er hovedårsaken?</label>
          <select className="mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-[#12151c] px-4" id="declineReason" name="reason" required defaultValue="">
            <option disabled value="">Velg årsak</option>
            <option value="price">Prisen passer ikke</option>
            <option value="timing">Tidspunktet passer ikke</option>
            <option value="chose_other">Jeg har valgt en annen leverandør</option>
            <option value="unsure">Jeg er fortsatt usikker</option>
            <option value="scope">Tilbudet dekker ikke det jeg trenger</option>
            <option value="other">Annen årsak</option>
          </select>
          <label className="mt-5 block font-semibold" htmlFor="declineComment">Kommentar (valgfritt)</label>
          <textarea className="mt-2 min-h-24 w-full rounded-lg border border-white/20 bg-[#12151c] p-4" id="declineComment" maxLength={1500} name="comment" />
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="min-h-12 rounded-lg border border-red-400/50 px-5 font-bold text-red-200 disabled:opacity-50" disabled={pending} type="submit">{pending ? "Registrerer …" : "Bekreft at jeg avslår"}</button>
            <button className="min-h-12 rounded-lg border border-white/20 px-5" disabled={pending} onClick={() => setDeclineOpen(false)} type="button">Avbryt</button>
          </div>
        </form>
      )}
    </> : null}
    <footer className="mt-12 border-t border-white/10 pt-6 text-sm text-muted-foreground"><p>{props.supplier.name} · Org.nr. {props.supplier.orgNumber}</p><p>{props.supplier.address} · {props.supplier.email} · {props.supplier.phone}</p></footer>
  </main>;
}
