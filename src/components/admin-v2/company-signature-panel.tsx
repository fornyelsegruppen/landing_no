"use client";

import { type FormEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

export function CompanySignaturePanel(props: {
  contractId: number;
  defaultSigner: string;
  documentHash: string;
  locale: PanelLocale;
}) {
  const copy = getAdminCaseCopy(props.locale);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.strokeStyle = "#111827";
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    const context = event.currentTarget.getContext("2d");
    context?.beginPath();
    context?.moveTo(p.x, p.y);
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = point(event);
    const context = event.currentTarget.getContext("2d");
    context?.lineTo(p.x, p.y);
    context?.stroke();
    setHasSignature(true);
  };
  const stop = () => { drawing.current = false; };
  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    const form = new FormData(event.currentTarget);
    const signerName = String(form.get("signerName") || "").trim();
    if (!canvas || !hasSignature || signerName.length < 3) {
      setNotice(copy.signatureRequired);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/contracts/${props.contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName, signatureData: canvas.toDataURL("image/png"), expectedDocumentHash: props.documentHash }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || copy.actionFailed);
      setNotice(copy.actionDone);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="w-full max-w-xl rounded-2xl border border-accent/35 bg-black/20 p-4" onSubmit={submit}>
      <label className="block text-sm font-semibold" htmlFor="companySignerName">{copy.signerName}</label>
      <input className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-background px-4" defaultValue={props.defaultSigner} id="companySignerName" name="signerName" required />
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">{copy.drawSignature}</legend>
        <canvas aria-label={copy.drawSignature} className="mt-2 h-36 w-full touch-none rounded-xl bg-white" onPointerCancel={stop} onPointerDown={start} onPointerMove={move} onPointerUp={stop} ref={canvasRef} />
        <button className="mt-2 min-h-10 text-sm underline" onClick={clear} type="button">{copy.clearSignature}</button>
      </fieldset>
      <button className="mt-3 min-h-12 w-full rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-50" disabled={busy || !hasSignature} type="submit">{busy ? copy.processing : copy.signContract}</button>
      {notice ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
    </form>
  );
}
