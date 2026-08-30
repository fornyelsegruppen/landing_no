# Operational jobs scheduler ownership — 2026-08-30

Production uses one periodic scheduler for operational jobs:

- GitHub Actions calls `/api/cron/operational-jobs?limit=50` every 15 minutes.
- The release pull request must merge
  `.github/workflows/operational-jobs.yml` into the repository's default
  `main` branch, because scheduled workflows run from the default branch.
- The workflow sends `Authorization: Bearer <CRON_SECRET>` from the repository
  secret `TAKFORNYELSE_CRON_SECRET`. The route rejects missing or incorrect
  credentials before loading Payload or processing jobs.
- `vercel.json` deliberately does not schedule the operational-jobs route. The
  Vercel Hobby plan cannot accept a 15-minute cron, and omitting it also prevents
  two independent periodic sources from overlapping.

Before configuring `CRON_SECRET`, review due purge candidates and all due,
retrying, running, stale and attention jobs. Keep
`AUTOMATION_EMERGENCY_PAUSE=true` and the controlled-pilot automation feature
flags disabled during the initial deployment. An authorized operational-jobs
request can still reconcile or process eligible queue entries, so the queue
inventory remains a mandatory activation gate.

The job processor retains its conditional database claim and idempotency keys
as defense in depth. They do not replace single-scheduler ownership. The
workflow's concurrency group also prevents two GitHub runs from executing this
queue at the same time.
