export const ADMIN_NEXT_RF_ROUTE_VERSION = "admin-next-rf-route.v1" as const;

export const adminNextRfReturnTabs = [
  "overview",
  "customer",
  "process",
  "measurement",
  "evidence",
  "offer",
  "contract",
  "work",
  "communications",
  "documents",
  "history",
  "timeline",
] as const;

export type AdminNextRfReturnTab = (typeof adminNextRfReturnTabs)[number];

const canonicalReturnHashes = new Set([
  "case-primary-action-panel",
  "next-action-title",
  "customer-section",
  "measurement-section",
  "price-quote-section",
  "messages-section",
  "contract-section",
  "contract-request-section",
  "work-section",
  "work-planning",
  "completion-review",
  "changes-section",
  "documents-section",
  "version-history-section",
]);

const previewReturnHashes = new Set([
  "case-next-action-title",
  "case-progress-title",
  "case-evidence-title",
  "case-timeline-title",
]);

const returnTabs = new Set<string>(adminNextRfReturnTabs);
const allowedRouteQueryKeys = new Set([
  "mode",
  "caseRevision",
  "measurementRevision",
  "snapshotId",
  "snapshotRevision",
  "snapshotHash",
  "blocker",
  "evidence",
  "returnTo",
]);
const singleRouteQueryKeys = [...allowedRouteQueryKeys].filter(
  (key) => key !== "evidence",
);

const MAX_ROUTE_LENGTH = 8_192;
const MAX_RETURN_TO_LENGTH = 2_048;
const MAX_EVIDENCE_REFERENCES = 16;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const blockerPattern = /^[a-z][a-z0-9._-]{0,79}$/u;
const snapshotHashPattern = /^[a-f0-9]{64}$/u;

export type AdminNextRfCaseIdentity = {
  id: number;
  reference: `TF-${number}`;
  revision: number;
};

export type AdminNextRfVersionedReference = {
  id: string;
  revision: number;
};

export type AdminNextRfSnapshotReference = AdminNextRfVersionedReference & {
  hash: string;
};

type AdminNextRfRouteBase = {
  version: typeof ADMIN_NEXT_RF_ROUTE_VERSION;
  case: AdminNextRfCaseIdentity;
  blocker: string | null;
  evidence: readonly string[];
  returnTo: string;
};

export type AdminNextRfNewRoute = AdminNextRfRouteBase & {
  mode: "new";
  measurement: null;
  snapshot: null;
};

export type AdminNextRfResumeRoute = AdminNextRfRouteBase & {
  mode: "resume";
  measurement: AdminNextRfVersionedReference;
  snapshot: AdminNextRfSnapshotReference | null;
};

export type AdminNextRfReviewRoute = AdminNextRfRouteBase & {
  mode: "review";
  measurement: AdminNextRfVersionedReference;
  snapshot: AdminNextRfSnapshotReference;
};

export type AdminNextRfRoute =
  AdminNextRfNewRoute | AdminNextRfResumeRoute | AdminNextRfReviewRoute;

export type AdminNextRfCanonicalWorkbenchBinding = {
  case: AdminNextRfCaseIdentity;
  measurement: AdminNextRfVersionedReference;
  snapshot: AdminNextRfSnapshotReference;
};

/**
 * RoofSnapshotV1 is the versioned RF measurement aggregate. The route repeats
 * its snapshotId/revision as the measurement path identity; a snapshot query
 * adds the immutable hash pin, but cannot identify a different object/version.
 */
function hasAlignedSnapshotIdentity(
  measurement: AdminNextRfVersionedReference,
  snapshot: AdminNextRfSnapshotReference,
) {
  return (
    measurement.id === snapshot.id &&
    measurement.revision === snapshot.revision
  );
}

export type AdminNextRfWorkbenchRecoveryReason =
  | "new_measurement_unavailable"
  | "canonical_snapshot_missing"
  | "case_context_mismatch"
  | "case_revision_stale"
  | "measurement_context_mismatch"
  | "measurement_revision_stale"
  | "snapshot_context_mismatch"
  | "snapshot_revision_stale"
  | "snapshot_hash_stale";

export type AdminNextRfWorkbenchResolution =
  | {
      ok: true;
      mode: "resume" | "review";
      returnTo: string;
    }
  | {
      ok: false;
      reason: AdminNextRfWorkbenchRecoveryReason;
      returnTo: string;
    };

export type AdminNextRfReturnToFailure =
  | "empty"
  | "too_long"
  | "malformed_encoding"
  | "not_relative"
  | "origin_not_allowed"
  | "path_not_allowed"
  | "case_mismatch"
  | "query_not_allowed"
  | "hash_not_allowed";

export type AdminNextRfReturnToResult =
  | { ok: true; value: string }
  | { ok: false; reason: AdminNextRfReturnToFailure };

export type AdminNextRfRouteFailure =
  | "empty"
  | "too_long"
  | "malformed_encoding"
  | "not_relative"
  | "origin_not_allowed"
  | "path_not_allowed"
  | "query_not_allowed"
  | "invalid_context"
  | "invalid_return_to";

export type AdminNextRfRouteParseResult =
  | { ok: true; value: AdminNextRfRoute }
  | { ok: false; reason: AdminNextRfRouteFailure };

/**
 * Binds a parsed route to canonical read truth. This deliberately does not
 * create a measurement: Preview owns reads only, while mutations remain with
 * the existing canonical measurement workflow.
 */
export function resolveAdminNextRfWorkbench(
  route: AdminNextRfRoute,
  binding: AdminNextRfCanonicalWorkbenchBinding | null,
): AdminNextRfWorkbenchResolution {
  const recovery = (reason: AdminNextRfWorkbenchRecoveryReason) =>
    ({ ok: false, reason, returnTo: route.returnTo }) as const;

  if (route.mode === "new") return recovery("new_measurement_unavailable");
  if (
    route.snapshot &&
    !hasAlignedSnapshotIdentity(route.measurement, route.snapshot)
  ) {
    return recovery("snapshot_context_mismatch");
  }
  if (!binding) return recovery("canonical_snapshot_missing");
  if (!hasAlignedSnapshotIdentity(binding.measurement, binding.snapshot)) {
    return recovery("snapshot_context_mismatch");
  }
  if (
    !isMatchingCaseIdentity(binding.case) ||
    binding.case.id !== route.case.id ||
    binding.case.reference !== route.case.reference
  ) {
    return recovery("case_context_mismatch");
  }
  if (binding.case.revision !== route.case.revision) {
    return recovery("case_revision_stale");
  }
  if (binding.measurement.id !== route.measurement.id) {
    return recovery("measurement_context_mismatch");
  }
  if (binding.measurement.revision !== route.measurement.revision) {
    return recovery("measurement_revision_stale");
  }
  if (route.snapshot) {
    if (binding.snapshot.id !== route.snapshot.id) {
      return recovery("snapshot_context_mismatch");
    }
    if (binding.snapshot.revision !== route.snapshot.revision) {
      return recovery("snapshot_revision_stale");
    }
    if (binding.snapshot.hash !== route.snapshot.hash) {
      return recovery("snapshot_hash_stale");
    }
  }
  return { ok: true, mode: route.mode, returnTo: route.returnTo };
}

function hasValidPercentEncoding(value: string) {
  try {
    decodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

function parsePositiveInteger(value: string | null) {
  if (!value || !/^[1-9]\d*$/u.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}

function isIdentifier(value: string | null): value is string {
  return value !== null && identifierPattern.test(value);
}

function parseCaseReference(value: string) {
  const match = /^TF-([1-9]\d*)$/u.exec(value);
  if (!match) return null;
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id)) return null;
  return { id, reference: value as `TF-${number}` };
}

function isMatchingCaseIdentity(
  value: Pick<AdminNextRfCaseIdentity, "id" | "reference">,
) {
  const parsed = parseCaseReference(value.reference);
  return parsed !== null && parsed.id === value.id;
}

function isRelativeLocalUrl(value: string, maxLength: number) {
  if (!value || value.length > maxLength) return false;
  if (
    value !== value.trim() ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return false;
  }
  return hasValidPercentEncoding(value);
}

function parseRelativeLocalUrl(value: string, maxLength: number) {
  if (!isRelativeLocalUrl(value, maxLength)) return null;
  try {
    const url = new URL(value, "https://admin.invalid");
    if (url.origin !== "https://admin.invalid") return null;
    const rawPath = value.split(/[?#]/u, 1)[0];
    if (rawPath !== url.pathname) return null;
    return url;
  } catch {
    return null;
  }
}

function hasOnlySingleQueryValue(params: URLSearchParams, key: string) {
  return params.getAll(key).length <= 1;
}

function validateReturnQuery(params: URLSearchParams) {
  for (const key of params.keys()) {
    if (key !== "tab") return false;
  }
  const tabs = params.getAll("tab");
  return tabs.length <= 1 && (tabs.length === 0 || returnTabs.has(tabs[0]));
}

export function validateAdminNextRfReturnTo(
  value: string,
  expectedCase: Pick<AdminNextRfCaseIdentity, "id" | "reference">,
): AdminNextRfReturnToResult {
  if (!isMatchingCaseIdentity(expectedCase)) {
    return { ok: false, reason: "case_mismatch" };
  }
  if (!value) return { ok: false, reason: "empty" };
  if (value.length > MAX_RETURN_TO_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  if (!hasValidPercentEncoding(value)) {
    return { ok: false, reason: "malformed_encoding" };
  }
  if (
    value !== value.trim() ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return { ok: false, reason: "not_relative" };
  }

  let url: URL;
  try {
    url = new URL(value, "https://admin.invalid");
  } catch {
    return { ok: false, reason: "not_relative" };
  }
  if (url.origin !== "https://admin.invalid") {
    return { ok: false, reason: "origin_not_allowed" };
  }
  const rawPath = value.split(/[?#]/u, 1)[0];
  if (rawPath !== url.pathname) {
    return { ok: false, reason: "path_not_allowed" };
  }

  const canonical = /^\/admin-v2\/cases\/([1-9]\d*)$/u.exec(url.pathname);
  const preview = /^\/admin-next-preview\/cases\/(TF-[1-9]\d*)$/u.exec(
    url.pathname,
  );
  if (!canonical && !preview) {
    return { ok: false, reason: "path_not_allowed" };
  }
  if (
    (canonical && Number(canonical[1]) !== expectedCase.id) ||
    (preview && preview[1] !== expectedCase.reference)
  ) {
    return { ok: false, reason: "case_mismatch" };
  }
  if (!validateReturnQuery(url.searchParams)) {
    return { ok: false, reason: "query_not_allowed" };
  }

  const hash = url.hash.slice(1);
  if (hash) {
    const allowedHashes = canonical
      ? canonicalReturnHashes
      : previewReturnHashes;
    if (!allowedHashes.has(hash)) {
      return { ok: false, reason: "hash_not_allowed" };
    }
  }
  return { ok: true, value };
}

export function safeAdminNextRfReturnTo(
  value: string | null | undefined,
  expectedCase: Pick<AdminNextRfCaseIdentity, "id" | "reference">,
) {
  if (!value) return null;
  const result = validateAdminNextRfReturnTo(value, expectedCase);
  return result.ok ? result.value : null;
}

function decodePathIdentifier(value: string) {
  if (!hasValidPercentEncoding(value)) return null;
  const decoded = decodeURIComponent(value);
  if (encodeURIComponent(decoded) !== value || !isIdentifier(decoded))
    return null;
  return decoded;
}

function validateRouteQuery(params: URLSearchParams) {
  for (const key of params.keys()) {
    if (!allowedRouteQueryKeys.has(key)) return false;
  }
  return singleRouteQueryKeys.every((key) =>
    hasOnlySingleQueryValue(params, key),
  );
}

function snapshotFromQuery(params: URLSearchParams) {
  const id = params.get("snapshotId");
  const revision = parsePositiveInteger(params.get("snapshotRevision"));
  const hash = params.get("snapshotHash");
  const presentCount = [id, params.get("snapshotRevision"), hash].filter(
    (value) => value !== null,
  ).length;
  if (presentCount === 0) return { kind: "absent" } as const;
  if (
    presentCount !== 3 ||
    !isIdentifier(id) ||
    revision === null ||
    !hash ||
    !snapshotHashPattern.test(hash)
  ) {
    return { kind: "invalid" } as const;
  }
  return { kind: "present", value: { id, revision, hash } } as const;
}

export function parseAdminNextRfRoute(
  value: string,
): AdminNextRfRouteParseResult {
  if (!value) return { ok: false, reason: "empty" };
  if (value.length > MAX_ROUTE_LENGTH) return { ok: false, reason: "too_long" };
  if (!hasValidPercentEncoding(value)) {
    return { ok: false, reason: "malformed_encoding" };
  }
  if (
    value !== value.trim() ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return { ok: false, reason: "not_relative" };
  }
  const url = parseRelativeLocalUrl(value, MAX_ROUTE_LENGTH);
  if (!url) return { ok: false, reason: "origin_not_allowed" };
  if (url.hash) return { ok: false, reason: "path_not_allowed" };

  const path =
    /^\/admin-next-preview\/cases\/([^/]+)\/measurements\/([^/]+)$/u.exec(
      url.pathname,
    );
  if (!path) return { ok: false, reason: "path_not_allowed" };
  const caseIdentity = parseCaseReference(path[1]);
  const rawMeasurementId = path[2];
  if (!caseIdentity || !validateRouteQuery(url.searchParams)) {
    return {
      ok: false,
      reason: caseIdentity ? "query_not_allowed" : "invalid_context",
    };
  }

  const mode = url.searchParams.get("mode");
  if (mode !== "new" && mode !== "resume" && mode !== "review") {
    return { ok: false, reason: "invalid_context" };
  }
  const caseRevision = parsePositiveInteger(
    url.searchParams.get("caseRevision"),
  );
  const blocker = url.searchParams.get("blocker");
  const evidence = url.searchParams.getAll("evidence");
  const returnTo = url.searchParams.get("returnTo");
  if (
    caseRevision === null ||
    (blocker !== null && !blockerPattern.test(blocker)) ||
    evidence.length > MAX_EVIDENCE_REFERENCES ||
    evidence.some((item) => !isIdentifier(item)) ||
    new Set(evidence).size !== evidence.length ||
    !returnTo
  ) {
    return { ok: false, reason: "invalid_context" };
  }

  const caseValue: AdminNextRfCaseIdentity = {
    ...caseIdentity,
    revision: caseRevision,
  };
  if (!validateAdminNextRfReturnTo(returnTo, caseValue).ok) {
    return { ok: false, reason: "invalid_return_to" };
  }

  const measurementRevision = parsePositiveInteger(
    url.searchParams.get("measurementRevision"),
  );
  const snapshot = snapshotFromQuery(url.searchParams);
  const base = {
    version: ADMIN_NEXT_RF_ROUTE_VERSION,
    case: caseValue,
    blocker,
    evidence,
    returnTo,
  } as const;

  if (mode === "new") {
    if (
      rawMeasurementId !== "new" ||
      measurementRevision !== null ||
      snapshot.kind !== "absent"
    ) {
      return { ok: false, reason: "invalid_context" };
    }
    return {
      ok: true,
      value: { ...base, mode, measurement: null, snapshot: null },
    };
  }

  const measurementId = decodePathIdentifier(rawMeasurementId);
  if (
    !measurementId ||
    measurementId === "new" ||
    measurementRevision === null
  ) {
    return { ok: false, reason: "invalid_context" };
  }
  const measurement = { id: measurementId, revision: measurementRevision };
  if (mode === "resume") {
    if (
      snapshot.kind === "invalid" ||
      (snapshot.kind === "present" &&
        !hasAlignedSnapshotIdentity(measurement, snapshot.value))
    ) {
      return { ok: false, reason: "invalid_context" };
    }
    return {
      ok: true,
      value: {
        ...base,
        mode,
        measurement,
        snapshot: snapshot.kind === "present" ? snapshot.value : null,
      },
    };
  }
  if (
    snapshot.kind !== "present" ||
    !hasAlignedSnapshotIdentity(measurement, snapshot.value)
  ) {
    return { ok: false, reason: "invalid_context" };
  }
  return {
    ok: true,
    value: { ...base, mode, measurement, snapshot: snapshot.value },
  };
}

export function buildAdminNextRfRoute(value: AdminNextRfRoute) {
  if (!isMatchingCaseIdentity(value.case)) {
    throw new TypeError("RF route case id and reference do not match");
  }
  const returnTo = validateAdminNextRfReturnTo(value.returnTo, value.case);
  if (!returnTo.ok) {
    throw new TypeError(`RF route returnTo is not allowed: ${returnTo.reason}`);
  }
  if (
    value.mode !== "new" &&
    value.snapshot &&
    !hasAlignedSnapshotIdentity(value.measurement, value.snapshot)
  ) {
    throw new TypeError(
      "RF route measurement must identify the same RoofSnapshotV1 id and revision as its snapshot pin",
    );
  }

  const measurementId = value.mode === "new" ? "new" : value.measurement.id;
  const params = new URLSearchParams();
  params.set("mode", value.mode);
  params.set("caseRevision", String(value.case.revision));
  if (value.mode !== "new") {
    params.set("measurementRevision", String(value.measurement.revision));
  }
  if (value.snapshot) {
    params.set("snapshotId", value.snapshot.id);
    params.set("snapshotRevision", String(value.snapshot.revision));
    params.set("snapshotHash", value.snapshot.hash);
  }
  if (value.blocker) params.set("blocker", value.blocker);
  for (const evidence of value.evidence) params.append("evidence", evidence);
  params.set("returnTo", returnTo.value);

  const route = `/admin-next-preview/cases/${value.case.reference}/measurements/${encodeURIComponent(measurementId)}?${params.toString()}`;
  const parsed = parseAdminNextRfRoute(route);
  if (!parsed.ok) {
    throw new TypeError(`RF route context is invalid: ${parsed.reason}`);
  }
  return route;
}
