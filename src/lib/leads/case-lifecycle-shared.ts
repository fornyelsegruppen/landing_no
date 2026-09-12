// Shared vocabulary only: safe for both client UI and server lifecycle commands.
export const archiveClassifications = [
  "completed",
  "declined",
  "lost",
  "invalid",
  "spam",
  "duplicate",
  "other",
] as const;

export type ArchiveClassification = (typeof archiveClassifications)[number];
export type CaseRecordState = "active" | "archived" | "trashed";
