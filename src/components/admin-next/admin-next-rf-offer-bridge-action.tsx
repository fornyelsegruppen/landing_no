"use client";

import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  ROOF_FUSION_OFFER_BRIDGE_REQUEST_VERSION,
  roofFusionOfferBridgeResultV1Schema,
  type RoofFusionOfferBridgeRequestV1,
  type RoofFusionOfferBridgeResultV1,
} from "@/lib/roof-fusion/offer-bridge-contract-v1";
import { ReviewAndCommit } from "./review-and-commit";

type SnapshotBinding = RoofFusionOfferBridgeRequestV1["snapshot"];

const copy = {
  lt: {
    action: "Įkelti matavimą į pasiūlymą",
    title: "Peržiūrėti ir įkelti į pasiūlymą",
    description:
      "Bus panaudota tik ši patvirtinta bylos, adreso ir RF snapshot revizija.",
    binding: "Tiksli RF revizija",
    bindingDetail: (snapshot: SnapshotBinding) =>
      `${snapshot.snapshotId} · r${snapshot.revision} · ${snapshot.snapshotHash.slice(0, 12)}…`,
    address: "Bylos ir adreso revizijos",
    addressDetail: (caseRevision: number, addressRevision: number) =>
      `Byla r${caseRevision} · adresas r${addressRevision}`,
    changes: [
      "sukuriama nekintama RoofMeasurement revizija",
      "sukuriamas kainos skaičiavimas, pasiūlymo ir sutarties juodraščiai",
      "visa kilmė susiejama su snapshot, input ir renderer hash",
    ],
    untouched: [
      "pasiūlymas nepatvirtinamas ir neišsiunčiamas klientui",
      "sutartis neišduodama ir nepasirašoma",
      "ankstesnės revizijos neperrašomos ir netrinamos",
    ],
    post: "Pasiūlymo juodraštis paruoštas atskirai administratoriaus peržiūrai.",
    pending: "Kuriama nekintama matavimo ir pasiūlymo grandinė…",
    success: "Matavimas sėkmingai užfiksuotas ir įkeltas į pasiūlymą.",
    offerReference: (measurementId: number, quoteId: number) =>
      `RF-${measurementId} · Pasiūlymas ${quoteId}`,
    open: "Atverti pasiūlymą",
    error: "Matavimo nepavyko įkelti. Duomenys neišsiųsti klientui.",
  },
  nb: {
    action: "Legg målingen til tilbudet",
    title: "Kontroller og legg til i tilbud",
    description:
      "Bare denne godkjente saks-, adresse- og RF-snapshotrevisjonen brukes.",
    binding: "Eksakt RF-revisjon",
    bindingDetail: (snapshot: SnapshotBinding) =>
      `${snapshot.snapshotId} · r${snapshot.revision} · ${snapshot.snapshotHash.slice(0, 12)}…`,
    address: "Saks- og adresserevisjon",
    addressDetail: (caseRevision: number, addressRevision: number) =>
      `Sak r${caseRevision} · adresse r${addressRevision}`,
    changes: [
      "en uforanderlig RoofMeasurement-revisjon opprettes",
      "prisberegning, tilbudsutkast og kontraktsutkast opprettes",
      "hele kjeden bindes til snapshot-, input- og renderer-hash",
    ],
    untouched: [
      "tilbudet godkjennes eller sendes ikke til kunden",
      "kontrakten utstedes eller signeres ikke",
      "tidligere revisjoner overskrives eller slettes ikke",
    ],
    post: "Tilbudsutkastet er klart for separat administratorkontroll.",
    pending: "Oppretter den uforanderlige målings- og tilbudskjeden…",
    success: "Målingen er lagret og lagt til i tilbudet.",
    offerReference: (measurementId: number, quoteId: number) =>
      `RF-${measurementId} · Tilbud ${quoteId}`,
    open: "Åpne tilbudet",
    error: "Målingen kunne ikke legges til. Ingenting ble sendt til kunden.",
  },
  en: {
    action: "Add measurement to offer",
    title: "Review and add to offer",
    description:
      "Only this approved case, address and RF snapshot revision will be used.",
    binding: "Exact RF revision",
    bindingDetail: (snapshot: SnapshotBinding) =>
      `${snapshot.snapshotId} · r${snapshot.revision} · ${snapshot.snapshotHash.slice(0, 12)}…`,
    address: "Case and address revisions",
    addressDetail: (caseRevision: number, addressRevision: number) =>
      `Case r${caseRevision} · address r${addressRevision}`,
    changes: [
      "an immutable RoofMeasurement revision is created",
      "pricing, offer draft and contract draft are created",
      "the chain is bound to the snapshot, input and renderer hashes",
    ],
    untouched: [
      "the offer is not approved or sent to the customer",
      "the contract is not issued or signed",
      "previous revisions are not overwritten or deleted",
    ],
    post: "The offer draft is ready for a separate administrator review.",
    pending: "Creating the immutable measurement and offer chain…",
    success: "The measurement was captured and added to the offer.",
    offerReference: (measurementId: number, quoteId: number) =>
      `RF-${measurementId} · Offer ${quoteId}`,
    open: "Open offer",
    error: "The measurement could not be added. Nothing was sent to the customer.",
  },
} as const;

export function AdminNextRfOfferBridgeAction({
  addressRevision,
  caseId,
  caseRevision,
  locale,
  snapshot,
}: {
  addressRevision: number;
  caseId: string;
  caseRevision: number;
  locale: PanelLocale;
  snapshot: SnapshotBinding;
}) {
  const t = copy[locale];
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [result, setResult] = useState<RoofFusionOfferBridgeResultV1 | null>(null);
  const idempotencyKey = useMemo(
    () =>
      `rf-offer:${snapshot.snapshotHash}:${caseRevision}:${addressRevision}`,
    [addressRevision, caseRevision, snapshot.snapshotHash],
  );

  const commit = async () => {
    setState("pending");
    try {
      const body: RoofFusionOfferBridgeRequestV1 = {
        schemaVersion: ROOF_FUSION_OFFER_BRIDGE_REQUEST_VERSION,
        caseId,
        expectedCaseRevision: caseRevision,
        expectedAddressRevision: addressRevision,
        snapshot,
        idempotencyKey,
      };
      const response = await fetch("/api/admin/roof-fusion/add-to-offer", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : t.error,
        );
      }
      const parsed = roofFusionOfferBridgeResultV1Schema.parse(payload);
      setResult(parsed);
      setState("success");
      setOpen(false);
    } catch {
      setState("error");
    }
  };

  if (result) {
    return (
      <div
        className="an-success rounded-xl border px-3 py-2 text-xs"
        data-rf-offer-bridge="success"
        role="status"
      >
        <strong className="flex items-center gap-2">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          {t.success}
        </strong>
        <span className="mt-1 block opacity-80">
          {t.offerReference(result.measurement.id, result.quote.id)}
        </span>
        <a className="mt-2 inline-flex items-center gap-1 font-black underline" href={result.offerHref}>
          {t.open} <ArrowRight aria-hidden="true" className="size-3" />
        </a>
      </div>
    );
  }

  return (
    <>
      <button
        className="an-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black disabled:cursor-wait disabled:opacity-60"
        data-rf-offer-bridge="open-review"
        disabled={state === "pending"}
        onClick={() => setOpen(true)}
        type="button"
      >
        {state === "pending" ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ShieldCheck aria-hidden="true" className="size-4" />
        )}
        {state === "pending" ? t.pending : t.action}
      </button>
      {state === "error" ? (
        <p className="text-xs text-[var(--an-danger)]" role="alert">
          {t.error}
        </p>
      ) : null}
      <ReviewAndCommit
        changes={t.changes}
        commitLabel={t.action}
        description={t.description}
        idempotencyKey={idempotencyKey}
        locale={locale}
        onCommit={commit}
        onOpenChange={setOpen}
        open={open}
        postCommitState={t.post}
        preflight={[
          {
            id: "snapshot",
            label: t.binding,
            detail: t.bindingDetail(snapshot),
            state: "pass",
          },
          {
            id: "address",
            label: t.address,
            detail: t.addressDetail(caseRevision, addressRevision),
            state: "pass",
          },
        ]}
        risk="material"
        state={state}
        title={t.title}
        untouched={t.untouched}
      />
    </>
  );
}
