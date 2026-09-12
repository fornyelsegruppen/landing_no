# Search-signal provenance

`seo-topics.sourceMetrics` keeps only aggregated evidence from an accepted
search signal. It records the allowlisted source, known ingestion origin,
zero-valued metrics, the import timestamp, and any explicit observation period.
The import timestamp is not an observation date. Missing period or geographic
coverage is labelled `unknown`; query wording does not establish geography.

CSV imports are labelled `csv-import`, including a CSV selected as Google Trends.
They are not represented as live Google Trends API data. A direct Search Console
provider result is labelled `api`. Manually curated seeds have no `sourceMetrics`
entry because they do not carry measured source evidence.

## Deferred deliberately

- No Google Trends scraping, API integration, or external provider call is added.
- No geography, service-area, demographic, recency, or freshness claim is
  inferred from search-query text.
- The topic scoring model, admin UI, scheduling, deployment, and database schema
  are unchanged.
- Multiple CSV rows for the same query with different observation periods retain
  their aggregate metrics but intentionally report observation-period coverage as
  unknown instead of inventing one combined date range.
