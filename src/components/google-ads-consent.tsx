"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

const consentKey = "takfornyelse_google_ads_consent_v1";
const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim();
const reopenEvent = "takfornyelse:open-privacy-choices";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function loadGoogleTag(): void {
  if (!googleAdsId || typeof window === "undefined") return;
  if (document.querySelector(`script[data-google-ads-id="${googleAdsId}"]`)) {
    return;
  }

  window.dataLayer ||= [];
  window.gtag ||= (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag("js", new Date());
  window.gtag("config", googleAdsId, {
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAdsId)}`;
  script.dataset.googleAdsId = googleAdsId;
  document.head.appendChild(script);
}

export function trackGoogleAdsLeadConversion(): void {
  const conversionLabel =
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL?.trim();
  if (!googleAdsId || !conversionLabel || typeof window === "undefined") {
    return;
  }

  try {
    if (window.localStorage.getItem(consentKey) !== "granted") return;
  } catch {
    return;
  }

  loadGoogleTag();
  window.gtag?.("event", "conversion", {
    send_to: `${googleAdsId}/${conversionLabel}`,
  });
}

export function googleAdsMeasurementConfigured(): boolean {
  return Boolean(googleAdsId);
}

export function openGoogleAdsPrivacyChoices(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(reopenEvent));
  }
}

export function GoogleAdsConsent() {
  const locale = useLocale() as "no" | "en";
  const [choice, setChoice] = useState<"granted" | "denied" | null>(null);

  useEffect(() => {
    if (!googleAdsId) return;

    const reopen = () => setChoice(null);
    window.addEventListener(reopenEvent, reopen);

    try {
      const stored = window.localStorage.getItem(consentKey);
      if (stored === "granted" || stored === "denied") {
        setChoice(stored);
        if (stored === "granted") loadGoogleTag();
      }
    } catch {
      setChoice("denied");
    }

    return () => window.removeEventListener(reopenEvent, reopen);
  }, []);

  if (!googleAdsId || choice !== null) return null;

  const decide = (value: "granted" | "denied") => {
    try {
      window.localStorage.setItem(consentKey, value);
    } catch {
      // A blocked storage API behaves like a declined choice.
    }
    setChoice(value);
    if (value === "granted") loadGoogleTag();
  };

  return (
    <aside
      className="bg-background-elevated/95 fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-2xl rounded-2xl border border-white/15 p-5 shadow-2xl backdrop-blur-xl sm:bottom-5"
      aria-label={locale === "no" ? "Personvernvalg" : "Privacy choices"}
    >
      <p className="font-semibold">
        {locale === "no" ? "Valgfri annonsemåling" : "Optional ad measurement"}
      </p>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        {locale === "no"
          ? "Vi ønsker å bruke Google Ads til å måle om annonser fører til henvendelser. Google-koden lastes bare hvis du godtar."
          : "We would like to use Google Ads to measure whether ads lead to enquiries. Google code loads only if you accept."}{" "}
        <Link href="/personvern" className="text-accent hover:underline">
          {locale === "no" ? "Les om personvern" : "Read about privacy"}
        </Link>
      </p>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={() => decide("denied")}
        >
          {locale === "no" ? "Avslå" : "Decline"}
        </Button>
        <Button type="button" onClick={() => decide("granted")}>
          {locale === "no" ? "Godta måling" : "Accept measurement"}
        </Button>
      </div>
    </aside>
  );
}
