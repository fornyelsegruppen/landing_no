"use client";

import Link from "next/link";
import { CheckCircle2, LoaderCircle, ScanSearch } from "lucide-react";
import { useState } from "react";
import type { RoofProposal } from "@/lib/measurements/proposal";
import type { AddressCandidate } from "@/lib/providers/contracts";

const SCREENSHOT_SOURCE = "norge-i-bilder-screenshot" as const;
const SCREENSHOT_CREDITS = "©norgeibilder.no" as const;

type ProposalResponse = {
  proposal: RoofProposal;
  provider: string;
  model: string;
  promptVersion: string;
};

type CreatedMeasurementResponse = {
  measurement: {
    id: number | string;
    reference?: string | null;
    status?: string | null;
  };
};

type ProposalCreateEligibility =
  | { allowed: true }
  | { allowed: false; message: string };

type ActionState =
  | { kind: "idle" }
  | { kind: "analyzing" }
  | { kind: "proposal"; result: ProposalResponse }
  | { kind: "creating"; proposal: ProposalResponse }
  | { kind: "created"; result: CreatedMeasurementResponse }
  | { kind: "error"; message: string; proposal?: ProposalResponse };

export function buildProposalRequest(leadId: number, mapImageId: number) {
  return {
    leadId,
    mapImageId,
    source: SCREENSHOT_SOURCE,
    licenseAccepted: true as const,
    trainingProhibited: true as const,
    credits: SCREENSHOT_CREDITS,
  };
}

export function buildCreateRequest(
  leadId: number,
  address: AddressCandidate,
  proposal: RoofProposal,
  mapImageId: number,
) {
  return {
    action: "create" as const,
    leadId,
    address,
    proposal,
    imageryLicensed: true,
    imagerySource: SCREENSHOT_SOURCE,
    imagerySourceUrl: "https://norgeibilder.no/",
    license:
      "Kartverket written permission for user-triggered screenshot capture",
    credits: SCREENSHOT_CREDITS,
    mapImageId,
  };
}

export function getProposalCreateEligibility(
  proposal: RoofProposal | undefined,
): ProposalCreateEligibility {
  if (!proposal) {
    return { allowed: false, message: "Pirmiausia paleisk stogo analizę." };
  }
  if (proposal.confidence === "low") {
    return {
      allowed: false,
      message:
        "AI pasiūlymas per silpnas. Paleisk analizę dar kartą arba pataisyk kontūrą prieš kuriant peržiūrą.",
    };
  }
  if (proposal.roofPlanes.length === 0) {
    return {
      allowed: false,
      message:
        "AI nepateikė nė vienos stogo plokštumos. Peržiūros kurti negalima.",
    };
  }
  return { allowed: true };
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    (T & { error?: string; correlationId?: string }) | null;
  if (!response.ok) {
    const reference = body?.correlationId
      ? ` · klaidos ID: ${body.correlationId}`
      : "";
    throw new Error(`${body?.error || "API klaida"}${reference}`);
  }
  if (!body) throw new Error("Serveris grąžino tuščią atsakymą");
  return body;
}

export function NorgeMeasurementActions({
  address,
  caseReference,
  leadId,
  mapImageId,
}: {
  address: AddressCandidate;
  caseReference: string;
  leadId: number;
  mapImageId: number;
}) {
  const [state, setState] = useState<ActionState>({ kind: "idle" });
  const proposal =
    state.kind === "proposal"
      ? state.result
      : state.kind === "creating"
        ? state.proposal
        : state.kind === "error"
          ? state.proposal
          : undefined;

  async function analyze() {
    setState({ kind: "analyzing" });
    try {
      const response = await fetch("/api/admin/measurements/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildProposalRequest(leadId, mapImageId)),
      });
      const result = await responseJson<ProposalResponse>(response);
      setState({ kind: "proposal", result });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Analizė nepavyko",
      });
    }
  }

  async function create() {
    if (!proposal) {
      setState({
        kind: "error",
        message: "Pirmiausia paleisk stogo analizę.",
      });
      return;
    }
    const eligibility = getProposalCreateEligibility(proposal.proposal);
    if (!eligibility.allowed) {
      setState({
        kind: "error",
        message: eligibility.message,
        proposal,
      });
      return;
    }
    setState({ kind: "creating", proposal });
    try {
      const response = await fetch("/api/admin/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          buildCreateRequest(leadId, address, proposal.proposal, mapImageId),
        ),
      });
      const result = await responseJson<CreatedMeasurementResponse>(response);
      setState({ kind: "created", result });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Matavimo sukurti nepavyko",
        proposal,
      });
    }
  }

  const busy = state.kind === "analyzing" || state.kind === "creating";
  const createEligibility = getProposalCreateEligibility(proposal?.proposal);

  return (
    <div
      className="grid gap-3 border-t border-[var(--an-border)] p-3"
      data-measurement-actions="preview"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={analyze}
          disabled={busy || state.kind === "created"}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/40 px-3 text-xs font-black disabled:cursor-wait disabled:opacity-60"
        >
          {state.kind === "analyzing" ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <ScanSearch aria-hidden="true" className="size-4" />
          )}
          {state.kind === "analyzing" ? "Analizuojama…" : "Analizuoti stogą"}
        </button>
        <button
          type="button"
          onClick={create}
          disabled={
            busy || !createEligibility.allowed || state.kind === "created"
          }
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--an-amber)] px-3 text-xs font-black text-[var(--an-amber-ink)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.kind === "creating" ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {state.kind === "creating"
            ? "Kuriamas matavimas…"
            : "Sukurti matavimą peržiūrai"}
        </button>
      </div>

      {proposal ? (
        <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-3 text-xs text-[var(--an-muted)]">
          <p className="font-black text-cyan-100">AI pasiūlymas paruoštas</p>
          <p className="mt-1">
            {proposal.provider} / {proposal.model} · patikimumas:{" "}
            {proposal.proposal.confidence} · stogo plokštumos:{" "}
            {proposal.proposal.roofPlanes.length}
          </p>
          <p className="mt-1 font-bold text-amber-200">
            PREVIEW · būtina administratoriaus peržiūra
          </p>
          {!createEligibility.allowed ? (
            <p className="mt-2 font-bold text-red-200">
              Blokatorius: {createEligibility.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.kind === "created" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-3 text-xs text-emerald-100">
          <p className="inline-flex items-center gap-2 font-black">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            Sukurta {state.result.measurement.reference || caseReference} ·{" "}
            {state.result.measurement.status || "review_required"}
          </p>
          <Link
            className="font-black underline"
            href={`/admin-v2/cases/${leadId}`}
          >
            Atverti bylą
          </Link>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <p
          className="rounded-xl border border-red-400/35 bg-red-400/10 p-3 text-xs font-bold text-red-200"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
