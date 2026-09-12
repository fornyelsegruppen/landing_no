// Increment whenever deterministic publication rules change. Stored JSON from
// older policies is evidence of its old check, never approval under new rules.
export const BLOG_QUALITY_POLICY_VERSION = "2026-09-12-repetition-v1";

export function hasCurrentBlogQuality(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "policyVersion" in value &&
    value.policyVersion === BLOG_QUALITY_POLICY_VERSION,
  );
}

export function currentBlogQualityPassed(value: unknown): boolean {
  return (
    hasCurrentBlogQuality(value) &&
    (value as { passed?: unknown }).passed === true
  );
}
