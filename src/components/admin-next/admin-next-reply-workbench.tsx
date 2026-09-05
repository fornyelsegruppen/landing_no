"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";
import type { AdminNextCustomerRecord } from "@/lib/admin-next/case-workspace-contract";
import type { AdminNextReplyDraftingReadiness } from "@/lib/admin-next/reply-drafting-readiness";
import { MessageDraftEditor } from "@/components/admin-v2/message-draft-editor";

const copy = {
  nb: {
    title: "Svar til kunden",
    intro:
      "Opprett et utkast her. Opprettelse og lagring sender aldri noe til kunden.",
    manual: "Opprett manuelt utkast",
    ai: "Opprett AI-utkast",
    aiDisabled: "AI-utkast er ikke tilgjengelig i dette miljøet.",
    featureDisabled: "AI-utkast er slått av for dette Preview-miljøet.",
    providerMissing:
      "Tilkoblingen til AI-leverandøren er ikke konfigurert for dette Preview-miljøet.",
    technicalDetails: "Tekniske detaljer",
    prepareDenied: "Denne kontoen kan ikke opprette eller endre utkast.",
    creating: "Oppretter utkast …",
    ready: "Utkastet er opprettet. Åpner redigeringen …",
    failed: "Utkastet kunne ikke opprettes. Oppdater saken og prøv igjen.",
    stale: "Saken ble endret. Oppdater siden før du oppretter et utkast.",
    reviewBoundary:
      "Sending er en egen handling og krever eksplisitt faktakontroll og godkjenning.",
    source: "Opprinnelig henvendelse",
  },
  lt: {
    title: "Atsakymas klientui",
    intro:
      "Juodraštį kurkite čia. Sukūrimas ir išsaugojimas nieko klientui nesiunčia.",
    manual: "Sukurti rankinį juodraštį",
    ai: "Sukurti DI juodraštį",
    aiDisabled: "DI juodraščiai šioje aplinkoje nepasiekiami.",
    featureDisabled: "DI juodraščiai šioje Preview aplinkoje yra išjungti.",
    providerMissing:
      "Šioje Preview aplinkoje nesukonfigūruotas ryšys su DI tiekėju.",
    technicalDetails: "Techninė informacija",
    prepareDenied: "Ši paskyra negali kurti ar keisti juodraščių.",
    creating: "Kuriamas juodraštis …",
    ready: "Juodraštis sukurtas. Atveriamas redagavimas …",
    failed:
      "Juodraščio sukurti nepavyko. Atnaujinkite bylą ir bandykite dar kartą.",
    stale: "Byla pasikeitė. Prieš kurdami juodraštį atnaujinkite puslapį.",
    reviewBoundary:
      "Siuntimas yra atskiras veiksmas: pirmiausia būtina aiški faktų patikra ir administratoriaus patvirtinimas.",
    source: "Pradinė kliento užklausa",
  },
  en: {
    title: "Reply to the customer",
    intro:
      "Create the draft here. Creating or saving a draft never sends it to the customer.",
    manual: "Create manual draft",
    ai: "Create AI draft",
    aiDisabled: "AI drafting is unavailable in this environment.",
    featureDisabled: "AI drafting is disabled for this Preview environment.",
    providerMissing:
      "The AI provider connection is not configured for this Preview environment.",
    technicalDetails: "Technical details",
    prepareDenied: "This account cannot create or change drafts.",
    creating: "Creating draft …",
    ready: "The draft was created. Opening the editor …",
    failed: "The draft could not be created. Refresh the case and try again.",
    stale: "The case changed. Refresh before creating a draft.",
    reviewBoundary:
      "Sending is a separate action and requires an explicit fact review and administrator approval.",
    source: "Original customer enquiry",
  },
} as const;

type ActiveReplyDraft = NonNullable<
  AdminNextCustomerRecord["activeReplyDraft"]
>;

function questionMessageId(value: string | undefined) {
  const match = value?.match(/^message-([1-9]\d*)$/u);
  return match ? Number(match[1]) : undefined;
}

export function AdminNextReplyWorkbench({
  activeDraft,
  activeQuestionId,
  canApproveSend,
  canPrepare,
  caseRevision,
  leadId,
  locale,
  originalBody,
  readiness,
}: {
  activeDraft?: ActiveReplyDraft;
  activeQuestionId?: string;
  canApproveSend: boolean;
  canPrepare: boolean;
  caseRevision: number;
  leadId: number;
  locale: PanelLocale;
  originalBody?: string | null;
  readiness: AdminNextReplyDraftingReadiness;
}) {
  const labels = copy[locale];
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<"ai" | "manual" | null>(null);
  const [notice, setNotice] = useState("");
  const sourceMessageId = questionMessageId(activeQuestionId);
  const aiUnavailableReason =
    readiness.ai.state === "feature_disabled"
      ? labels.featureDisabled
      : readiness.ai.state === "provider_configuration_required"
        ? labels.providerMissing
        : "";

  async function createDraft(kind: "ai" | "manual") {
    if (
      !canPrepare ||
      inFlight.current ||
      (kind === "ai" && readiness.ai.state !== "ready")
    ) {
      return;
    }
    inFlight.current = true;
    setBusy(kind);
    setNotice("");
    try {
      const action = sourceMessageId
        ? kind === "ai"
          ? "prepare_question_reply"
          : "prepare_manual_question_reply"
        : kind === "ai"
          ? "generate_reply"
          : "prepare_manual_reply";
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Next-Preview-Mutation": "reply-draft",
        },
        body: JSON.stringify({
          action,
          expectedRevision: caseRevision,
          ...(sourceMessageId ? { sourceMessageId } : {}),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          response.status === 409 || result.code === "CASE_REVISION_CONFLICT"
            ? labels.stale
            : labels.failed,
        );
      }
      setNotice(labels.ready);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : labels.failed);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="case-reply-workbench-title"
      className="mt-5 scroll-mt-36 rounded-2xl border border-[var(--an-action)] bg-[var(--an-action-soft)] p-4 sm:p-5"
      data-ai-drafting-state={readiness.ai.state}
      data-reply-workbench
      id="case-reply-workbench"
    >
      <h3
        className="text-base font-bold text-[var(--an-text)]"
        id="case-reply-workbench-title"
      >
        {labels.title}
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-[var(--an-muted)]">
        {labels.intro}
      </p>

      {activeDraft ? (
        <div className="mt-4" data-active-reply-draft={activeDraft.id}>
          <MessageDraftEditor
            aiAssisted={activeDraft.aiAssisted}
            aiAvailable={readiness.ai.state === "ready"}
            aiUnavailableReason={aiUnavailableReason}
            bodyText={activeDraft.bodyText}
            canApproveSend={canApproveSend}
            canEditDraft={canPrepare}
            caseRevision={caseRevision}
            leadId={leadId}
            locale={locale}
            manualReplyRequiresEditing={activeDraft.manualReplyRequiresEditing}
            messageId={activeDraft.id}
            messageUpdatedAt={activeDraft.updatedAt}
            replyTarget={activeDraft.replyTarget || null}
            sourceBody={
              activeDraft.replyTarget ? undefined : originalBody || undefined
            }
            sourceContextAvailable={Boolean(
              activeDraft.replyTarget || originalBody,
            )}
            sourceSubject={activeDraft.replyTarget ? undefined : labels.source}
            subject={activeDraft.subject}
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="min-h-11 rounded-xl bg-[var(--an-action)] px-4 text-sm font-bold text-[var(--an-action-text)] disabled:opacity-55"
              data-reply-draft-action="manual"
              disabled={Boolean(busy) || !canPrepare}
              onClick={() => void createDraft("manual")}
              type="button"
            >
              {busy === "manual" ? labels.creating : labels.manual}
            </button>
            <button
              className="min-h-11 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-surface-base)] px-4 text-sm font-bold text-[var(--an-text)] disabled:cursor-not-allowed disabled:opacity-55"
              data-reply-draft-action="ai"
              disabled={
                Boolean(busy) || !canPrepare || readiness.ai.state !== "ready"
              }
              onClick={() => void createDraft("ai")}
              type="button"
            >
              {busy === "ai" ? labels.creating : labels.ai}
            </button>
          </div>
          {readiness.ai.state !== "ready" ? (
            <p
              className="mt-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-base)] p-3 text-xs text-[var(--an-muted)]"
              data-ai-drafting-blockers={readiness.ai.blockers.join(",")}
            >
              <strong className="text-[var(--an-text)]">
                {labels.aiDisabled}
              </strong>{" "}
              {aiUnavailableReason}
            </p>
          ) : null}
        </>
      )}

      {!canPrepare ? (
        <p className="mt-3 text-xs font-semibold text-[var(--an-danger)]">
          {labels.prepareDenied}
        </p>
      ) : null}

      {readiness.ai.state !== "ready" && readiness.ai.blockers.length ? (
        <details
          className="mt-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-base)] p-3 text-xs text-[var(--an-muted)]"
          data-ai-technical-blockers={readiness.ai.blockers.join(",")}
        >
          <summary className="cursor-pointer font-bold text-[var(--an-text)]">
            {labels.technicalDetails}
          </summary>
          <code className="mt-2 block break-all">
            {readiness.ai.blockers.join(", ")}
          </code>
        </details>
      ) : null}

      <p className="mt-3 text-xs font-semibold text-[var(--an-muted)]">
        {labels.reviewBoundary}
      </p>
      {notice ? (
        <p aria-live="polite" className="mt-3 text-sm text-[var(--an-text)]">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
