import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { PayloadRequest } from "payload";
import { AdminNextR4MeasurementReview } from "@/components/admin-next/admin-next-r4-measurement-review";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";
import {
  adminNextFixtureR4Adapter,
  createAdminNextRoofFusionR4Adapter,
  parseAdminNextR4CaseIdentityV1,
} from "@/lib/admin-next/r4-read-adapter";
import { appendAdminNextR4LeadPhotoEvidence } from "@/lib/admin-next/r4-evidence-photo-adapter";
import {
  parseAdminNextRfRoute,
  resolveAdminNextRfWorkbench,
  type AdminNextRfWorkbenchRecoveryReason,
} from "@/lib/admin-next/rf-route-contract";
import { resolveAdminNextServerRead } from "@/lib/admin-next/server-read-resolver";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import { parseLeadPhotoUrls } from "@/lib/lead-photo-token";
import { PayloadRoofSnapshotRepositoryV1 } from "@/lib/roof-fusion/payload-repository-v1";
import {
  AdminRoofFusionPreviewReadAdapterV1,
  PayloadRoofFusionCaseAuthorizationV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";

type Params = Promise<{ caseId: string; measurementId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const unassignedOwner = {
  en: "Unassigned",
  lt: "Nepriskirta",
  nb: "Ikke tildelt",
} as const;

function canonicalOwner(
  assignedTo: { displayName?: string | null } | null | undefined,
  locale: keyof typeof unassignedOwner,
) {
  const displayName = assignedTo?.displayName?.trim() || "";
  return displayName && !displayName.includes("@")
    ? displayName
    : unassignedOwner[locale];
}

function serializeSearchParams(values: Awaited<SearchParams>) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(key, item);
    } else if (value !== undefined) {
      result.append(key, value);
    }
  }
  return result.toString();
}

function recoveryCopy(
  locale: "en" | "lt" | "nb",
  reason: AdminNextRfWorkbenchRecoveryReason,
) {
  const isNew = reason === "new_measurement_unavailable";
  const isMissing = reason === "canonical_snapshot_missing";
  if (locale === "lt") {
    return {
      title: isNew
        ? "Naujas RF matavimas dar neatveriamas"
        : "RF matavimas nepasiekiamas",
      detail: isNew
        ? "Šis Preview workbench yra tik skaitymo režimo. Naują matavimą pradėkite veikiančiame kanoniniame bylos sraute."
        : isMissing
          ? "Kanoninis RF snapshot nerastas. Demo duomenys nebuvo naudojami."
          : "Nuorodos RF kontekstas nebeatitinka kanoninės bylos arba matavimo versijos. Grįžkite į bylą ir atverkite dabartinį matavimą.",
      recovery: "Grįžti į bylą",
    };
  }
  if (locale === "nb") {
    return {
      title: isNew
        ? "Ny RF-måling kan ikke åpnes ennå"
        : "RF-målingen er ikke tilgjengelig",
      detail: isNew
        ? "Denne Preview-arbeidsflaten er skrivebeskyttet. Start en ny måling i den eksisterende canonical saksgangen."
        : isMissing
          ? "Det canonical RF-snapshotet ble ikke funnet. Demo-data ble ikke brukt."
          : "RF-lenkens kontekst samsvarer ikke lenger med canonical sak eller måleversjon. Gå tilbake til saken og åpne gjeldende måling.",
      recovery: "Tilbake til saken",
    };
  }
  return {
    title: isNew
      ? "New RF measurement cannot be opened yet"
      : "RF measurement unavailable",
    detail: isNew
      ? "This Preview workbench is read-only. Start a new measurement in the existing canonical case workflow."
      : isMissing
        ? "The canonical RF snapshot was not found. Demo data was not used."
        : "The RF link no longer matches the canonical case or measurement version. Return to the case and open the current measurement.",
    recovery: "Return to case",
  };
}

function RfWorkbenchRecovery({
  locale,
  reason,
  returnTo,
}: {
  locale: "en" | "lt" | "nb";
  reason: AdminNextRfWorkbenchRecoveryReason;
  returnTo: string;
}) {
  const copy = recoveryCopy(locale, reason);
  return (
    <section
      className="mx-auto max-w-2xl rounded-3xl border border-[var(--an-border-strong)] bg-[var(--an-surface)] p-6 sm:p-8"
      data-rf-load-state={reason}
      role="alert"
    >
      <p className="text-xs font-bold tracking-[.18em] text-[var(--an-amber)] uppercase">
        Roof Fusion
      </p>
      <h1 className="mt-3 text-2xl font-bold text-[var(--an-text)]">
        {copy.title}
      </h1>
      <p className="mt-3 text-sm text-[var(--an-muted)]">{copy.detail}</p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-elevated)] px-4 text-sm font-bold text-[var(--an-text)] hover:border-[var(--an-amber)]"
        href={returnTo}
      >
        {copy.recovery}
      </Link>
    </section>
  );
}

export default async function AdminNextR4MeasurementPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await requireAdminUser();
  const rollout = buildAdminNextRolloutView();
  const access = resolveAdminNextPreviewAccess(rollout, "roofWorkbench");
  if (access.kind === "legacy_fallback") redirect(access.href);

  const [{ caseId, measurementId }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const query = serializeSearchParams(rawSearchParams);
  const route = parseAdminNextRfRoute(
    `/admin-next-preview/cases/${encodeURIComponent(caseId)}/measurements/${encodeURIComponent(measurementId)}${query ? `?${query}` : ""}`,
  );
  if (!route.ok) notFound();
  const routeContext = route.value;
  if (
    routeContext.case.reference !== caseId ||
    (routeContext.mode === "new"
      ? measurementId !== "new"
      : routeContext.measurement.id !== measurementId)
  ) {
    notFound();
  }

  const payload = await getPayload();
  const canonical = createAdminNextRoofFusionR4Adapter(
    new AdminRoofFusionPreviewReadAdapterV1(
      new PayloadRoofSnapshotRepositoryV1(payload),
      new PayloadRoofFusionCaseAuthorizationV1(payload),
    ),
    user as PayloadRequest["user"],
  );
  const selection = resolveAdminNextServerRead({
    moduleId: "roofWorkbench",
    rollout,
    role: user.role,
    canonical,
    fixture: adminNextFixtureR4Adapter,
  });
  if (selection.kind === "legacy_fallback") redirect(selection.href);
  if (routeContext.mode === "new") {
    const resolution = resolveAdminNextRfWorkbench(routeContext, null);
    if (resolution.ok)
      throw new TypeError("New RF route unexpectedly resolved");
    return (
      <RfWorkbenchRecovery
        locale={user.interfaceLanguage}
        reason={resolution.reason}
        returnTo={resolution.returnTo}
      />
    );
  }
  const result = await selection.adapter.load(
    caseId,
    measurementId,
    routeContext.snapshot?.id,
  );

  if (result.status === "not_found") {
    const reason: AdminNextRfWorkbenchRecoveryReason =
      result.reason === "canonical_snapshot_missing"
        ? "canonical_snapshot_missing"
        : result.reason === "measurement_mismatch" ||
            result.reason === "fixture_missing"
          ? "measurement_context_mismatch"
          : "case_context_mismatch";
    return (
      <RfWorkbenchRecovery
        locale={user.interfaceLanguage}
        reason={reason}
        returnTo={routeContext.returnTo}
      />
    );
  }

  if (result.source === "fixture") {
    return (
      <AdminNextR4MeasurementReview
        address={adminNextCaseWorkspaceFixture.address}
        caseReference={caseId}
        customer={adminNextCaseWorkspaceFixture.customer}
        locale={user.interfaceLanguage}
        measurement={result.value}
        owner={adminNextCaseWorkspaceFixture.owner.name}
        returnTo={routeContext.returnTo}
        source="fixture"
      />
    );
  }

  const identity = parseAdminNextR4CaseIdentityV1(caseId);
  if (!identity) notFound();
  const lead = await payload.findByID({
    collection: "leads",
    id: identity.leadId,
    depth: 1,
    overrideAccess: true,
  });
  const resolution = resolveAdminNextRfWorkbench(routeContext, {
    case: {
      id: identity.leadId,
      reference: routeContext.case.reference,
      revision: Number(lead.caseRevision || 1),
    },
    measurement: result.binding.measurement,
    snapshot: result.binding.snapshot,
  });
  if (!resolution.ok) {
    return (
      <RfWorkbenchRecovery
        locale={user.interfaceLanguage}
        reason={resolution.reason}
        returnTo={resolution.returnTo}
      />
    );
  }
  const address = [lead.address, lead.postal, lead.city]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(", ");
  const assignedTo =
    lead.assignedTo && typeof lead.assignedTo === "object"
      ? lead.assignedTo
      : null;
  const measurement = appendAdminNextR4LeadPhotoEvidence({
    measurement: result.value,
    leadId: identity.leadId,
    photoCount: parseLeadPhotoUrls(lead.photoUrls).length,
    capturedAt: lead.updatedAt,
    locale: user.interfaceLanguage,
  });

  return (
    <AdminNextR4MeasurementReview
      address={address}
      caseReference={caseId}
      customer={lead.name}
      locale={user.interfaceLanguage}
      measurement={measurement}
      owner={canonicalOwner(assignedTo, user.interfaceLanguage)}
      returnTo={routeContext.returnTo}
      source="canonical"
    />
  );
}
