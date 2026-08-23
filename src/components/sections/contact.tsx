"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/ui/reveal";
import { Link, useRouter } from "@/i18n/routing";
import {
  usePageCopy,
  useSiteSettings,
} from "@/components/site-settings-provider";
import {
  TurnstileWidget,
  turnstileConfigured,
} from "@/components/leads/turnstile-widget";
import {
  getMarketingConsentChoice,
  trackLeadConversion,
  trackLeadFormEvent,
} from "@/components/analytics/marketing-analytics";
import { CertificationBadges } from "@/components/trust/certification-badges";
import {
  captureLeadAttribution,
  readContentSource,
  type LeadAttribution,
} from "@/lib/lead-attribution";

const MAX_PHOTOS = 15;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const MAX_EDGE = 1600;
const UPLOAD_CONCURRENCY = 2;

const inquiryTypes = [
  "takvask",
  "takvask_impregnering",
  "impregnering",
  "takmaling",
  "nytt_tak",
  "usikker",
] as const;

type InquiryType = (typeof inquiryTypes)[number];

type PhotoItem = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "ready" | "error";
  url?: string;
  done: Promise<string | null>;
  resolve: (url: string | null) => void;
};

const step1Schema = z.object({
  name: z.string().trim().min(2),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || value.length >= 5),
  postal: z.string().trim().min(3),
  type: z.enum(inquiryTypes),
});

const step2Schema = z.object({
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().max(200).optional(),
  roofSize: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const n = Number(v);
        return Number.isFinite(n) && n >= 1 && n <= 2000;
      },
      { message: "roofSize" },
    ),
  message: z.string().trim().max(5000).optional(),
});

export function hasContactMethod(phone: string, email: string) {
  return Boolean(phone.trim() || email.trim());
}

type FormState = {
  name: string;
  phone: string;
  postal: string;
  type: InquiryType | "";
  email: string;
  address: string;
  roofSize: string;
  message: string;
};

const initial: FormState = {
  name: "",
  phone: "",
  postal: "",
  type: "",
  email: "",
  address: "",
  roofSize: "",
  message: "",
};

function photoKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label} timed out`)),
      ms,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function compressImage(file: File): Promise<File> {
  if (/heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name)) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("HEIC too large");
    }
    return file;
  }

  if (typeof createImageBitmap !== "function") {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("too large");
    return file;
  }

  const bitmap = await withTimeout(createImageBitmap(file), 12_000, "decode");
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("too large");
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.72;
    let blob: Blob | null = null;
    for (let i = 0; i < 4; i += 1) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob) break;
      if (blob.size <= MAX_UPLOAD_BYTES) break;
      quality -= 0.12;
    }

    if (!blob) {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("compress failed");
      return file;
    }

    const base = file.name.replace(/\.[^.]+$/, "") || "tak";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

async function fetchUploadTicket(
  turnstileToken: string | null,
): Promise<string> {
  const res = await withTimeout(
    fetch("/api/lead/upload-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turnstileToken: turnstileToken || undefined,
      }),
    }),
    15_000,
    "upload-ticket",
  );
  const data = (await res.json().catch(() => null)) as {
    ticket?: string;
    error?: string;
  } | null;
  if (!res.ok || !data?.ticket) {
    throw new Error(data?.error || "Could not start upload");
  }
  return data.ticket;
}

async function uploadViaServer(file: File, ticket: string): Promise<string> {
  const prepared = await compressImage(file);
  const body = new FormData();
  body.set("file", prepared);
  body.set("ticket", ticket);

  const res = await withTimeout(
    fetch("/api/lead/photo-upload", { method: "POST", body }),
    45_000,
    "upload",
  );
  const data = (await res.json().catch(() => null)) as {
    url?: string;
    downloadUrl?: string;
    error?: string;
  } | null;
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "Upload failed");
  }
  return data.downloadUrl || data.url;
}

export function ContactSection() {
  const copy = usePageCopy();
  const locale = useLocale() as "no" | "en";
  const router = useRouter();
  const settings = useSiteSettings();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(initial);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photosLimitNotice, setPhotosLimitNotice] = useState<string | null>(
    null,
  );
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState({ website: "", company_url_hp: "" });
  const [consent, setConsent] = useState(false);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoItem[]>([]);
  const queueRef = useRef<PhotoItem[]>([]);
  const activeRef = useRef(0);
  const uploadTicketRef = useRef<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);
  const attributionRef = useRef<LeadAttribution>({});
  const formStartedRef = useRef(false);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => { turnstileTokenRef.current = turnstileToken; }, [turnstileToken]);

  useEffect(() => {
    attributionRef.current = captureLeadAttribution(
      window.location.href,
      document.referrer,
      readContentSource(window.sessionStorage),
    );
  }, []);

  const typeLabels: Record<InquiryType, string> = {
    takvask: copy.contact.form.typeWash,
    takvask_impregnering:
      locale === "no" ? "Takvask + impregnering" : "Roof wash + impregnation",
    impregnering: copy.contact.form.typeImpregnation,
    takmaling: copy.contact.form.typePaint,
    nytt_tak: copy.contact.form.typeNew,
    usikker: copy.contact.form.typeUnsure,
  };

  const ui = {
    choosePhotos: copy.contact.form.choosePhotos,
    noPhotos: copy.contact.form.noPhotos,
    photosSelected: (n: number) =>
      (n === 1
        ? copy.contact.form.photosSelectedOne
        : copy.contact.form.photosSelectedMany
      ).replace("{n}", String(n)),
    photosTooMany: copy.contact.form.photosTooMany,
    photosLimitInline: copy.contact.form.photosLimitInline,
    photoTooLarge: copy.contact.form.photoTooLarge,
    photoUploading: copy.contact.form.photoUploading,
    photoQueued: copy.contact.form.photoQueued,
    photoReady: copy.contact.form.photoReady,
    photoFailed: copy.contact.form.photoFailed,
  };

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function patchPhoto(id: string, patch: Partial<PhotoItem>) {
    setPhotos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function ensureUploadTicket(): Promise<string> {
    if (uploadTicketRef.current) return uploadTicketRef.current;
    const ticket = await fetchUploadTicket(turnstileTokenRef.current);
    uploadTicketRef.current = ticket;
    return ticket;
  }

  function pumpQueue() {
    while (activeRef.current < UPLOAD_CONCURRENCY && queueRef.current.length) {
      const item = queueRef.current.shift();
      if (!item) break;
      activeRef.current += 1;
      patchPhoto(item.id, { status: "uploading" });

      void (async () => {
        try {
          const ticket = await ensureUploadTicket();
          const url = await uploadViaServer(item.file, ticket);
          patchPhoto(item.id, { status: "ready", url });
          item.resolve(url);
        } catch (err) {
          console.error("Photo upload failed:", err);
          // Ticket may have expired — clear so the next attempt refreshes it.
          uploadTicketRef.current = null;
          patchPhoto(item.id, { status: "error" });
          item.resolve(null);
        } finally {
          activeRef.current -= 1;
          pumpQueue();
        }
      })();
    }
  }

  function onPhotosSelected(fileList: FileList | null) {
    const all = Array.from(fileList || []);
    const truncated = all.length > MAX_PHOTOS;
    if (truncated) {
      toast.warning(ui.photosTooMany, { duration: 6000 });
      setPhotosLimitNotice(ui.photosLimitInline);
    } else {
      setPhotosLimitNotice(null);
    }

    const nextFiles = all.slice(0, MAX_PHOTOS);
    if (nextFiles.some((file) => file.size > MAX_SOURCE_BYTES)) {
      toast.error(ui.photoTooLarge);
    }

    queueRef.current = [];
    activeRef.current = 0;

    const next: PhotoItem[] = nextFiles
      .filter((file) => file.size <= MAX_SOURCE_BYTES)
      .map((file) => {
        let resolveDone: (url: string | null) => void = () => {};
        const done = new Promise<string | null>((resolve) => {
          resolveDone = resolve;
        });
        return {
          id: photoKey(file),
          file,
          status: "queued" as const,
          done,
          resolve: resolveDone,
        };
      });

    setPhotos(next);
    queueRef.current = [...next];
    pumpQueue();
  }

  function goNext() {
    const parsed = step1Schema.safeParse({
      name: form.name,
      phone: form.phone,
      postal: form.postal,
      type: form.type,
    });
    if (!parsed.success) {
      trackLeadFormEvent("lead_form_validation_error", {
        step: 1,
        inquiryType: form.type,
        errorType: "required_fields",
      });
      toast.error(copy.contact.form.required);
      return;
    }
    trackLeadFormEvent("lead_form_step_complete", {
      step: 1,
      inquiryType: parsed.data.type,
    });
    setStep(2);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    trackLeadFormEvent("lead_form_submit_attempt", {
      step: 2,
      inquiryType: form.type,
    });

    const step1 = step1Schema.safeParse({
      name: form.name,
      phone: form.phone,
      postal: form.postal,
      type: form.type,
    });
    if (!step1.success) {
      trackLeadFormEvent("lead_form_validation_error", {
        step: 1,
        inquiryType: form.type,
        errorType: "required_fields",
      });
      setStep(1);
      toast.error(copy.contact.form.required);
      return;
    }

    const step2 = step2Schema.safeParse({
      email: form.email,
      address: form.address,
      roofSize: form.roofSize,
      message: form.message,
    });
    if (!step2.success) {
      const issue = step2.error.issues[0];
      if (issue?.path[0] === "email") {
        toast.error(copy.contact.form.invalidEmail);
      } else if (issue?.path[0] === "roofSize") {
        toast.error(copy.contact.form.roofSizeInvalid);
      } else {
        toast.error(copy.contact.form.required);
      }
      trackLeadFormEvent("lead_form_validation_error", {
        step: 2,
        inquiryType: step1.data.type,
        errorType: String(issue?.path[0] || "required_fields"),
      });
      return;
    }

    if (!hasContactMethod(step1.data.phone, step2.data.email || "")) {
      trackLeadFormEvent("lead_form_validation_error", {
        step: 2,
        inquiryType: step1.data.type,
        errorType: "contact_method",
      });
      toast.error(
        locale === "no"
          ? "Oppgi telefon, e-post eller begge."
          : "Enter a phone number, email address, or both.",
      );
      return;
    }

    setLoading(true);
    try {
      if (turnstileConfigured() && !turnstileToken) {
        toast.error(copy.contact.form.securityRequired);
        setLoading(false);
        return;
      }

      if (!consent) {
        toast.error(copy.contact.form.privacyRequired);
        setLoading(false);
        return;
      }

      const consentText = settings.privacy.consentLabel[locale];

      const current = photosRef.current;
      const settled = await Promise.all(current.map((p) => p.done));
      const photoUrls = settled.filter((url): url is string => Boolean(url));
      const failed = settled.length - photoUrls.length;

      if (current.length && !photoUrls.length) {
        throw new Error("All photo uploads failed");
      }

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: step1.data.name,
          phone: step1.data.phone || undefined,
          postal: step1.data.postal,
          type: step1.data.type,
          locale,
          email: step2.data.email || undefined,
          address: step2.data.address || undefined,
          roofSize: step2.data.roofSize || undefined,
          message: step2.data.message || undefined,
          photoUrls: photoUrls.length ? photoUrls : undefined,
          turnstileToken: turnstileToken || undefined,
          consent: true as const,
          consentText,
          ...attributionRef.current,
          marketingConsent: getMarketingConsentChoice(),
          website: honeypot.website,
          company_url_hp: honeypot.company_url_hp,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed");
      }

      trackLeadConversion({ inquiryType: step1.data.type });
      toast.success(copy.contact.form.success);
      if (failed > 0 && photoUrls.length) {
        toast.message(copy.contact.form.partialUpload);
      }
      setForm(initial);
      setPhotos([]);
      setPhotosLimitNotice(null);
      setHoneypot({ website: "", company_url_hp: "" });
      setTurnstileToken(null);
      setConsent(false);
      uploadTicketRef.current = null;
      queueRef.current = [];
      if (photosInputRef.current) photosInputRef.current.value = "";
      setStep(1);
      window.setTimeout(() => router.push("/takk"), 250);
    } catch (err) {
      console.error("Lead submit failed:", err);
      toast.error(copy.contact.form.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="kontakt" className="section-pad bg-background">
      <div className="container-narrow grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="eyebrow">{copy.contact.eyebrow}</p>
          <h2 className="heading-display mt-3 text-balance">
            {copy.contact.title}
          </h2>
          <p className="text-muted-foreground mt-4">{copy.contact.subtitle}</p>

          <ul className="mt-8 space-y-5">
            <li className="flex gap-4">
              <span className="bg-accent-soft text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <Phone className="size-5" />
              </span>
              <div>
                <p className="text-muted-foreground text-sm">
                  {copy.contact.phone}
                </p>
                <a
                  href={settings.phoneHref}
                  className="hover:text-accent text-lg font-semibold"
                >
                  {settings.phone}
                </a>
                <p className="text-muted-foreground text-xs">
                  {copy.contact.hours}
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="bg-accent-soft text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <Mail className="size-5" />
              </span>
              <div>
                <p className="text-muted-foreground text-sm">
                  {copy.contact.email}
                </p>
                <a
                  href={`mailto:${settings.email}`}
                  className="hover:text-accent text-lg font-semibold"
                >
                  {settings.email}
                </a>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="size-3" />
                  {copy.contact.reply}
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="bg-accent-soft text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <MapPin className="size-5" />
              </span>
              <div>
                <p className="text-muted-foreground text-sm">
                  {copy.contact.office}
                </p>
                <p className="font-semibold">
                  {settings.address.street}
                  <br />
                  {settings.address.postal} {settings.address.city}
                </p>
              </div>
            </li>
          </ul>

          <CertificationBadges className="mt-8 max-w-[505px]" />
        </Reveal>

        <Reveal delay={0.1}>
          <form
            onSubmit={onSubmit}
            onFocusCapture={() => {
              if (formStartedRef.current) return;
              formStartedRef.current = true;
              trackLeadFormEvent("lead_form_start", {
                step: 1,
                inquiryType: form.type,
              });
            }}
            className="surface-card relative space-y-4 p-5 sm:p-8"
            noValidate
          >
            <p className="text-muted-foreground text-xs">
              {copy.contact.form.step.replace("{n}", String(step))}
            </p>

            {step === 1 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">{copy.contact.form.name} *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    {locale === "no"
                      ? "Telefon (valgfritt hvis du oppgir e-post)"
                      : "Phone (optional if you provide email)"}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal">{copy.contact.form.postal} *</Label>
                  <Input
                    id="postal"
                    value={form.postal}
                    onChange={(e) => update("postal", e.target.value)}
                    autoComplete="postal-code"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{copy.contact.form.type} *</Label>
                  <select
                    id="type"
                    value={form.type}
                    onChange={(e) =>
                      update("type", e.target.value as InquiryType)
                    }
                    required
                    className="service-select text-foreground focus-visible:border-accent/50 focus-visible:ring-accent/30 flex h-11 w-full rounded-xl border border-white/10 bg-black/50 px-3 text-sm outline-none focus-visible:ring-2"
                  >
                    <option value="" disabled>
                      {locale === "no" ? "VELG TJENESTE" : "CHOOSE A SERVICE"}
                    </option>
                    {inquiryTypes.map((value) => (
                      <option key={value} value={value}>
                        {typeLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={goNext}
                >
                  {copy.contact.form.next}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {locale === "no"
                      ? "E-post (valgfritt hvis du oppgir telefon)"
                      : "Email (optional if you provide phone)"}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">
                    {locale === "no"
                      ? "Adresse (valgfritt)"
                      : "Address (optional)"}
                  </Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    autoComplete="street-address"
                    placeholder={
                      locale === "no"
                        ? "Gateadresse og husnummer"
                        : "Street address and house number"
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    {locale === "no"
                      ? "Adressen hjelper oss å vurdere objektet, men du kan sende inn uten å fylle den ut."
                      : "The address helps us assess the property, but you can submit without it."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roofSize">{copy.contact.form.roofSize}</Label>
                  <Input
                    id="roofSize"
                    name="roofArea"
                    type="number"
                    min={1}
                    max={2000}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.roofSize}
                    onChange={(e) => update("roofSize", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="photos">{copy.contact.form.photos}</Label>
                  <input
                    ref={photosInputRef}
                    id="photos"
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => onPhotosSelected(e.target.files)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loading}
                      onClick={() => photosInputRef.current?.click()}
                    >
                      {ui.choosePhotos}
                    </Button>
                    <span className="text-muted-foreground text-sm">
                      {photos.length
                        ? ui.photosSelected(photos.length)
                        : ui.noPhotos}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {copy.contact.form.photosHint}
                  </p>
                  {photosLimitNotice ? (
                    <p
                      className="text-accent text-xs font-medium"
                      role="status"
                    >
                      {photosLimitNotice}
                    </p>
                  ) : null}
                  {photos.length > 0 ? (
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      {photos.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="truncate">{item.file.name}</span>
                          <span
                            className={
                              item.status === "ready"
                                ? "text-accent shrink-0"
                                : item.status === "error"
                                  ? "shrink-0 text-red-400"
                                  : "shrink-0"
                            }
                          >
                            {item.status === "ready"
                              ? ui.photoReady
                              : item.status === "error"
                                ? ui.photoFailed
                                : item.status === "queued"
                                  ? ui.photoQueued
                                  : ui.photoUploading}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">{copy.contact.form.message}</Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    rows={3}
                  />
                </div>
                {/* Honeypot — hidden from users, bots often fill these. */}
                <div
                  aria-hidden="true"
                  className="absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
                >
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot.website}
                    onChange={(e) =>
                      setHoneypot((prev) => ({
                        ...prev,
                        website: e.target.value,
                      }))
                    }
                  />
                  <label htmlFor="company_url_hp">Company</label>
                  <input
                    id="company_url_hp"
                    name="company_url_hp"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot.company_url_hp}
                    onChange={(e) =>
                      setHoneypot((prev) => ({
                        ...prev,
                        company_url_hp: e.target.value,
                      }))
                    }
                  />
                </div>
                <TurnstileWidget onToken={setTurnstileToken} />
                <label className="text-muted-foreground flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-relaxed">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  <span>
                    {settings.privacy.consentLabel[locale]}{" "}
                    <Link
                      href="/personvern"
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      {settings.privacy.linkLabel[locale]}
                    </Link>
                  </span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    disabled={loading}
                    onClick={() => setStep(1)}
                  >
                    {copy.contact.form.back}
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full flex-1"
                    disabled={loading}
                  >
                    {loading
                      ? copy.contact.form.sending
                      : copy.contact.form.submit}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Reveal>
      </div>
    </section>
  );
}
