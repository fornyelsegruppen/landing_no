"use client";

import {
  FormEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { norwayDateKey } from "@/lib/norway-time";

type Display = {
  reference: string;
  service: string;
  address: string;
  estimatedAreaMin: number;
  estimatedAreaMax: number;
  unitPriceExVatNok: number;
  subtotalExVatNok: number;
  vatPercent: number;
  vatNok: number;
  totalIncVatNok: number;
  tolerancePercent: number;
  maximumTotalIncVatNok: number | null;
  assumptions: string[];
  source: string;
  credits: string;
  validUntil: string;
  termsVersion: string;
  measurementReference: string;
  measurement: {
    id: number;
    version: number;
    inputHash: string;
    horizontalAreaTenths: number;
    actualAreaMinTenths: number;
    actualAreaMaxTenths: number;
    mode?:
      "legacy" | "schematic" | "schematic_with_context" | "manual_no_visual";
    buildingIdentifier?: string;
    evidenceAttribution?: string;
    angleMinDegrees?: number;
    angleMaxDegrees?: number;
    approvedByName?: string;
    approvedAt?: string;
    manualAreaSource?: string;
    manualAreaReason?: string;
  };
};

const nok = (value: number) =>
  value.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function LegalDisclosure(props: {
  pdfHref: string;
  terms: {
    version: string;
    text: string;
    withdrawalInstructions: string;
    withdrawalFormUrl: string;
  };
}) {
  return (
    <section
      aria-labelledby="legal-disclosure-title"
      className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5"
    >
      <h3 className="text-lg font-bold" id="legal-disclosure-title">
        Viktig før signering
      </h3>
      <p className="text-muted-foreground mt-2 text-sm">Kort oppsummert:</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
        <li>
          Avtalen gjelder tjenesten, arbeidsstedet og prisene som er vist
          ovenfor.
        </li>
        <li>
          Takarealet kontrolleres på stedet. Arbeid over maksimalprisen krever
          en ny skriftlig avtale.
        </li>
        <li>Du har normalt 14 dagers angrerett ved fjernsalg.</li>
      </ul>

      <div className="mt-4 grid gap-3">
        <details className="group rounded-xl border border-white/10 bg-white/[.03]">
          <summary className="focus-visible:outline-accent flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
            <span>Les fullstendige avtalevilkår</span>
            <svg
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </summary>
          <div className="text-muted-foreground border-t border-white/10 px-4 py-5 text-sm leading-7 whitespace-pre-wrap">
            {props.terms.text}
          </div>
        </details>

        <details className="group rounded-xl border border-white/10 bg-white/[.03]">
          <summary className="focus-visible:outline-accent flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
            <span>Les informasjon om angrerett</span>
            <svg
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </summary>
          <div className="text-muted-foreground border-t border-white/10 px-4 py-5 text-sm leading-7 whitespace-pre-wrap">
            {props.terms.withdrawalInstructions}
          </div>
        </details>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a
          className="border-accent/50 text-accent hover:bg-accent/10 inline-flex min-h-12 items-center justify-center rounded-xl border px-4 text-center font-semibold"
          href={props.pdfHref}
          target="_blank"
        >
          Last ned tilbud og kontrakt som PDF
        </a>
        <a
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-4 text-center font-semibold hover:bg-white/5"
          href="/no/angreskjema"
          target="_blank"
        >
          Åpne standard angreskjema
        </a>
      </div>
      <p className="text-muted-foreground mt-3 text-xs leading-5">
        Dette er et standard angreskjema som du skal motta før du bestemmer deg.
        Du trenger bare å bruke det dersom du inngår avtalen og senere ønsker å
        gå fra den.
      </p>
    </section>
  );
}

export function CustomerQuote(props: {
  token: string;
  quoteStatus: string;
  contractStatus: string;
  contractReference: string;
  documentHash: string;
  customerName: string;
  display: Display;
  supplier: {
    name: string;
    orgNumber: string;
    address: string;
    email: string;
    phone: string;
  };
  terms: {
    version: string;
    text: string;
    withdrawalInstructions: string;
    withdrawalFormUrl: string;
  };
  signedAt?: string | null;
  companySignedAt?: string | null;
  optionKind?: string | null;
  measurementEvidenceHref?: string;
  questionPending?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const followUpDateRef = useRef<HTMLInputElement>(null);
  const questionSuccessRef = useRef<HTMLElement>(null);
  const questionCounterRef = useRef<HTMLOutputElement>(null);
  const questionSubmissionKey = useRef<string | null>(null);
  const questionStatusCheck = useRef(false);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [questionPending, setQuestionPending] = useState(
    Boolean(props.questionPending),
  );
  const [questionSent, setQuestionSent] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questionError, setQuestionError] = useState("");
  const [questionResolved, setQuestionResolved] = useState(false);
  const [checkingQuestionStatus, setCheckingQuestionStatus] = useState(false);
  const [signed, setSigned] = useState(props.contractStatus === "signed");
  const [declined, setDeclined] = useState(props.quoteStatus === "declined");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [earlyStart, setEarlyStart] = useState(false);
  const [contractRequestOpen, setContractRequestOpen] = useState<
    "withdrawal" | "change_or_cancel" | null
  >(null);
  const [contractRequestReason, setContractRequestReason] = useState("");
  const [followUpConsent, setFollowUpConsent] = useState(false);
  const [doNotContact, setDoNotContact] = useState(false);
  const [followUpChoice, setFollowUpChoice] = useState("");

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
  }, [declined, questionPending, signed]);

  const checkQuestionStatus = useCallback(
    async (announceFailure = false) => {
      if (!questionPending || questionStatusCheck.current) return;
      questionStatusCheck.current = true;
      if (announceFailure) setCheckingQuestionStatus(true);
      try {
        const response = await fetch(
          `/api/customer/quote/${encodeURIComponent(props.token)}`,
          { cache: "no-store" },
        );
        const result = (await response.json().catch(() => ({}))) as {
          questionPending?: boolean;
        };
        if (response.ok && result.questionPending === false) {
          setQuestionPending(false);
          setQuestionSent(false);
          setQuestionResolved(true);
          setQuestionError("");
          window.requestAnimationFrame(() => {
            questionSuccessRef.current?.focus();
            questionSuccessRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          });
        } else if (!response.ok && announceFailure) {
          setQuestionError(
            "Vi kunne ikke kontrollere status nå. Prøv igjen om litt.",
          );
        }
      } catch {
        if (announceFailure) {
          setQuestionError(
            "Vi kunne ikke kontrollere status nå. Kontroller forbindelsen og prøv igjen.",
          );
        }
      } finally {
        questionStatusCheck.current = false;
        if (announceFailure) setCheckingQuestionStatus(false);
      }
    },
    [props.token, questionPending],
  );

  useEffect(() => {
    if (!questionPending) return;
    const onFocus = () => void checkQuestionStatus();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkQuestionStatus();
    };
    const interval = window.setInterval(
      () => void checkQuestionStatus(),
      30_000,
    );
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkQuestionStatus, questionPending]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function start(event: PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d");
    const p = point(event);
    context?.beginPath();
    context?.moveTo(p.x, p.y);
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    const p = point(event);
    context?.lineTo(p.x, p.y);
    context?.stroke();
    setHasSignature(true);
  }
  function stop() {
    drawing.current = false;
  }
  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function submitSign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canvasRef.current || !hasSignature || pending) {
      setNotice("Tegn signaturen før du fortsetter.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/customer/quote/${encodeURIComponent(props.token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sign",
            signatureData: canvasRef.current.toDataURL("image/png"),
            expectedDocumentHash: props.documentHash,
            paymentObligationAccepted: form.get("payment") === "on",
            termsAccepted: form.get("terms") === "on",
            withdrawalInformationReceived: form.get("withdrawal") === "on",
            earlyStartRequested: earlyStart,
            earlyStartLossAcknowledged: earlyStart
              ? form.get("earlyLoss") === "on"
              : false,
          }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (response.ok) {
        setSigned(true);
        setNotice(
          "Signaturen din er mottatt. Takfornyelse kontrollerer og medsignerer avtalen før den endelige kopien sendes til deg.",
        );
      } else setNotice(result.error ?? "Signeringen kunne ikke fullføres.");
    } catch {
      setNotice(
        "Signeringen kunne ikke fullføres. Kontroller forbindelsen og prøv igjen.",
      );
    } finally {
      setPending(false);
    }
  }

  async function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || questionPending) return;
    const message = questionText.trim();
    if (message.length < 5) {
      setQuestionError("Skriv minst fem tegn før du sender spørsmålet.");
      return;
    }
    const submissionKey =
      questionSubmissionKey.current || window.crypto.randomUUID();
    questionSubmissionKey.current = submissionKey;
    setPending(true);
    setQuestionError("");
    try {
      const response = await fetch(
        `/api/customer/quote/${encodeURIComponent(props.token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "question",
            message,
            submissionKey,
          }),
        },
      );
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            "For mange forsøk på kort tid. Vent litt før du prøver igjen.",
          );
        }
        throw new Error(
          "Spørsmålet kunne ikke sendes. Prøv igjen eller kontakt oss direkte.",
        );
      }
      setQuestionText("");
      questionSubmissionKey.current = null;
      setQuestionPending(true);
      setQuestionSent(true);
      setQuestionResolved(false);
      window.requestAnimationFrame(() => {
        questionSuccessRef.current?.focus();
        questionSuccessRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    } catch (error) {
      setQuestionError(
        error instanceof Error
          ? error.message
          : "Spørsmålet kunne ikke sendes. Prøv igjen eller kontakt oss direkte.",
      );
    } finally {
      setPending(false);
    }
  }

  async function decline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/customer/quote/${encodeURIComponent(props.token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "decline",
            reason: form.get("reason"),
            comment: form.get("comment") || undefined,
          }),
        },
      );
      if (response.ok) {
        setDeclined(true);
        setDeclineOpen(false);
        setNotice(
          "Takk for tilbakemeldingen. Vi har registrert avslaget og sendt deg en bekreftelse.",
        );
      } else {
        setNotice(
          "Kunne ikke registrere avslaget. Prøv igjen eller kontakt oss direkte.",
        );
      }
    } catch {
      setNotice(
        "Kunne ikke registrere avslaget. Kontroller forbindelsen og prøv igjen.",
      );
    } finally {
      setPending(false);
    }
  }

  async function submitContractRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!contractRequestOpen) return;
    setPending(true);
    setNotice("");
    try {
      const customDate = data.get("preferredFollowUpAt");
      const response = await fetch(
        `/api/customer/quote/${encodeURIComponent(props.token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: contractRequestOpen,
            reasonCode: data.get("reasonCode"),
            reasonText: data.get("reasonText") || undefined,
            followUpConsent: followUpConsent && !doNotContact,
            preferredFollowUp: doNotContact
              ? "never"
              : followUpConsent
                ? data.get("preferredFollowUp") || undefined
                : undefined,
            preferredFollowUpAt:
              followUpConsent && followUpChoice === "custom" && customDate
                ? new Date(`${String(customDate)}T12:00:00Z`).toISOString()
                : undefined,
          }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        requestReference?: string;
      };
      if (!response.ok) throw new Error(result.error || "request failed");
      form.reset();
      setContractRequestOpen(null);
      setContractRequestReason("");
      setFollowUpConsent(false);
      setDoNotContact(false);
      setFollowUpChoice("");
      setNotice(
        contractRequestOpen === "withdrawal"
          ? `Angremeldingen er mottatt${result.requestReference ? ` (${result.requestReference})` : ""}. Eventuell arbeidsstart er satt på pause, og en mottaksbekreftelse er sendt på e-post.`
          : `Forespørselen er mottatt${result.requestReference ? ` (${result.requestReference})` : ""}. Eventuell arbeidsstart er satt på pause mens vi vurderer saken.`,
      );
    } catch {
      setNotice(
        "Meldingen kunne ikke registreres. Kontakt oss på telefon eller e-post.",
      );
    } finally {
      setPending(false);
    }
  }

  const d = props.display;
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 border-b border-white/10 pb-6">
        <p className="text-accent text-xs font-bold tracking-[.18em] uppercase">
          Takfornyelse
        </p>
        <h1 className="mt-2 text-3xl font-bold">Tilbud {d.reference}</h1>
        {props.optionKind ? (
          <p className="border-accent/35 bg-accent/10 text-accent mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-bold">
            {props.optionKind === "recommended"
              ? "Anbefalt alternativ"
              : "Opprinnelig forespørsel"}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-2">
          Hei {props.customerName}. Her kan du kontrollere tilbudet og
          kontrakten før du bestemmer deg.
        </p>
      </header>
      {notice ? (
        <div
          className="border-accent/40 bg-accent/10 mb-6 rounded-xl border p-4"
          role="status"
          aria-live="polite"
        >
          {notice}
        </div>
      ) : null}
      {signed ? (
        <section className="mb-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6">
          <h2 className="text-xl font-bold">
            {props.companySignedAt
              ? "Kontrakten er signert av begge parter"
              : "Signaturen din er mottatt"}
          </h2>
          <p className="mt-2">
            {props.companySignedAt
              ? "Den endelige kontrakten er sendt til e-postadressen din. Vi følger opp planlagt oppstart."
              : "Takfornyelse kontrollerer og medsignerer avtalen. Du får den endelige kontrakten på e-post når begge parter har signert."}
          </p>
          <a
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-white px-4 font-bold text-black"
            href={`/api/customer/quote/${encodeURIComponent(props.token)}/pdf`}
          >
            {props.companySignedAt
              ? "Åpne endelig signert PDF"
              : "Åpne kundesignert PDF"}
          </a>
        </section>
      ) : null}
      {declined ? (
        <section className="mb-8 rounded-2xl border border-white/15 bg-white/5 p-6">
          <h2 className="text-xl font-bold">Tilbudet er avslått</h2>
          <p className="mt-2">
            Takk for tilbakemeldingen. Ta kontakt dersom du ønsker en ny
            vurdering.
          </p>
        </section>
      ) : null}

      <section className="grid gap-6 rounded-2xl border border-white/10 bg-[#12151c] p-5 sm:grid-cols-2 sm:p-7">
        <div>
          <p className="text-muted-foreground text-sm">Tjeneste</p>
          <p className="text-lg font-bold">{d.service}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Arbeidssted</p>
          <p className="text-lg font-bold">{d.address}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Estimert takareal</p>
          <p className="text-lg font-bold">
            {d.estimatedAreaMin}–{d.estimatedAreaMax} m²
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Enhetspris eks. mva.</p>
          <p className="text-lg font-bold">{nok(d.unitPriceExVatNok)} kr/m²</p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Pris eks. mva.</p>
          <p className="text-lg font-bold">{nok(d.subtotalExVatNok)} kr</p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Mva. {d.vatPercent}%</p>
          <p className="text-lg font-bold">{nok(d.vatNok)} kr</p>
        </div>
        <div className="bg-accent/10 rounded-xl p-4 sm:col-span-2">
          <p className="text-muted-foreground text-sm">Pris inkludert mva.</p>
          <p className="text-accent text-3xl font-black">
            {nok(d.totalIncVatNok)} kr
          </p>
          {d.maximumTotalIncVatNok != null ? (
            <p className="mt-2 text-sm">
              Avtalt maksimalpris inkl. mva.:{" "}
              <strong>{nok(d.maximumTotalIncVatNok)} kr</strong>
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 p-5 sm:p-7">
        <h2 className="text-xl font-bold">Beregnet tak</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Måleversjon:</span>{" "}
            <strong>{d.measurementReference}</strong>
          </p>
          {d.measurement.buildingIdentifier ? (
            <p>
              <span className="text-muted-foreground">Valgt bygg:</span>{" "}
              <strong>{d.measurement.buildingIdentifier}</strong>
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Horisontalt areal:</span>{" "}
            <strong>{d.measurement.horizontalAreaTenths / 10} m²</strong>
          </p>
          {d.measurement.angleMinDegrees != null &&
          d.measurement.angleMaxDegrees != null ? (
            <p>
              <span className="text-muted-foreground">Takvinkel:</span>{" "}
              <strong>
                {d.measurement.angleMinDegrees}–{d.measurement.angleMaxDegrees}°
              </strong>
            </p>
          ) : null}
        </div>
        {props.measurementEvidenceHref ? (
          <Image
            alt="Skjematisk visning av valgt tak"
            className="mt-5 h-auto w-full rounded-xl border border-white/10"
            height={800}
            src={props.measurementEvidenceHref}
            unoptimized
            width={1200}
          />
        ) : null}
        {d.measurement.mode === "manual_no_visual" ? (
          <div className="border-accent/30 bg-accent/10 mt-5 rounded-xl border p-4">
            <p className="font-bold">
              Manuelt kontrollert takareal uten kartvedlegg
            </p>
            <p className="mt-2">
              Grunnlag: {d.measurement.manualAreaSource || "administrator"}.{" "}
              {d.measurement.manualAreaReason}
            </p>
            {d.measurement.approvedAt ? (
              <p className="text-muted-foreground mt-2 text-sm">
                Kontrollert{" "}
                {new Date(d.measurement.approvedAt).toLocaleString("nb-NO")} av{" "}
                {d.measurement.approvedByName || "Takfornyelse administrator"}.
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="mt-5">
          Takareal og takvinkel kontrolleres på stedet før arbeid starter. Et
          vesentlig avvik utover avtalt toleranse eller maksimalpris krever en
          skriftlig endringsavtale før arbeidet fortsetter.
        </p>
        <h3 className="mt-6 font-bold">Forutsetninger</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {d.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-4 text-sm">
          Kilde: {d.source}. {d.measurement.evidenceAttribution || d.credits}
        </p>
      </section>
      {!declined ? (
        questionPending ? (
          <section
            aria-live="polite"
            className="mt-8 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5 sm:p-7"
            ref={(element) => {
              questionSuccessRef.current = element;
            }}
            role="status"
            tabIndex={-1}
          >
            <p className="text-xs font-bold tracking-[.16em] text-amber-200 uppercase">
              Signering er satt på pause
            </p>
            <h2 className="mt-2 text-xl font-bold">
              {questionSent
                ? "Spørsmålet er sendt"
                : "Vi har mottatt spørsmålet ditt"}
            </h2>
            <p className="text-muted-foreground mt-2 leading-6">
              Vi svarer på e-post etter at Takfornyelse har kontrollert saken.
              Signering åpnes automatisk her når svaret er levert.
            </p>
            <button
              className="mt-4 min-h-12 w-full rounded-xl border border-white/20 px-5 font-bold hover:bg-white/5 disabled:opacity-50 sm:w-auto"
              disabled={checkingQuestionStatus}
              onClick={() => void checkQuestionStatus(true)}
              type="button"
            >
              {checkingQuestionStatus
                ? "Kontrollerer status …"
                : "Sjekk om svaret er klart"}
            </button>
            {questionError ? (
              <p
                className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-100"
                role="alert"
              >
                {questionError}
              </p>
            ) : null}
          </section>
        ) : (
          <section className="mt-8">
            {questionResolved ? (
              <div
                className="mb-4 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 p-5 sm:p-7"
                ref={(element) => {
                  questionSuccessRef.current = element;
                }}
                tabIndex={-1}
              >
                <h2 className="text-xl font-bold">Svaret er levert</h2>
                <p className="text-muted-foreground mt-2 leading-6">
                  Du kan nå kontrollere dokumentet og fortsette til signering
                  nedenfor.
                </p>
              </div>
            ) : null}
            <form
              className="rounded-2xl border border-white/10 p-5 sm:p-7"
              onSubmit={sendQuestion}
            >
              <h2 className="text-xl font-bold">Har du spørsmål?</h2>
              <p
                className="text-muted-foreground mt-2 text-sm leading-6"
                id="customer-question-help"
              >
                Send spørsmålet før du signerer. Vi svarer på e-post etter at
                saken er kontrollert.
              </p>
              <label
                className="mt-4 block font-semibold"
                htmlFor="customer-question"
              >
                Hva lurer du på?
              </label>
              <textarea
                aria-describedby="customer-question-help customer-question-count"
                className="mt-2 min-h-28 w-full rounded-lg border border-white/20 bg-white/5 p-4"
                id="customer-question"
                maxLength={2000}
                minLength={5}
                name="message"
                onInput={(event) => {
                  const value = event.currentTarget.value;
                  setQuestionText(value);
                  if (questionCounterRef.current) {
                    questionCounterRef.current.value = `${value.length} / 2000`;
                  }
                  questionSubmissionKey.current = null;
                  if (questionError) setQuestionError("");
                }}
                required
                value={questionText}
              />
              <output
                aria-live="polite"
                className="text-muted-foreground mt-1 block text-right text-xs"
                htmlFor="customer-question"
                id="customer-question-count"
                ref={questionCounterRef}
              >
                {questionText.length} / 2000
              </output>
              {questionError ? (
                <p
                  className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-100"
                  role="alert"
                >
                  {questionError} Kontakt oss på{` `}
                  <a
                    className="font-bold underline"
                    href={`tel:${props.supplier.phone.replace(/\s/g, "")}`}
                  >
                    {props.supplier.phone}
                  </a>
                  {` `}
                  eller{` `}
                  <a
                    className="font-bold underline"
                    href={`mailto:${props.supplier.email}`}
                  >
                    e-post
                  </a>
                  .
                </p>
              ) : null}
              <button
                className="mt-3 min-h-12 w-full rounded-lg border border-white/20 px-5 font-bold hover:bg-white/5 disabled:opacity-50 sm:w-auto"
                disabled={pending || questionText.trim().length < 5}
                type="submit"
              >
                {pending ? "Sender …" : "Send spørsmål"}
              </button>
            </form>
          </section>
        )
      ) : null}
      {!signed && !declined ? (
        <>
          {!questionPending ? (
            <form
              className="border-accent/50 mt-8 rounded-2xl border-2 bg-[#12151c] p-5 sm:p-7"
              onSubmit={submitSign}
            >
              <h2 className="text-2xl font-bold">Godta og signer</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Kontroller sammendraget og velg selv om du vil åpne den
                fullstendige teksten før du bekrefter.
              </p>
              <div className="mt-5">
                <LegalDisclosure
                  pdfHref={`/api/customer/quote/${encodeURIComponent(props.token)}/pdf`}
                  terms={props.terms}
                />
              </div>
              <div className="mt-5 space-y-4 rounded-2xl border border-white/10 p-4 sm:p-5">
                <label className="flex gap-3">
                  <input
                    className="mt-1 size-5 shrink-0"
                    name="terms"
                    required
                    type="checkbox"
                  />
                  <span>
                    Jeg har lest og godtar tilbudet og avtalevilkårene.
                  </span>
                </label>
                <label className="flex gap-3">
                  <input
                    className="mt-1 size-5 shrink-0"
                    name="withdrawal"
                    required
                    type="checkbox"
                  />
                  <span>
                    Jeg har mottatt informasjon om 14 dagers angrerett og
                    standard angreskjema.
                  </span>
                </label>
                <label className="flex gap-3">
                  <input
                    className="mt-1 size-5 shrink-0"
                    name="payment"
                    required
                    type="checkbox"
                  />
                  <span>
                    Jeg forstår at bestillingen medfører plikt til å betale
                    avtalt pris.
                  </span>
                </label>
                <label className="flex gap-3">
                  <input
                    checked={earlyStart}
                    className="mt-1 size-5 shrink-0"
                    onChange={(event) => setEarlyStart(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Jeg ber uttrykkelig om at arbeidet kan starte før
                    angrefristen er utløpt (valgfritt).
                  </span>
                </label>
                {earlyStart ? (
                  <label className="flex gap-3">
                    <input
                      className="mt-1 size-5 shrink-0"
                      name="earlyLoss"
                      required
                      type="checkbox"
                    />
                    <span>
                      Jeg forstår at angreretten går tapt når tjenesten er fullt
                      utført, og at jeg kan måtte betale forholdsmessig for
                      arbeid som er utført før jeg angrer.
                    </span>
                  </label>
                ) : null}
              </div>
              <div className="mt-5">
                <p className="font-semibold">Avtalepart og underskriver</p>
                <p
                  className="mt-2 min-h-12 rounded-lg border border-white/20 bg-black/20 px-4 py-3 font-bold"
                  aria-label="Navn på avtalepart"
                >
                  {props.customerName}
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Navnet er hentet fra henvendelsen og låst til dette
                  dokumentet. Kontakt Takfornyelse før signering dersom navnet
                  må korrigeres.
                </p>
              </div>
              <fieldset className="mt-5">
                <legend className="font-semibold">
                  Tegn signaturen i feltet
                </legend>
                <canvas
                  aria-label="Signaturfelt"
                  className="mt-2 h-44 w-full touch-none rounded-lg bg-white"
                  onPointerDown={start}
                  onPointerMove={move}
                  onPointerUp={stop}
                  onPointerCancel={stop}
                  ref={canvasRef}
                />
                <button
                  className="mt-2 min-h-11 underline"
                  onClick={clearSignature}
                  type="button"
                >
                  Tøm signaturfeltet
                </button>
              </fieldset>
              <button
                className="bg-accent hover:bg-accent-hover mt-6 min-h-14 w-full rounded-xl px-5 text-base font-black text-black disabled:opacity-50"
                disabled={pending || !hasSignature}
                type="submit"
              >
                {pending
                  ? "Signerer …"
                  : "Bestilling med forpliktelse til å betale og signer"}
              </button>
            </form>
          ) : null}
          {!declineOpen ? (
            <button
              className="text-muted-foreground mt-8 min-h-12 text-sm underline"
              disabled={pending}
              onClick={() => setDeclineOpen(true)}
              type="button"
            >
              Jeg ønsker å avslå tilbudet
            </button>
          ) : (
            <form
              className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-5 sm:p-7"
              onSubmit={decline}
            >
              <h2 className="text-xl font-bold">Før du avslår</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Fortell gjerne hva som gjorde at tilbudet ikke passer. Det
                hjelper oss å følge opp på en bedre måte.
              </p>
              <label
                className="mt-5 block font-semibold"
                htmlFor="declineReason"
              >
                Hva er hovedårsaken?
              </label>
              <select
                className="mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-[#12151c] px-4"
                id="declineReason"
                name="reason"
                required
                defaultValue=""
              >
                <option disabled value="">
                  Velg årsak
                </option>
                <option value="price">Prisen passer ikke</option>
                <option value="timing">Tidspunktet passer ikke</option>
                <option value="chose_other">
                  Jeg har valgt en annen leverandør
                </option>
                <option value="unsure">Jeg er fortsatt usikker</option>
                <option value="scope">
                  Tilbudet dekker ikke det jeg trenger
                </option>
                <option value="other">Annen årsak</option>
              </select>
              <label
                className="mt-5 block font-semibold"
                htmlFor="declineComment"
              >
                Kommentar (valgfritt)
              </label>
              <textarea
                className="mt-2 min-h-24 w-full rounded-lg border border-white/20 bg-[#12151c] p-4"
                id="declineComment"
                maxLength={1500}
                name="comment"
              />
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="min-h-12 rounded-lg border border-red-400/50 px-5 font-bold text-red-200 disabled:opacity-50"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? "Registrerer …" : "Bekreft at jeg avslår"}
                </button>
                <button
                  className="min-h-12 rounded-lg border border-white/20 px-5"
                  disabled={pending}
                  onClick={() => setDeclineOpen(false)}
                  type="button"
                >
                  Avbryt
                </button>
              </div>
            </form>
          )}
        </>
      ) : null}
      {signed ? (
        <section className="mt-8 rounded-2xl border border-white/10 p-5 sm:p-7">
          <h2 className="text-xl font-bold">
            Vil du endre eller avslutte avtalen?
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Velg handlingen som passer. Begge alternativene registreres med
            tidspunkt og setter eventuell arbeidsstart på pause.
          </p>
          {!contractRequestOpen ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                className="min-h-14 rounded-xl border border-red-400/50 px-5 font-bold text-red-200 hover:bg-red-400/10"
                onClick={() => setContractRequestOpen("withdrawal")}
                type="button"
              >
                Bruk angreretten
              </button>
              <button
                className="min-h-14 rounded-xl border border-white/20 px-5 font-bold hover:bg-white/5"
                onClick={() => setContractRequestOpen("change_or_cancel")}
                type="button"
              >
                Be om endring eller kansellering
              </button>
            </div>
          ) : (
            <form
              className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5"
              onSubmit={submitContractRequest}
            >
              <h3 className="text-lg font-bold">
                {contractRequestOpen === "withdrawal"
                  ? "Melding om bruk av angreretten"
                  : "Forespørsel om endring eller kansellering"}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {contractRequestOpen === "withdrawal"
                  ? "Du trenger ikke å oppgi noen grunn. Velg «Jeg ønsker ikke å oppgi årsak» dersom du ikke vil opplyse om den. Valget påvirker ikke selve meldingen om angrerett."
                  : "Dette er en forespørsel til vurdering. Avtalen endres eller avsluttes først når du mottar en skriftlig bekreftelse."}
              </p>
              <label
                className="mt-5 block font-semibold"
                htmlFor="contractRequestReason"
              >
                Hva er hovedårsaken?
              </label>
              <select
                className="mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-[#12151c] px-4"
                id="contractRequestReason"
                name="reasonCode"
                onChange={(event) =>
                  setContractRequestReason(event.target.value)
                }
                required
                value={contractRequestReason}
              >
                <option disabled value="">
                  Velg årsak
                </option>
                <option value="price">Prisen passer ikke</option>
                <option value="wait">
                  Jeg vil vente / ikke gjøre dette nå
                </option>
                <option value="timing">Tidspunktet passer ikke</option>
                <option value="other_supplier">
                  Jeg har valgt en annen leverandør
                </option>
                <option value="scope">
                  Tilbudet eller omfanget passer ikke
                </option>
                <option value="need_information">
                  Jeg trenger mer informasjon
                </option>
                <option value="personal_financial">
                  Personlige eller økonomiske årsaker
                </option>
                <option value="communication">
                  Kommunikasjonen fungerte ikke som forventet
                </option>
                <option value="not_needed">
                  Tjenesten er ikke lenger nødvendig
                </option>
                <option value="other">Annen årsak</option>
                <option value="prefer_not_to_say">
                  Jeg ønsker ikke å oppgi årsak
                </option>
              </select>
              {contractRequestReason === "other" ? (
                <>
                  <label
                    className="mt-5 block font-semibold"
                    htmlFor="contractRequestReasonText"
                  >
                    Beskriv kort
                  </label>
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-lg border border-white/20 bg-[#12151c] p-4"
                    id="contractRequestReasonText"
                    maxLength={2000}
                    minLength={3}
                    name="reasonText"
                    required
                  />
                </>
              ) : null}
              <div className="mt-5 space-y-3 rounded-xl border border-white/10 p-4">
                <label className="flex gap-3">
                  <input
                    checked={followUpConsent}
                    className="mt-1 size-5 shrink-0"
                    disabled={doNotContact}
                    onChange={(event) => {
                      setFollowUpConsent(event.target.checked);
                      if (!event.target.checked) setFollowUpChoice("");
                    }}
                    type="checkbox"
                  />
                  <span>
                    Jeg ønsker at Takfornyelse kontakter meg én gang for å se om
                    vi kan finne en bedre løsning.
                  </span>
                </label>
                <label className="flex gap-3">
                  <input
                    checked={doNotContact}
                    className="mt-1 size-5 shrink-0"
                    onChange={(event) => {
                      setDoNotContact(event.target.checked);
                      if (event.target.checked) {
                        setFollowUpConsent(false);
                        setFollowUpChoice("");
                      }
                    }}
                    type="checkbox"
                  />
                  <span>
                    Ikke kontakt meg om alternative tilbud eller senere
                    oppfølging.
                  </span>
                </label>
              </div>
              {followUpConsent && !doNotContact ? (
                <div className="mt-5">
                  <label
                    className="block font-semibold"
                    htmlFor="preferredFollowUp"
                  >
                    Når passer det best at vi følger opp?
                  </label>
                  <select
                    className="mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-[#12151c] px-4"
                    id="preferredFollowUp"
                    name="preferredFollowUp"
                    onChange={(event) => setFollowUpChoice(event.target.value)}
                    required
                    value={followUpChoice}
                  >
                    <option disabled value="">
                      Velg tidspunkt
                    </option>
                    <option value="one_month">Om 1 måned</option>
                    <option value="three_months">Om 3 måneder</option>
                    <option value="six_months">Om 6 måneder</option>
                    <option value="next_spring">Neste vår</option>
                    <option value="custom">Velg dato</option>
                  </select>
                  {followUpChoice === "custom" ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        aria-label="Ønsket oppfølgingsdato"
                        className="min-h-12 w-full rounded-lg border border-white/20 bg-[#12151c] px-4"
                        min={norwayDateKey(new Date())}
                        name="preferredFollowUpAt"
                        ref={followUpDateRef}
                        required
                        type="date"
                      />
                      <button
                        className="border-accent/50 text-accent hover:bg-accent/10 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-4 font-semibold"
                        onClick={() => {
                          const input = followUpDateRef.current;
                          if (!input) return;
                          if (typeof input.showPicker === "function")
                            input.showPicker();
                          else input.focus();
                        }}
                        type="button"
                      >
                        <CalendarDays aria-hidden="true" className="size-5" />
                        Velg dato i kalender
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className={`min-h-12 rounded-lg px-5 font-bold disabled:opacity-50 ${contractRequestOpen === "withdrawal" ? "border border-red-400/50 text-red-200" : "bg-accent text-black"}`}
                  disabled={pending}
                  type="submit"
                >
                  {pending
                    ? "Sender …"
                    : contractRequestOpen === "withdrawal"
                      ? "Send angremelding"
                      : "Send forespørsel"}
                </button>
                <button
                  className="min-h-12 rounded-lg border border-white/20 px-5"
                  disabled={pending}
                  onClick={() => setContractRequestOpen(null)}
                  type="button"
                >
                  Avbryt
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}
      <footer className="text-muted-foreground mt-12 border-t border-white/10 pt-6 text-sm">
        <p>
          {props.supplier.name} · Org.nr. {props.supplier.orgNumber}
        </p>
        <p>
          {props.supplier.address} · {props.supplier.email} ·{" "}
          {props.supplier.phone}
        </p>
      </footer>
    </main>
  );
}
