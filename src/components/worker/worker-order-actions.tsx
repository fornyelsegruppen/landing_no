"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchWithTimeout,
  RequestTimeoutError,
} from "@/lib/fetch-with-timeout";
import {
  getWorkerCopy,
  panelDateLocale,
  type PanelLocale,
} from "@/lib/panel-i18n";
import { prepareWorkerPhoto } from "@/lib/images/worker-upload";

type Props = {
  locale: PanelLocale;
  orderId: number;
  initialStatus: string;
  initialBeforePhotoIds: number[];
  initialAfterPhotoIds: number[];
  initialBlockingReasons: string[];
  initialCanRepeatPrecheck: boolean;
  initialActualTotalIncVatOre?: number | null;
  initialDocumentationSubmittedAt?: string | null;
};

export function WorkerOrderActions(props: Props) {
  const router = useRouter();
  const copy = getWorkerCopy(props.locale);
  const numberLocale = panelDateLocale(props.locale);
  const [status, setStatus] = useState(props.initialStatus);
  const [beforePhotoIds, setBeforePhotoIds] = useState(
    props.initialBeforePhotoIds,
  );
  const [afterPhotoIds, setAfterPhotoIds] = useState(
    props.initialAfterPhotoIds,
  );
  const [blockingReasons, setBlockingReasons] = useState(
    props.initialBlockingReasons,
  );
  const [actualTotal, setActualTotal] = useState(
    props.initialActualTotalIncVatOre ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [documentationSubmitted, setDocumentationSubmitted] = useState(
    Boolean(props.initialDocumentationSubmittedAt),
  );
  const [draftState, setDraftState] = useState<
    "unsent" | "saved" | "sending" | "sent" | "error"
  >("sent");
  const precheckFormRef = useRef<HTMLFormElement>(null);
  const completionFormRef = useRef<HTMLFormElement>(null);
  const draftKey = `takfornyelse:worker:${props.orderId}`;

  useEffect(() => {
    const saved = window.localStorage.getItem(draftKey);
    if (!saved) return;
    let values: Record<string, string | boolean>;
    try {
      values = JSON.parse(saved) as Record<string, string | boolean>;
    } catch {
      return;
    }
    for (const form of [precheckFormRef.current, completionFormRef.current]) {
      if (!form) continue;
      for (const element of Array.from(form.elements)) {
        if (
          !(
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement
          ) ||
          !element.name ||
          !(element.name in values)
        )
          continue;
        if (element instanceof HTMLInputElement && element.type === "checkbox")
          element.checked = Boolean(values[element.name]);
        else element.value = String(values[element.name] ?? "");
      }
    }
    const stateTimer = window.setTimeout(() => setDraftState("saved"), 0);
    return () => window.clearTimeout(stateTimer);
  }, [draftKey, status]);

  function saveLocalDraft(form: HTMLFormElement) {
    const values: Record<string, string | boolean> = {};
    for (const element of Array.from(form.elements)) {
      if (
        !(
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) ||
        !element.name ||
        element.type === "file"
      )
        continue;
      values[element.name] =
        element instanceof HTMLInputElement && element.type === "checkbox"
          ? element.checked
          : element.value;
    }
    window.localStorage.setItem(draftKey, JSON.stringify(values));
    setDraftState("saved");
  }

  function clearLocalDraft() {
    window.localStorage.removeItem(draftKey);
    setDraftState("sent");
  }

  async function send(body: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setDraftState("sending");
    setNotice("");
    try {
      const response = await fetchWithTimeout(
        `/api/worker/work-orders/${props.orderId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json()) as {
        code?: string;
        error?: string;
        issues?: string[];
        status?: string;
        blockingReasons?: string[];
        actualTotalIncVatOre?: number;
        customerNotification?: "sent" | "queued" | "skipped";
      };
      if (!response.ok) {
        throw new Error(
          result.issues?.join(" ") ||
            (result.code === "customer_cancellation_pending"
              ? copy.customerCancellationPending
              : result.code === "change_agreement_required"
                ? copy.changeAgreementRequired
                : undefined) ||
            (result.error === "disabled" ||
            result.error === "configuration_required"
              ? copy.featureUnavailable
              : result.error) ||
            copy.actionFailed,
        );
      }
      if (result.status) setStatus(result.status);
      if (body.action === "submit_documentation")
        setDocumentationSubmitted(true);
      setBlockingReasons(
        Array.isArray(result.blockingReasons) ? result.blockingReasons : [],
      );
      if (typeof result.actualTotalIncVatOre === "number")
        setActualTotal(result.actualTotalIncVatOre);
      setNotice(
        result.customerNotification === "sent"
          ? copy.customerNotified
          : result.customerNotification === "queued"
            ? copy.customerNotificationQueued
            : copy.registered,
      );
      router.refresh();
      setDraftState("sent");
      return true;
    } catch (error) {
      setNotice(
        error instanceof RequestTimeoutError
          ? copy.requestTimedOut
          : error instanceof Error
            ? error.message
            : copy.actionFailed,
      );
      router.refresh();
      setDraftState("error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function upload(phase: "before" | "after", files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const uploaded: number[] = [];
      for (const file of Array.from(files)) {
        const prepared = await prepareWorkerPhoto(file);
        const form = new FormData();
        form.set("phase", phase);
        form.set("file", prepared.file);
        let response: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          response = await fetchWithTimeout(
            `/api/worker/work-orders/${props.orderId}/photos`,
            {
              method: "POST",
              headers: { "X-Upload-SHA256": prepared.sha256 },
              body: form,
            },
            45_000,
          ).catch(() => null);
          if (
            response?.ok ||
            (response &&
              response.status < 500 &&
              response.status !== 408 &&
              response.status !== 429)
          )
            break;
        }
        if (!response) throw new Error(copy.uploadFailed);
        const result = (await response.json()) as {
          id?: number;
          error?: string;
        };
        if (!response.ok || !result.id)
          throw new Error(result.error || copy.imageUploadFailed);
        uploaded.push(result.id);
      }
      if (phase === "before")
        setBeforePhotoIds((current) => [...new Set([...current, ...uploaded])]);
      else
        setAfterPhotoIds((current) => [...new Set([...current, ...uploaded])]);
      setNotice(`${uploaded.length} ${copy.uploaded}`);
      router.refresh();
    } catch (error) {
      setNotice(
        error instanceof RequestTimeoutError
          ? copy.requestTimedOut
          : error instanceof Error
            ? error.message
            : copy.uploadFailed,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitPrecheck(formData: FormData) {
    const area = Number(
      String(formData.get("actualArea") ?? "").replace(",", "."),
    );
    const sent = await send({
      action: "submit_precheck",
      beforePhotoIds,
      roofType: formData.get("roofType"),
      actualAreaTenths: Math.round(area * 10),
      measurementMethod: formData.get("measurementMethod"),
      slopeBasis: formData.get("slopeBasis"),
      visibleCondition: formData.get("visibleCondition"),
      safetyStatus: formData.get("safetyStatus"),
      safetyNotes: formData.get("safetyNotes"),
      scopeChanged: formData.get("scopeChanged") === "on",
      scopeChangeDetails: formData.get("scopeChangeDetails"),
    });
    if (sent) clearLocalDraft();
  }

  const customerCancellationPending = blockingReasons.includes(
    "CUSTOMER_CANCELLATION_REQUEST",
  );

  return (
    <section className="bg-background-elevated mt-6 rounded-2xl border border-white/10 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-accent text-xs font-bold tracking-widest uppercase">
            {copy.workflow}
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {copy.status[status as keyof typeof copy.status] ?? status}
          </h2>
        </div>
        {actualTotal !== null ? (
          <p className="rounded-lg bg-white/5 px-3 py-2 text-sm">
            {copy.controlPrice}:{" "}
            <strong>
              {(actualTotal / 100).toLocaleString(numberLocale, {
                style: "currency",
                currency: "NOK",
              })}
            </strong>
          </p>
        ) : null}
      </div>
      <p
        className={`mt-3 text-xs font-semibold ${draftState === "error" ? "text-red-300" : "text-muted-foreground"}`}
        role="status"
      >
        {draftState === "unsent"
          ? props.locale === "lt"
            ? "Neišsiųsta"
            : props.locale === "en"
              ? "Not sent"
              : "Ikke sendt"
          : draftState === "saved"
            ? props.locale === "lt"
              ? "Juodraštis saugomas šiame telefone"
              : props.locale === "en"
                ? "Draft saved on this phone"
                : "Utkast lagret på denne telefonen"
            : draftState === "sending"
              ? props.locale === "lt"
                ? "Siunčiama …"
                : props.locale === "en"
                  ? "Sending …"
                  : "Sender …"
              : draftState === "error"
                ? props.locale === "lt"
                  ? "Klaida – duomenys liko telefone"
                  : props.locale === "en"
                    ? "Error – data remains on this phone"
                    : "Feil – dataene er fortsatt på telefonen"
                : props.locale === "lt"
                  ? "Išsiųsta"
                  : props.locale === "en"
                    ? "Sent"
                    : "Sendt"}
      </p>

      {status === "scheduled" ? (
        <ActionButton
          busy={busy}
          busyLabel={copy.processing}
          onClick={() => send({ action: "on_way" })}
        >
          {copy.onWay}
        </ActionButton>
      ) : null}
      {status === "on_way" ? (
        <ActionButton
          busy={busy}
          busyLabel={copy.processing}
          onClick={() => send({ action: "arrive" })}
        >
          {copy.arrived}
        </ActionButton>
      ) : null}
      {status === "arrived" ? (
        <ActionButton
          busy={busy}
          busyLabel={copy.processing}
          onClick={() => send({ action: "begin_precheck" })}
        >
          {copy.startPrecheck}
        </ActionButton>
      ) : null}
      {status === "blocked" ? (
        <div className="mt-5">
          <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm">
            <strong>{copy.workBlocked}</strong>
            {blockingReasons.map((reason) =>
              reason === "CUSTOMER_CANCELLATION_REQUEST" ? null : (
                <p className="mt-1" key={reason}>
                  {reason}
                </p>
              ),
            )}
            {customerCancellationPending ? (
              <p className="mt-2">{copy.customerCancellationPending}</p>
            ) : !props.initialCanRepeatPrecheck ? (
              <p className="mt-2">{copy.changeAgreementRequired}</p>
            ) : null}
          </div>
          {!customerCancellationPending && props.initialCanRepeatPrecheck ? (
            <ActionButton
              busy={busy}
              busyLabel={copy.processing}
              onClick={() => send({ action: "begin_precheck" })}
            >
              {copy.repeatPrecheck}
            </ActionButton>
          ) : null}
        </div>
      ) : null}

      {status === "precheck" ? (
        <form
          action={submitPrecheck}
          className="mt-5 grid gap-4"
          onInput={(event) => {
            setDraftState("unsent");
            saveLocalDraft(event.currentTarget);
          }}
          ref={precheckFormRef}
        >
          <PhotoInput
            busy={busy}
            count={beforePhotoIds.length}
            label={copy.beforePhotos}
            uploadedLabel={copy.uploadedCount}
            uploadingLabel={copy.uploading}
            onChange={(files) => upload("before", files)}
          />
          <label className="grid gap-1 text-sm font-semibold">
            {copy.roofType}
            <select
              className="bg-background min-h-12 rounded-xl border border-white/15 px-3"
              name="roofType"
              required
            >
              <option value="">{copy.choose}</option>
              {[
                "betongstein",
                "teglstein",
                "metall",
                "skifer",
                "shingel",
                "annet",
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {copy.actualArea}
            <input
              className="bg-background min-h-12 rounded-xl border border-white/15 px-3"
              inputMode="decimal"
              min="1"
              name="actualArea"
              required
              step="0.1"
              type="number"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {copy.measurementMethod}
            <select
              className="bg-background min-h-12 rounded-xl border border-white/15 px-3"
              name="measurementMethod"
              required
            >
              <option value="">{copy.choose}</option>
              {[
                "laser",
                "målebånd",
                "tegning",
                "kart_kontrollert",
                "annet",
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {copy.slopeBasis}
            <input
              className="bg-background min-h-12 rounded-xl border border-white/15 px-3"
              maxLength={300}
              name="slopeBasis"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {copy.visibleCondition}
            <textarea
              className="bg-background min-h-24 rounded-xl border border-white/15 p-3"
              maxLength={2000}
              name="visibleCondition"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {copy.safetyAccess}
            <select
              className="bg-background min-h-12 rounded-xl border border-white/15 px-3"
              name="safetyStatus"
              required
            >
              <option value="safe">{copy.safe}</option>
              <option value="blocked">{copy.unsafe}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {copy.safetyComment}
            <textarea
              className="bg-background min-h-20 rounded-xl border border-white/15 p-3"
              maxLength={2000}
              name="safetyNotes"
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/15 p-3 text-sm font-semibold">
            <input className="size-5" name="scopeChanged" type="checkbox" />
            {copy.scopeChanged}
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {copy.scopeDetails}
            <textarea
              className="bg-background min-h-20 rounded-xl border border-white/15 p-3"
              maxLength={2000}
              name="scopeChangeDetails"
            />
          </label>
          <button
            aria-busy={busy}
            className="bg-accent text-accent-foreground min-h-12 rounded-xl px-5 font-bold disabled:opacity-50"
            disabled={busy || beforePhotoIds.length < 2}
            type="submit"
          >
            {busy ? copy.processing : copy.calculatePrecheck}
          </button>
        </form>
      ) : null}

      {status === "ready" ? (
        <div className="mt-5 rounded-xl border border-green-400/40 bg-green-400/10 p-4">
          <strong>{copy.readyToStart}</strong>
          <p className="mt-1 text-sm">{copy.withinFrame}</p>
          <ActionButton
            busy={busy}
            busyLabel={copy.processing}
            onClick={() => send({ action: "start" })}
          >
            {copy.startWork}
          </ActionButton>
        </div>
      ) : null}
      {status === "in_progress" ? (
        <div className="mt-5 grid gap-4">
          <PhotoInput
            busy={busy}
            count={afterPhotoIds.length}
            label={copy.afterPhotos}
            uploadedLabel={copy.uploadedCount}
            uploadingLabel={copy.uploading}
            onChange={(files) => upload("after", files)}
          />
          <button
            aria-busy={busy}
            className="bg-accent text-accent-foreground min-h-12 rounded-xl px-5 font-bold disabled:opacity-50"
            disabled={busy || afterPhotoIds.length < 2}
            onClick={() => send({ action: "mark_completed" })}
            type="button"
          >
            {busy ? copy.processing : copy.workCompleted}
          </button>
        </div>
      ) : null}
      {status === "completed" && !documentationSubmitted ? (
        <form
          action={async (form) => {
            const sent = await send({
              action: "submit_documentation",
              afterPhotoIds,
              completionNotes: form.get("completionNotes"),
            });
            if (sent) clearLocalDraft();
          }}
          className="mt-5 grid gap-4"
          onInput={(event) => {
            setDraftState("unsent");
            saveLocalDraft(event.currentTarget);
          }}
          ref={completionFormRef}
        >
          <PhotoInput
            busy={busy}
            count={afterPhotoIds.length}
            label={copy.afterPhotos}
            uploadedLabel={copy.uploadedCount}
            uploadingLabel={copy.uploading}
            onChange={(files) => upload("after", files)}
          />
          <label className="grid gap-1 text-sm font-semibold">
            {copy.completionMessage}
            <textarea
              className="bg-background min-h-28 rounded-xl border border-white/15 p-3"
              minLength={10}
              name="completionNotes"
              required
            />
          </label>
          <button
            aria-busy={busy}
            className="bg-accent text-accent-foreground min-h-12 rounded-xl px-5 font-bold disabled:opacity-50"
            disabled={busy || afterPhotoIds.length < 2}
            type="submit"
          >
            {busy ? copy.processing : copy.submitDocumentation}
          </button>
        </form>
      ) : null}
      {status === "completed" && documentationSubmitted ? (
        <p className="border-accent/40 bg-accent/10 mt-5 rounded-xl border p-4 font-semibold">
          {copy.pendingAdminReview}
        </p>
      ) : null}
      {status === "documented" ? (
        <p className="mt-5 rounded-xl border border-green-400/40 bg-green-400/10 p-4 font-semibold">
          {copy.jobDelivered}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 text-sm" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

function ActionButton({
  busy,
  busyLabel,
  children,
  onClick,
}: {
  busy: boolean;
  busyLabel: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-busy={busy}
      className="bg-accent text-accent-foreground mt-5 min-h-12 w-full rounded-xl px-5 font-bold disabled:opacity-50"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      {busy ? busyLabel : children}
    </button>
  );
}

function PhotoInput({
  busy,
  count,
  label,
  uploadedLabel,
  uploadingLabel,
  onChange,
}: {
  busy: boolean;
  count: number;
  label: string;
  uploadedLabel: string;
  uploadingLabel: string;
  onChange: (files: FileList | null) => void;
}) {
  return (
    <label className="grid gap-2 rounded-xl border border-dashed border-white/20 p-4 text-sm font-semibold">
      {label}
      <span className="text-muted-foreground">
        {busy ? uploadingLabel : `${uploadedLabel}: ${count}`}
      </span>
      <input
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={busy}
        multiple
        onChange={(event) => onChange(event.target.files)}
        type="file"
      />
    </label>
  );
}
