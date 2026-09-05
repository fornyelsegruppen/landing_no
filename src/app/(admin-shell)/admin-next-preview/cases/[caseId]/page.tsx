import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminAsyncFeedback } from "@/components/admin-next/admin-async-feedback";
import type { PayloadRequest } from "payload";
import { AdminNextCaseWorkspace } from "@/components/admin-next/admin-next-case-workspace";
import type { CaseNextActionCapability } from "@/lib/admin-v2/case-next-action-presentation";
import { adminNextRoleHasReadCapability } from "@/lib/admin-next/capability-registry";
import { loadAdminNextCaseWorkspace } from "@/lib/admin-next/case-workspace-contract";
import { adminNextFixtureCaseWorkspaceAdapter } from "@/lib/admin-next/case-workspace-fixture";
import { createAdminNextCanonicalCaseWorkspaceAdapter } from "@/lib/admin-next/case-read-adapter";
import {
  adminNextPreviewWorkQueueEntry,
  safeAdminNextWorkQueueReturnTo,
} from "@/lib/admin-next/work-queue-navigation";
import { resolveAdminNextServerRead } from "@/lib/admin-next/server-read-resolver";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { resolvePreviewE2eOperatorCapabilities } from "@/lib/admin-next/preview-e2e-operator-capabilities";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { adminNextReplyDraftingReadiness } from "@/lib/admin-next/reply-drafting-readiness";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import { PayloadRoofSnapshotRepositoryV1 } from "@/lib/roof-fusion/payload-repository-v1";
import {
  AdminRoofFusionPreviewReadAdapterV1,
  PayloadRoofFusionCaseAuthorizationV1,
} from "@/lib/roof-fusion/preview-read-adapters-v1";

type Params = Promise<{ caseId: string }>;
type SearchParams = Promise<{
  returnTo?: string | string[];
}>;

const loadErrorCopy = {
  nb: {
    action: "Laster canonical sak",
    message:
      "Saken kunne ikke lastes fra canonical data. Ingen syntetiske data ble vist.",
    recovery: "Åpne eksisterende saker",
  },
  lt: {
    action: "Įkeliama canonical byla",
    message:
      "Bylos nepavyko įkelti iš canonical duomenų. Sintetiniai duomenys nebuvo parodyti.",
    recovery: "Atverti esamas bylas",
  },
  en: {
    action: "Loading canonical case",
    message:
      "The case could not be loaded from canonical data. No synthetic data was shown.",
    recovery: "Open existing cases",
  },
} as const;

function CaseWorkspaceLoadError({
  locale,
  recoveryHref,
}: {
  locale: keyof typeof loadErrorCopy;
  recoveryHref: string;
}) {
  const copy = loadErrorCopy[locale];
  return (
    <section
      className="mx-auto max-w-[900px] space-y-4"
      data-case-workspace-load-state="canonical_error"
    >
      <AdminAsyncFeedback
        action={copy.action}
        locale={locale}
        message={copy.message}
        state="error"
      />
      <Link
        className="inline-flex min-h-11 items-center rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-surface-base)] px-4 text-sm font-bold text-[var(--an-text-primary)]"
        href={recoveryHref}
      >
        {copy.recovery}
      </Link>
    </section>
  );
}

export default async function AdminNextCaseWorkspacePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const user = await requireAdminUser();
  const rollout = buildAdminNextRolloutView();
  const access = resolveAdminNextPreviewAccess(rollout, "caseWorkspace");
  if (access.kind === "legacy_fallback") redirect(access.href);
  const roofWorkbenchAccess = resolveAdminNextPreviewAccess(
    rollout,
    "roofWorkbench",
  );
  const canReadCases = adminNextRoleHasReadCapability(user.role, "case.read");
  const grantedCapabilities = canReadCases
    ? [
        ...new Set<CaseNextActionCapability>([
          "case.read",
          ...resolvePreviewE2eOperatorCapabilities({ role: user.role }),
        ]),
      ]
    : [];

  const { caseId } = await params;
  const rawReturnTo = (await searchParams)?.returnTo;
  const expectedCaseReference = /^TF-[1-9]\d*$/u.test(caseId)
    ? caseId
    : /^[1-9]\d*$/u.test(caseId)
      ? `TF-${caseId}`
      : undefined;
  const returnTo =
    (typeof rawReturnTo === "string" && expectedCaseReference
      ? safeAdminNextWorkQueueReturnTo(rawReturnTo, expectedCaseReference)
      : null) ?? adminNextPreviewWorkQueueEntry;
  let canonical;
  if (process.env.VERCEL_ENV === "preview") {
    try {
      const payload = await getPayload();
      const rfReview =
        roofWorkbenchAccess.kind === "legacy_fallback" || !canReadCases
          ? undefined
          : {
              reader: new AdminRoofFusionPreviewReadAdapterV1(
                new PayloadRoofSnapshotRepositoryV1(payload),
                new PayloadRoofFusionCaseAuthorizationV1(payload),
              ),
              user: user as PayloadRequest["user"],
            };
      canonical = createAdminNextCanonicalCaseWorkspaceAdapter(
        payload,
        user.interfaceLanguage,
        { viewerRole: user.role, grantedCapabilities, rfReview },
      );
    } catch {
      return (
        <CaseWorkspaceLoadError
          locale={user.interfaceLanguage}
          recoveryHref={returnTo}
        />
      );
    }
  }
  const selection = resolveAdminNextServerRead({
    moduleId: "caseWorkspace",
    rollout,
    role: user.role,
    canonical,
    fixture: adminNextFixtureCaseWorkspaceAdapter,
  });
  if (selection.kind === "legacy_fallback") redirect(selection.href);
  let result;
  try {
    result = await loadAdminNextCaseWorkspace(selection.adapter, caseId);
  } catch {
    return (
      <CaseWorkspaceLoadError
        locale={user.interfaceLanguage}
        recoveryHref={returnTo}
      />
    );
  }

  if (result.status === "not_found") notFound();
  if (
    (selection.kind === "canonical_read" && result.source !== "canonical") ||
    (selection.kind === "fixture_fallback" && result.source !== "fixture")
  ) {
    return (
      <CaseWorkspaceLoadError
        locale={user.interfaceLanguage}
        recoveryHref={returnTo}
      />
    );
  }

  return (
    <AdminNextCaseWorkspace
      locale={user.interfaceLanguage}
      replyDrafting={adminNextReplyDraftingReadiness()}
      replyPermissions={{
        approveSend: grantedCapabilities.includes("message.approve_send"),
        prepareGeneral: grantedCapabilities.includes("case.reply.prepare"),
        prepareQuestion: grantedCapabilities.includes(
          "case.question.reply.prepare",
        ),
      }}
      returnTo={returnTo}
      source={result.source}
      value={result.value}
    />
  );
}
