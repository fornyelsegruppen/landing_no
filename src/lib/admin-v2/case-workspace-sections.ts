export const caseWorkspaceSectionKeys = [
  "customer",
  "measurement",
  "commercial",
  "messages",
  "contract",
  "work",
  "changes",
  "documents",
  "history",
] as const;

export type CaseWorkspaceSectionKey = (typeof caseWorkspaceSectionKeys)[number];

export type CaseWorkspaceSectionLabelKey =
  `sections.${CaseWorkspaceSectionKey}`;

export type CaseWorkspaceSection = {
  id: string;
  key: CaseWorkspaceSectionKey;
  labelKey: CaseWorkspaceSectionLabelKey;
};

/**
 * Canonical V3 context-section registry. Navigation, process stages and the
 * rendered section headings must consume these IDs instead of duplicating
 * fragment strings.
 */
export const caseWorkspaceSections = [
  {
    id: "customer-section",
    key: "customer",
    labelKey: "sections.customer",
  },
  {
    id: "measurement-section",
    key: "measurement",
    labelKey: "sections.measurement",
  },
  {
    id: "price-quote-section",
    key: "commercial",
    labelKey: "sections.commercial",
  },
  {
    id: "messages-section",
    key: "messages",
    labelKey: "sections.messages",
  },
  {
    id: "contract-section",
    key: "contract",
    labelKey: "sections.contract",
  },
  { id: "work-section", key: "work", labelKey: "sections.work" },
  {
    id: "changes-section",
    key: "changes",
    labelKey: "sections.changes",
  },
  {
    id: "documents-section",
    key: "documents",
    labelKey: "sections.documents",
  },
  {
    id: "timeline-section",
    key: "history",
    labelKey: "sections.history",
  },
] as const satisfies readonly CaseWorkspaceSection[];

export const caseWorkspaceSectionByKey = Object.fromEntries(
  caseWorkspaceSections.map((section) => [section.key, section]),
) as Record<CaseWorkspaceSectionKey, (typeof caseWorkspaceSections)[number]>;

export function caseWorkspaceSectionHref(key: CaseWorkspaceSectionKey) {
  return `#${caseWorkspaceSectionByKey[key].id}` as const;
}

/**
 * Current non-context anchors are inventoried here while V3 is introduced.
 * Keeping them explicit prevents a broad "any hash is valid" escape hatch.
 */
export const caseWorkspaceSpecialTargets = [
  "next-action-title",
  "case-primary-action",
  "case-lifecycle-title",
  "version-history-section",
  "version-history-title",
  "ai-section",
  "cancellation-review",
  "contract-request-section",
  "change-agreement-workbench",
  "commercial-editor",
  "work-planning",
  "completion-review",
] as const;

const dynamicEntityTargetPatterns = [
  /^message-\d+$/,
  /^invoice-\d+$/,
  /^warranty-\d+$/,
] as const;

const registeredTargetIds = new Set<string>([
  ...caseWorkspaceSections.map((section) => section.id),
  ...caseWorkspaceSpecialTargets,
]);

export function caseWorkspaceTargetId(href: string) {
  if (!href.startsWith("#") || href.length < 2) return null;
  try {
    return decodeURIComponent(href.slice(1));
  } catch {
    return null;
  }
}

export function isCaseWorkspaceInternalTarget(href: string) {
  const targetId = caseWorkspaceTargetId(href);
  if (!targetId) return false;
  return (
    registeredTargetIds.has(targetId) ||
    dynamicEntityTargetPatterns.some((pattern) => pattern.test(targetId))
  );
}

export function validateCaseWorkspaceInternalTargets(hrefs: readonly string[]) {
  return hrefs.filter((href) => !isCaseWorkspaceInternalTarget(href));
}
