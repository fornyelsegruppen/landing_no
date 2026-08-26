"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";

type OfficialInvoiceItem = {
  id: number;
  reference: string;
  status?: string;
  extractionStatus?: string;
  originalDocumentId?: number;
  invoiceNumber?: string;
  issuedAt?: string;
  dueAt?: string;
  subtotalExVatOre?: number;
  vatOre?: number;
  totalIncVatOre?: number;
  sentAt?: string;
  paidAt?: string;
  paidAmountOre?: number;
  bankReference?: string;
  bankCheckedAt?: string;
  extractedData?: Record<string, unknown>;
};

const copy = {
  nb: { title: "Offisiell Fiken-faktura", upload: "Last opp original Fiken-PDF", uploading: "Laster opp …", approveBasis: "Godkjenn fakturagrunnlaget før du laster opp Fiken-fakturaen.", review: "Kontroller opplysningene fra PDF-en", confirm: "Bekreft fakturaopplysningene", saving: "Lagrer …", number: "Fakturanummer", issued: "Fakturadato", due: "Forfallsdato", subtotal: "Ekskl. mva.", vat: "Mva.", total: "Totalt inkl. mva.", original: "Åpne original PDF", failed: "PDF-feltene kunne ikke leses sikkert. Fyll dem inn manuelt.", saved: "Lagret", send: "Godkjenn og send original PDF", bank: "Bank kontrollert i dag", payment: "Registrer betaling", paidDate: "Betalingsdato", paidAmount: "Mottatt beløp", bankReference: "Bankreferanse (valgfri)", reminder: "Lag betalingspåminnelse til kontroll", reminderHelp: "Påminnelsen opprettes som utkast og sendes aldri uten egen administratorgodkjenning.", checked: "Bank kontrollert", paid: "Betalt" },
  lt: { title: "Oficiali Fiken sąskaita", upload: "Įkelti originalų Fiken PDF", uploading: "Įkeliama…", approveBasis: "Prieš įkeliant Fiken sąskaitą patvirtinkite sąskaitos pagrindą.", review: "Patikrinkite iš PDF nuskaitytus duomenis", confirm: "Patvirtinti sąskaitos duomenis", saving: "Saugoma…", number: "Sąskaitos numeris", issued: "Išrašymo data", due: "Mokėjimo terminas", subtotal: "Be PVM", vat: "PVM", total: "Iš viso su PVM", original: "Atidaryti originalų PDF", failed: "PDF laukų nepavyko patikimai nuskaityti. Įveskite juos ranka.", saved: "Išsaugota", send: "Patvirtinti ir siųsti originalų PDF", bank: "Bankas šiandien patikrintas", payment: "Registruoti mokėjimą", paidDate: "Gavimo data", paidAmount: "Gauta suma", bankReference: "Banko nuoroda (neprivaloma)", reminder: "Paruošti priminimą patikrai", reminderHelp: "Priminimas sukuriamas kaip juodraštis ir niekada nesiunčiamas be atskiro administratoriaus patvirtinimo.", checked: "Bankas patikrintas", paid: "Apmokėta" },
  en: { title: "Official Fiken invoice", upload: "Upload original Fiken PDF", uploading: "Uploading…", approveBasis: "Approve the invoice basis before uploading the Fiken invoice.", review: "Review the fields extracted from the PDF", confirm: "Confirm invoice details", saving: "Saving…", number: "Invoice number", issued: "Invoice date", due: "Due date", subtotal: "Excl. VAT", vat: "VAT", total: "Total incl. VAT", original: "Open original PDF", failed: "The PDF fields could not be read reliably. Enter them manually.", saved: "Saved", send: "Approve and send original PDF", bank: "Bank checked today", payment: "Record payment", paidDate: "Payment date", paidAmount: "Amount received", bankReference: "Bank reference (optional)", reminder: "Prepare reminder for review", reminderHelp: "The reminder is created as a draft and is never sent without separate administrator approval.", checked: "Bank checked", paid: "Paid" },
} as const;

function dateInput(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

function moneyInput(value: unknown) {
  return typeof value === "number" ? (value / 100).toFixed(2) : "";
}

function ore(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

export function OfficialInvoiceManager({ invoiceRecordId, invoiceRecordStatus, items, locale }: { invoiceRecordId: number; invoiceRecordStatus: string; items: OfficialInvoiceItem[]; locale: PanelLocale }) {
  const t = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const activeReview = items.find((item) => item.extractionStatus !== "confirmed" && item.status !== "cancelled");

  async function upload(form: FormData) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/invoice-records/${invoiceRecordId}/official-invoice`, { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed");
      setNotice(t.saved);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(item: OfficialInvoiceItem, form: FormData) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/official-invoices/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "confirm",
        invoiceNumber: form.get("invoiceNumber"),
        issuedAt: form.get("issuedAt"),
        dueAt: form.get("dueAt"),
        subtotalExVatOre: ore(form.get("subtotalExVat")),
        vatOre: ore(form.get("vat")),
        totalIncVatOre: ore(form.get("totalIncVat")),
        adminNote: form.get("adminNote"),
      }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Confirmation failed");
      setNotice(t.saved);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Confirmation failed");
    } finally {
      setBusy(false);
    }
  }

  async function action(item: OfficialInvoiceItem, payload: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/official-invoices/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Action failed");
      setNotice(t.saved);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed");
    } finally { setBusy(false); }
  }

  return <div className="mt-4 grid gap-4 border-t border-white/10 pt-4">
    <h4 className="font-bold text-accent">{t.title}</h4>
    {items.map((item) => {
      const extracted = item.extractedData || {};
      const invoiceNumber = item.invoiceNumber ?? (typeof extracted.invoiceNumber === "string" ? extracted.invoiceNumber : "");
      const issuedAt = item.issuedAt ?? extracted.issuedAt;
      const dueAt = item.dueAt ?? extracted.dueAt;
      const subtotal = item.subtotalExVatOre ?? extracted.subtotalExVatOre;
      const vat = item.vatOre ?? extracted.vatOre;
      const total = item.totalIncVatOre ?? extracted.totalIncVatOre;
      return <article className="rounded-xl border border-white/10 bg-black/15 p-3" key={item.id}>
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.invoiceNumber || item.reference}</strong><span className="rounded-full border border-accent/25 px-2 py-1 text-xs font-bold uppercase text-accent">{item.status}</span></div>
        {item.originalDocumentId ? <a className="mt-2 inline-flex text-sm font-semibold text-accent underline" href={`/api/admin/media/${item.originalDocumentId}`} target="_blank">{t.original}</a> : null}
        {item.extractionStatus !== "confirmed" ? <form action={(form) => void confirm(item, form)} className="mt-4 grid gap-3">
          <p className="text-sm font-semibold">{t.review}</p>
          {item.extractionStatus === "failed" ? <p className="text-sm text-warning">{t.failed}</p> : null}
          <label className="grid gap-1 text-xs font-semibold">{t.number}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={invoiceNumber} name="invoiceNumber" required /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold">{t.issued}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={dateInput(issuedAt)} name="issuedAt" required type="date" /></label><label className="grid gap-1 text-xs font-semibold">{t.due}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={dateInput(dueAt)} name="dueAt" required type="date" /></label></div>
          <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-semibold">{t.subtotal}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={moneyInput(subtotal)} min="0" name="subtotalExVat" required step="0.01" type="number" /></label><label className="grid gap-1 text-xs font-semibold">{t.vat}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={moneyInput(vat)} min="0" name="vat" required step="0.01" type="number" /></label><label className="grid gap-1 text-xs font-semibold">{t.total}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={moneyInput(total)} min="0.01" name="totalIncVat" required step="0.01" type="number" /></label></div>
          <label className="grid gap-1 text-xs font-semibold">Admin note<textarea className="min-h-20 rounded-xl border border-white/10 bg-background p-3 text-sm" name="adminNote" /></label>
          <button className="min-h-11 rounded-xl bg-accent px-4 font-bold text-black disabled:opacity-60" disabled={busy} type="submit">{busy ? t.saving : t.confirm}</button>
        </form> : <div className="mt-3 grid gap-4"><dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">{t.issued}</dt><dd>{dateInput(item.issuedAt)}</dd></div><div><dt className="text-muted-foreground">{t.due}</dt><dd>{dateInput(item.dueAt)}</dd></div><div><dt className="text-muted-foreground">{t.total}</dt><dd>{moneyInput(item.totalIncVatOre)} NOK</dd></div>{item.bankCheckedAt ? <div><dt className="text-muted-foreground">{t.checked}</dt><dd>{new Date(item.bankCheckedAt).toLocaleString()}</dd></div> : null}{item.paidAt ? <div><dt className="text-muted-foreground">{t.paid}</dt><dd>{dateInput(item.paidAt)} · {moneyInput(item.paidAmountOre)} NOK</dd></div> : null}</dl>
          {item.status === "issued" ? <button className="min-h-11 rounded-xl bg-accent px-4 font-bold text-black disabled:opacity-60" disabled={busy} onClick={() => void action(item, { action: "send" })} type="button">{t.send}</button> : null}
          {["sent", "awaiting_payment", "overdue"].includes(item.status || "") ? <div className="grid gap-3 rounded-xl border border-white/10 p-3"><button className="min-h-11 rounded-xl border border-accent/40 px-4 font-bold text-accent disabled:opacity-60" disabled={busy} onClick={() => void action(item, { action: "check_bank" })} type="button">{t.bank}</button><form action={(form) => void action(item, { action: "record_payment", paidAt: form.get("paidAt"), paidAmountOre: ore(form.get("paidAmount")), bankReference: form.get("bankReference") })} className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-semibold">{t.paidDate}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={new Date().toISOString().slice(0, 10)} name="paidAt" required type="date" /></label><label className="grid gap-1 text-xs font-semibold">{t.paidAmount}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" defaultValue={moneyInput(item.totalIncVatOre)} min="0.01" name="paidAmount" required step="0.01" type="number" /></label><label className="grid gap-1 text-xs font-semibold">{t.bankReference}<input className="min-h-11 rounded-xl border border-white/10 bg-background px-3 text-sm" name="bankReference" /></label><button className="min-h-11 rounded-xl bg-accent px-4 font-bold text-black disabled:opacity-60 sm:col-span-3" disabled={busy} type="submit">{t.payment}</button></form><button className="min-h-11 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-60" disabled={busy || !item.bankCheckedAt} onClick={() => void action(item, { action: "draft_reminder" })} type="button">{t.reminder}</button><p className="text-xs text-muted-foreground">{t.reminderHelp}</p></div> : null}
        </div>}
      </article>;
    })}
    {!activeReview && invoiceRecordStatus === "approved" ? <form action={(form) => void upload(form)} className="grid gap-3 rounded-xl border border-dashed border-accent/40 p-3"><label className="grid gap-2 text-sm font-semibold">{t.upload}<input accept="application/pdf,.pdf" className="block w-full text-sm" name="file" required type="file" /></label><button className="min-h-11 rounded-xl border border-accent/50 px-4 font-bold text-accent disabled:opacity-60" disabled={busy} type="submit">{busy ? t.uploading : t.upload}</button></form> : null}
    {invoiceRecordStatus === "draft" ? <p className="text-sm text-muted-foreground">{t.approveBasis}</p> : null}
    {notice ? <p className="text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </div>;
}
