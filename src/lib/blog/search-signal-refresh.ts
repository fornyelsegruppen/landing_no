import type { SearchSignal } from "@/lib/providers/contracts";
import {
  candidateFromSignal,
  sourceMetricsFromSignal,
  topicScore,
  type TopicCandidate,
} from "./topic-engine";

export type RefreshableSeoTopic = {
  id: number | string;
  primaryKeyword?: string | null;
  searchIntent?: TopicCandidate["searchIntent"] | null;
  status?: string | null;
  relatedPost?: unknown;
  sourceMetrics?: unknown;
};

export type SearchSignalRefreshPlan =
  | { action: "no-data"; reason: "no-observation" }
  | { action: "ignored"; reason: "invalid-or-out-of-scope" }
  | { action: "create"; candidate: TopicCandidate; sourceMetrics: Record<string, unknown>; topicScore: number }
  | { action: "skip"; reason: "protected-topic"; topicId: number | string }
  | { action: "update"; topicId: number | string; candidate: TopicCandidate; sourceMetrics: Record<string, unknown>; topicScore: number };

const protectedStatuses = new Set(["queued", "drafted", "approved", "published"]);

function existingSourceHistory(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const metrics = value as { source?: unknown; provenanceSources?: unknown };
  const sources = [
    ...(typeof metrics.source === "string" ? [metrics.source] : []),
    ...(Array.isArray(metrics.provenanceSources)
      ? metrics.provenanceSources.filter((source): source is string => typeof source === "string")
      : []),
  ];
  return [...new Set(sources)];
}

function refreshedSourceMetrics(existing: RefreshableSeoTopic | undefined, signal: SearchSignal, importedAt: string) {
  const latest = sourceMetricsFromSignal(signal, importedAt) as Record<string, unknown>;
  const provenanceSources = [...new Set([...existingSourceHistory(existing?.sourceMetrics), signal.source])];
  return {
    ...latest,
    ...(provenanceSources.length > 1 ? { provenanceSources } : {}),
  };
}

function matchesCandidate(topic: RefreshableSeoTopic, candidate: TopicCandidate) {
  return (
    topic.primaryKeyword?.toLocaleLowerCase("nb-NO") === candidate.primaryKeyword &&
    topic.searchIntent === candidate.searchIntent
  );
}

/**
 * Pure handoff for a database writer. It replaces a measurement snapshot
 * instead of summing repeat imports and never mutates a topic already in use.
 */
export function planSearchSignalRefresh(input: {
  signal?: SearchSignal;
  existingTopics: RefreshableSeoTopic[];
  importedAt: string;
  now?: Date;
}): SearchSignalRefreshPlan {
  if (!input.signal) return { action: "no-data", reason: "no-observation" };
  const candidate = candidateFromSignal(input.signal, input.now);
  if (!candidate) return { action: "ignored", reason: "invalid-or-out-of-scope" };
  const existing = input.existingTopics.find((topic) => matchesCandidate(topic, candidate));
  const sourceMetrics = refreshedSourceMetrics(existing, input.signal, input.importedAt);
  const score = topicScore(candidate.factors);
  if (!existing) return { action: "create", candidate, sourceMetrics, topicScore: score };
  if (protectedStatuses.has(existing.status || "") || existing.relatedPost) {
    return { action: "skip", reason: "protected-topic", topicId: existing.id };
  }
  return { action: "update", topicId: existing.id, candidate, sourceMetrics, topicScore: score };
}
