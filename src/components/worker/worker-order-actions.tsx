"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getWorkerCopy,
  panelDateLocale,
  type PanelLocale,
} from "@/lib/panel-i18n";

type Props = {
  locale: PanelLocale;
  orderId: number;
  initialStatus: string;
  initialBeforePhotoIds: number[];
  initialAfterPhotoIds: number[];
  initialBlockingReasons: string[];
  initialActualTotalIncVatOre?: number | null;
};

export function WorkerOrderActions(props: Props) {
  const router = useRouter();
  const copy = getWorkerCopy(props.locale);
  const numberLocale = panelDateLocale(props.locale);
  const [status, setStatus] = useState(props.initialStatus);
  const [beforePhotoIds, setBeforePhotoIds] = useState(props.initialBeforePhotoIds);
  const [afterPhotoIds, setAfterPhotoIds] = useState(props.initialAfterPhotoIds);
  const [blockingReasons, setBlockingReasons] = useState(props.initialBlockingReasons);
  const [actualTotal, setActualTotal] = useState(props.initialActualTotalIncVatOre ?? null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function send(body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/worker/work-orders/${props.orderId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; issues?: string[]; status?: string; blockingReasons?: string[]; actualTotalIncVatOre?: number };
      if (!response.ok) throw new Error(result.issues?.join(" ") || result.error || copy.actionFailed);
      if (result.status) setStatus(result.status);
      setBlockingReasons(Array.isArray(result.blockingReasons) ? result.blockingReasons : []);
      if (typeof result.actualTotalIncVatOre === "number") setActualTotal(result.actualTotalIncVatOre);
      setNotice(copy.registered); router.refresh(); return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.actionFailed); return false; }
    finally { setBusy(false); }
  }

  async function upload(phase: "before" | "after", files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true); setNotice("");
    try {
      const uploaded: number[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData(); form.set("phase", phase); form.set("file", file);
        const response = await fetch(`/api/worker/work-orders/${props.orderId}/photos`, { method: "POST", body: form });
        const result = await response.json() as { id?: number; error?: string };
        if (!response.ok || !result.id) throw new Error(result.error || copy.imageUploadFailed);
        uploaded.push(result.id);
      }
      if (phase === "before") setBeforePhotoIds((current) => [...new Set([...current, ...uploaded])]);
      else setAfterPhotoIds((current) => [...new Set([...current, ...uploaded])]);
      setNotice(`${uploaded.length} ${copy.uploaded}`); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.uploadFailed); }
    finally { setBusy(false); }
  }

  async function submitPrecheck(formData: FormData) {
    const area = Number(String(formData.get("actualArea") ?? "").replace(",", "."));
    await send({
      action: "submit_precheck", beforePhotoIds,
      roofType: formData.get("roofType"), actualAreaTenths: Math.round(area * 10), measurementMethod: formData.get("measurementMethod"),
      slopeBasis: formData.get("slopeBasis"), visibleCondition: formData.get("visibleCondition"), safetyStatus: formData.get("safetyStatus"),
      safetyNotes: formData.get("safetyNotes"), scopeChanged: formData.get("scopeChanged") === "on", scopeChangeDetails: formData.get("scopeChangeDetails"),
    });
  }

  return <section className="mt-6 rounded-2xl border border-white/10 bg-background-elevated p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-accent">{copy.workflow}</p><h2 className="mt-1 text-xl font-bold">{copy.status[status as keyof typeof copy.status] ?? status}</h2></div>
      {actualTotal !== null ? <p className="rounded-lg bg-white/5 px-3 py-2 text-sm">{copy.controlPrice}: <strong>{(actualTotal / 100).toLocaleString(numberLocale, { style: "currency", currency: "NOK" })}</strong></p> : null}
    </div>

    {status === "scheduled" ? <ActionButton busy={busy} onClick={() => send({ action: "on_way" })}>{copy.onWay}</ActionButton> : null}
    {status === "on_way" ? <ActionButton busy={busy} onClick={() => send({ action: "arrive" })}>{copy.arrived}</ActionButton> : null}
    {status === "arrived" ? <ActionButton busy={busy} onClick={() => send({ action: "begin_precheck" })}>{copy.startPrecheck}</ActionButton> : null}
    {status === "blocked" ? <div className="mt-5"><div className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm"><strong>{copy.workBlocked}</strong>{blockingReasons.map((reason) => <p className="mt-1" key={reason}>{reason}</p>)}</div><ActionButton busy={busy} onClick={() => send({ action: "begin_precheck" })}>{copy.repeatPrecheck}</ActionButton></div> : null}

    {status === "precheck" ? <form action={submitPrecheck} className="mt-5 grid gap-4">
      <PhotoInput count={beforePhotoIds.length} label={copy.beforePhotos} uploadedLabel={copy.uploadedCount} onChange={(files) => upload("before", files)} />
      <label className="grid gap-1 text-sm font-semibold">{copy.roofType}<select className="min-h-12 rounded-xl border border-white/15 bg-background px-3" name="roofType" required><option value="">{copy.choose}</option>{["betongstein", "teglstein", "metall", "skifer", "shingel", "annet"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">{copy.actualArea}<input className="min-h-12 rounded-xl border border-white/15 bg-background px-3" inputMode="decimal" min="1" name="actualArea" required step="0.1" type="number" /></label>
      <label className="grid gap-1 text-sm font-semibold">{copy.measurementMethod}<select className="min-h-12 rounded-xl border border-white/15 bg-background px-3" name="measurementMethod" required><option value="">{copy.choose}</option>{["laser", "målebånd", "tegning", "kart_kontrollert", "annet"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">{copy.slopeBasis}<input className="min-h-12 rounded-xl border border-white/15 bg-background px-3" maxLength={300} name="slopeBasis" required /></label>
      <label className="grid gap-1 text-sm font-semibold">{copy.visibleCondition}<textarea className="min-h-24 rounded-xl border border-white/15 bg-background p-3" maxLength={2000} name="visibleCondition" required /></label>
      <label className="grid gap-1 text-sm font-semibold">{copy.safetyAccess}<select className="min-h-12 rounded-xl border border-white/15 bg-background px-3" name="safetyStatus" required><option value="safe">{copy.safe}</option><option value="blocked">{copy.unsafe}</option></select></label>
      <label className="grid gap-1 text-sm font-semibold">{copy.safetyComment}<textarea className="min-h-20 rounded-xl border border-white/15 bg-background p-3" maxLength={2000} name="safetyNotes" /></label>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/15 p-3 text-sm font-semibold"><input className="size-5" name="scopeChanged" type="checkbox" />{copy.scopeChanged}</label>
      <label className="grid gap-1 text-sm font-semibold">{copy.scopeDetails}<textarea className="min-h-20 rounded-xl border border-white/15 bg-background p-3" maxLength={2000} name="scopeChangeDetails" /></label>
      <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-50" disabled={busy || beforePhotoIds.length < 2} type="submit">{copy.calculatePrecheck}</button>
    </form> : null}

    {status === "ready" ? <div className="mt-5 rounded-xl border border-green-400/40 bg-green-400/10 p-4"><strong>{copy.readyToStart}</strong><p className="mt-1 text-sm">{copy.withinFrame}</p><ActionButton busy={busy} onClick={() => send({ action: "start" })}>{copy.startWork}</ActionButton></div> : null}
    {status === "in_progress" ? <div className="mt-5 grid gap-4"><PhotoInput count={afterPhotoIds.length} label={copy.afterPhotos} uploadedLabel={copy.uploadedCount} onChange={(files) => upload("after", files)} /><button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-50" disabled={busy || afterPhotoIds.length < 2} onClick={() => send({ action: "mark_completed" })} type="button">{copy.workCompleted}</button></div> : null}
    {status === "completed" ? <form action={async (form) => { await send({ action: "submit_documentation", afterPhotoIds, completionNotes: form.get("completionNotes") }); }} className="mt-5 grid gap-4"><PhotoInput count={afterPhotoIds.length} label={copy.afterPhotos} uploadedLabel={copy.uploadedCount} onChange={(files) => upload("after", files)} /><label className="grid gap-1 text-sm font-semibold">{copy.completionMessage}<textarea className="min-h-28 rounded-xl border border-white/15 bg-background p-3" minLength={10} name="completionNotes" required /></label><button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-50" disabled={busy || afterPhotoIds.length < 2} type="submit">{copy.submitDocumentation}</button></form> : null}
    {status === "documented" ? <p className="mt-5 rounded-xl border border-green-400/40 bg-green-400/10 p-4 font-semibold">{copy.jobDelivered}</p> : null}
    {notice ? <p className="mt-4 text-sm" role="status">{notice}</p> : null}
  </section>;
}

function ActionButton({ busy, children, onClick }: { busy: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className="mt-5 min-h-12 w-full rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-50" disabled={busy} onClick={onClick} type="button">{children}</button>;
}

function PhotoInput({ count, label, uploadedLabel, onChange }: { count: number; label: string; uploadedLabel: string; onChange: (files: FileList | null) => void }) {
  return <label className="grid gap-2 rounded-xl border border-dashed border-white/20 p-4 text-sm font-semibold">{label}<span className="text-muted-foreground">{uploadedLabel}: {count}</span><input accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => onChange(event.target.files)} type="file" /></label>;
}
