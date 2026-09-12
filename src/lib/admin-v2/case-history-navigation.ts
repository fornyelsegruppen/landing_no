export type CaseHistoryNavigationContext = {
  caseId: number;
  messages: {
    requested?: string | string[];
    page: number;
    totalPages: number;
    ids: number[];
  };
  documents: {
    requested?: string | string[];
    page: number;
    totalPages: number;
  };
};

type HistoryLocation = { pathname: string; search: string; hash: string };
export type CaseHistoryNavigationTarget = {
  section: "messages" | "documents";
  targetId: string;
};

/** Only activate existing registry targets backed by the current server page. */
export function resolveCaseHistoryNavigation(
  context: CaseHistoryNavigationContext,
  location: HistoryLocation,
): CaseHistoryNavigationTarget | null {
  if (location.pathname !== `/admin-v2/cases/${context.caseId}`) return null;
  const params = new URLSearchParams(location.search);
  for (const [key, page] of [
    ["messagePage", context.messages],
    ["documentPage", context.documents],
  ] as const) {
    const values = params.getAll(key);
    // A popstate may arrive before the new RSC page: never select stale data.
    if (values.length > 1 || Array.isArray(page.requested)) return null;
    if (values[0] !== page.requested) return null;
    const value = values[0];
    if (value !== undefined && !/^[1-9]\d*$/.test(value)) return null;
    const number = value === undefined ? 1 : Number(value);
    if (
      !Number.isSafeInteger(number) ||
      number > Math.max(1, page.totalPages) ||
      number !== page.page
    )
      return null;
  }

  let fragment: string;
  try {
    fragment = decodeURIComponent(location.hash.replace(/^#/, ""));
  } catch {
    return null;
  }
  if (fragment === "messages-section")
    return { section: "messages", targetId: fragment };
  if (fragment === "documents-section")
    return { section: "documents", targetId: fragment };
  if (/^message-[1-9]\d*$/.test(fragment)) {
    const id = Number(fragment.slice("message-".length));
    return Number.isSafeInteger(id) && context.messages.ids.includes(id)
      ? { section: "messages", targetId: fragment }
      : null;
  }
  // Do not reinterpret unknown fragments or ambiguous dual-page URLs.
  if (fragment) return null;
  const messages = params.has("messagePage");
  const documents = params.has("documentPage");
  if (messages === documents) return null;
  return messages
    ? { section: "messages", targetId: "messages-section" }
    : { section: "documents", targetId: "documents-section" };
}

/** Consume URL intent once, so rerenders never override a user's selection/close. */
export function createCaseHistoryNavigationGate() {
  let observedLocation: string | undefined;
  let consumed = false;
  return (context: CaseHistoryNavigationContext, location: HistoryLocation) => {
    const key = `${location.pathname}${location.search}${location.hash}`;
    if (key !== observedLocation) {
      observedLocation = key;
      consumed = false;
    }
    if (consumed) return null;
    const target = resolveCaseHistoryNavigation(context, location);
    if (target) consumed = true;
    return target;
  };
}
