import { Archive, CircleX, Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";

const declineCopy = {
  nb: {
    close: "Gå til avslutning av saken",
    comment: "Kundens kommentar",
    description:
      "Tilbudet kan ikke lenger signeres. Velg personlig oppfølging, eller arkiver saken som avslått.",
    email: "Skriv e-post til kunden",
    eyebrow: "Tilbud avslått",
    phone: "Ring kunden",
    reason: "Hovedårsak",
    reasonUnknown: "Årsak ikke oppgitt",
    registered: "Registrert (norsk tid)",
    title: (reference: string) => `Kunden avslo tilbud ${reference}`,
  },
  lt: {
    close: "Pereiti prie bylos uždarymo",
    comment: "Kliento komentaras",
    description:
      "Šio pasiūlymo nebegalima pasirašyti. Susisiekite su klientu asmeniškai arba archyvuokite bylą kaip atsisakytą.",
    email: "Rašyti klientui el. paštu",
    eyebrow: "Klientas atsisakė",
    phone: "Skambinti klientui",
    reason: "Pagrindinė priežastis",
    reasonUnknown: "Priežastis nenurodyta",
    registered: "Užregistruota (Norvegijos laiku)",
    title: (reference: string) => `Klientas atsisakė pasiūlymo ${reference}`,
  },
  en: {
    close: "Go to case closure",
    comment: "Customer comment",
    description:
      "The offer can no longer be signed. Follow up with the customer personally or archive the case as declined.",
    email: "Email the customer",
    eyebrow: "Offer declined",
    phone: "Call the customer",
    reason: "Main reason",
    reasonUnknown: "No reason provided",
    registered: "Registered (Norway time)",
    title: (reference: string) => `Customer declined offer ${reference}`,
  },
} as const;

const reasonCopy = {
  nb: {
    chose_other: "Har valgt en annen leverandør",
    other: "Annen årsak",
    price: "Prisen passer ikke",
    scope: "Tilbudet dekker ikke ønsket behov",
    timing: "Tidspunktet passer ikke",
    unsure: "Er fortsatt usikker",
  },
  lt: {
    chose_other: "Pasirinko kitą paslaugų teikėją",
    other: "Kita priežastis",
    price: "Kaina netinka",
    scope: "Pasiūlymas neatitinka poreikio",
    timing: "Netinka laikas",
    unsure: "Klientas dar nėra apsisprendęs",
  },
  en: {
    chose_other: "Chose another provider",
    other: "Other reason",
    price: "The price does not suit",
    scope: "The offer does not cover the required scope",
    timing: "The timing does not suit",
    unsure: "The customer is still unsure",
  },
} as const;

export function quoteDeclineReasonLabel(locale: PanelLocale, reason?: string) {
  if (!reason) return declineCopy[locale].reasonUnknown;
  return (
    reasonCopy[locale][reason as keyof (typeof reasonCopy)[typeof locale]] ||
    reason
  );
}

export function QuoteDeclineWorkbench(props: {
  caseActions?: ReactNode;
  comment?: string;
  declinedAt?: string;
  email?: string;
  locale: PanelLocale;
  phone?: string;
  reason?: string;
  reference: string;
}) {
  const copy = declineCopy[props.locale];
  const emailSubject = encodeURIComponent(
    `Oppfølging etter avslag på tilbud ${props.reference}`,
  );

  return (
    <article
      aria-labelledby="quote-decline-title"
      className="border-danger/50 bg-danger/10 mt-4 rounded-2xl border p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <CircleX
          aria-hidden="true"
          className="text-danger mt-0.5 size-7 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-danger text-xs font-bold tracking-[.16em] uppercase">
            {copy.eyebrow}
          </p>
          <h2
            className="mt-2 text-xl font-bold break-words sm:text-2xl"
            id="quote-decline-title"
          >
            {copy.title(props.reference)}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">
            {copy.description}
          </p>
        </div>
      </div>

      <dl className="border-danger/25 mt-5 grid gap-3 rounded-xl border bg-black/15 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs font-bold tracking-wider text-white/60 uppercase">
            {copy.reason}
          </dt>
          <dd className="mt-1 font-semibold">
            {quoteDeclineReasonLabel(props.locale, props.reason)}
          </dd>
        </div>
        {props.comment ? (
          <div className="sm:col-span-2 lg:col-span-1">
            <dt className="text-xs font-bold tracking-wider text-white/60 uppercase">
              {copy.comment}
            </dt>
            <dd className="mt-1 break-words whitespace-pre-wrap">
              {props.comment}
            </dd>
          </div>
        ) : null}
        {props.declinedAt ? (
          <div>
            <dt className="text-xs font-bold tracking-wider text-white/60 uppercase">
              {copy.registered}
            </dt>
            <dd className="mt-1 font-semibold">{props.declinedAt}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {props.email ? (
          <a
            className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl bg-white px-4 py-3 font-bold text-black transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            href={`mailto:${props.email}?subject=${emailSubject}`}
          >
            <Mail aria-hidden="true" className="size-5 shrink-0" />
            <span className="min-w-0">
              <span className="block">{copy.email}</span>
              <span className="block text-xs font-medium break-all text-black/65">
                {props.email}
              </span>
            </span>
          </a>
        ) : null}
        {props.phone ? (
          <a
            className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-white/25 px-4 py-3 font-bold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            href={`tel:${props.phone}`}
          >
            <Phone aria-hidden="true" className="size-5 shrink-0" />
            <span className="min-w-0">
              <span className="block">{copy.phone}</span>
              <span className="block text-xs font-medium break-all text-white/65">
                {props.phone}
              </span>
            </span>
          </a>
        ) : null}
        {props.caseActions ? (
          <div className="sm:col-span-2 xl:col-span-3">{props.caseActions}</div>
        ) : (
          <div className="border-danger/35 flex min-h-12 items-center justify-center gap-3 rounded-xl border px-4 py-3 text-center font-bold text-red-100">
            <Archive aria-hidden="true" className="size-5 shrink-0" />
            {copy.close}
          </div>
        )}
      </div>
    </article>
  );
}
