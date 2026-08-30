# All-features controlled pilot — 2026-08-30

Status: **OWNER-AUTHORIZED CONTROLLED PILOT — TECHNICAL GATES IN PROGRESS**

This runbook describes the ordered activation and rollback gates for the
all-features controlled pilot. The owner authorized this ordered pilot with
`TVIRTINU GO_ALL_FEATURES_CONTROLLED_PILOT` on 2026-08-30. That approval does
not bypass any technical, recipient, evidence or monitoring gate and does not
authorize `GO_FULL_AUTOMATION`.

## 1. Immutable release gate

The candidate must first exist as one immutable Preview deployment:

- the release commit is pushed and the working tree used for the artifact is
  clean;
- the Preview deployment is `READY`, reports the exact release commit and is
  not marked dirty;
- the exact-commit Quality Gate, migration/bootstrap and production build are
  green;
- public routes, protected routes, administrator flows and responsive UAT pass
  against that same Preview;
- the Production deployment and every Production alias remain unchanged while
  Preview is being accepted;
- the current stable Production deployment is recorded and independently
  verified as `READY` before any activation begins.

Record only the actual commit, deployment, CI run and signed UAT evidence when
they exist. Do not use a branch name, local test result, synthetic identifier or
an earlier Preview as a substitute.

## 2. Initial Production state

The first release deployment is code-only. Before and immediately after it,
verify the following state:

```text
PLATFORM_OPERATING_MODE=controlled_pilot
AUTOMATION_EMERGENCY_PAUSE=true
FEATURE_WORKER_PORTAL=false
FEATURE_COMMUNICATION_ROUTING_V2=false
FEATURE_AUTOMATED_REMINDERS=false
FEATURE_SEO_SCHEDULER=false
FEATURE_SEO_AUTO_PUBLISH=false
```

`AUTOMATION_RECIPIENT_ALLOWLIST` must be empty until the owner has named the
exact pilot recipients. When the communication pilot is approved, set it to
only those complete email addresses, comma-separated. Normalization trims
whitespace and compares lowercase addresses; aliases, domains, patterns and
wildcards are prohibited. A missing or empty allowlist must fail closed for
controlled-pilot automatic delivery.

Before changing any flag, capture a read-only inventory of due, pending,
retrying, running, stale and attention jobs. Confirm the single scheduler,
provider health, rollback deployment and incident owner. Do not proceed when an
old due job could reach a real recipient after the pause is released.

## 3. Activation discipline

Activate one wave at a time under the recorded owner pilot approval. Each wave
requires a recorded before/after flag snapshot, the active and stable rollback
deployment IDs, and the 5/15/30/60-minute monitoring gates below. A real
communication canary additionally requires the exact recipient to be confirmed
at execution time. Do not open the next wave before the prior wave's 60-minute
gate is PASS.

### Wave 1 — worker portal canary

Change only `FEATURE_WORKER_PORTAL=true`. Keep
`AUTOMATION_EMERGENCY_PAUSE=true` and the other three risky flags false.

Use one owner-approved real worker canary. Verify that the worker:

- can authenticate on the supported mobile viewport;
- sees only work assigned to that worker and cannot access another assignment;
- sees dates and arrival windows in `Europe/Oslo`;
- can perform only valid state transitions, with harmless repeated actions;
- cannot expose private customer media or documents through an unauthorized
  route.

Stop on any authorization, ownership, state-transition or private-media
failure. Record `WORKER_MOBILE_QA_REFERENCE` only after the real canary evidence
has been reviewed and accepted.

### Wave 2 — communication routing with a manual admin canary

Set `AUTOMATION_RECIPIENT_ALLOWLIST` to the exact approved pilot recipients,
then change only `FEATURE_COMMUNICATION_ROUTING_V2=true`. Keep
`AUTOMATION_EMERGENCY_PAUSE=true`; automatic sends remain paused.

An administrator explicitly approves one canary operational message. Verify
the recipient, subject, body, case/work-order relationship and schedule version
before approval. Confirm exactly one provider call, one delivery record and one
audited state transition. Retry/reload must not create a duplicate.

The emergency pause must not break an explicitly admin-approved transactional
message or the existing lead-inbox transactional path. It must continue to
block automatic operational communication. Record the communication QA and
approval references only from the reviewed real canary; no synthetic or
Preview-only identifier is sufficient.

### Wave 3 — fail-closed reminders canary

Review the queue inventory again. Only after that inventory and the exact
allowlist are accepted, change `FEATURE_AUTOMATED_REMINDERS=true` and
`AUTOMATION_EMERGENCY_PAUSE=false`. Keep the worker and communication flags at
their accepted Wave 1–2 values.

Verify with a narrowly controlled real canary that:

- automatic `work-order.communication`, quote follow-up and
  `message.delivery` email can reach only an exact allowlisted address;
- a missing allowlist or non-allowlisted recipient reaches `attention` without
  constructing or calling the email provider, and the stored reason contains
  no recipient or secret;
- `Europe/Oslo` timing, state-change cancellation, retry and terminal-message
  reconciliation prevent late or repeated sends;
- repeated scheduler execution does not produce a duplicate;
- a payment reminder remains a draft until explicit administrator approval;
- both draft and approve/retry time re-check that the invoice is still unpaid
  and overdue, and that `bankCheckedAt` is from the current `Europe/Oslo` day;
- the minimum payment-reminder cooldown is enforced server-side. The default is
  seven days unless `PAYMENT_REMINDER_COOLDOWN_DAYS` contains an approved value.

Any unexpected real recipient, duplicate, provider call after a blocked policy
decision, stale bank check or reminder for a paid invoice is an immediate STOP.
Record reminder approval evidence only after the real canary is accepted.

### Wave 4 — SEO draft canary

Change only `FEATURE_SEO_SCHEDULER=true`. Keep
`FEATURE_SEO_AUTO_PUBLISH=false` throughout the pilot.

Generate one controlled SEO draft. Verify Norwegian content, source/topic
metadata, licensed image provenance, quotas, retry behavior and sanitized
errors. The result must remain a draft until an administrator reviews and
publishes it manually. Scheduler retry or duplicate invocation must not create
duplicate drafts or publish content.

Any automatic publication, missing image license evidence, secret exposure or
duplicate draft is an immediate STOP. Record `SEO_PILOT_REFERENCE` only from
the reviewed real canary.

## 4. Evidence and full-automation gate

Evidence variables are attestations, not switches. Populate a feature-specific
QA reference only with the immutable ID of the real, owner-reviewed canary that
proved that exact behavior. Preview deployments, CI runs and synthetic tests
remain separate technical evidence and must not be copied into real-canary
reference fields.

`LEAD_INBOX_PILOT_REFERENCE` remains unset until the documented 20–30 unique
real-case pilot is complete. `ROOF_VALIDATION_REFERENCE` remains unset until
the required physical roof comparisons are complete. Do not change
`PLATFORM_OPERATING_MODE` to `full_automation` until all release-gate evidence
is genuine, complete and owner-approved.

For every accepted wave, record:

- release commit and immutable Preview deployment;
- active Production and stable rollback deployments;
- owner GO and incident owner;
- exact flag snapshot, without secrets;
- allowlisted recipients in the restricted operational record, not in Git;
- canary case/job/message IDs and provider delivery ID;
- smoke, queue, log, duplicate and authorization results;
- the 5/15/30/60-minute and 72-hour monitoring decisions.

Leave a field unset when evidence does not yet exist. Never fabricate or reuse a
reference value to satisfy a gate.

## 5. Read-only monitoring

At 5, 15, 30 and 60 minutes after the initial deployment and after every flag
wave, perform the same read-only checks:

1. Confirm the active deployment, stable rollback deployment and every
   Production alias remain `READY` and point where expected.
2. Re-run public and protected-route smoke checks without writing Production
   data.
3. Inspect logs for genuine HTTP 5xx and fatal runtime failures. Track known
   SSL-mode and private-media adapter warnings separately; do not relabel a
   warning as a failure or dismiss a real failure as known noise.
4. Inspect operational jobs for new retry, stale, attention or duplicate work,
   and correlate each canary job, message and provider event.
5. Confirm no non-allowlisted recipient, automatic payment reminder or SEO
   publication occurred.
6. Confirm database and private Blob state remain intact using read-only
   inventories only.

The 60-minute observation is the completion gate for a wave. A genuine P0/P1,
unexpected recipient, unauthorized access, duplicate, unexplained 5xx, fatal
runtime failure or rollback-readiness loss triggers immediate rollback.

After the 60-minute gate, continue read-only observation through 72 hours, with
documented checks at least at 6, 12, 24, 48 and 72 hours and immediate review of
any alert. Include deployment/alias readiness, route smoke, 5xx/fatal logs,
queue health, provider delivery/bounce state, authorization signals, duplicates
and unintended publishing. The 72-hour result closes the controlled-pilot
observation; it does not by itself authorize `full_automation`.

## 6. Rollback

On a rollback decision, the authorized operator performs this order:

1. Set `AUTOMATION_EMERGENCY_PAUSE=true`.
2. Set the four risky flags to false:

   ```text
   FEATURE_WORKER_PORTAL=false
   FEATURE_COMMUNICATION_ROUTING_V2=false
   FEATURE_AUTOMATED_REMINDERS=false
   FEATURE_SEO_SCHEDULER=false
   ```

3. Verify `FEATURE_SEO_AUTO_PUBLISH=false` remains unchanged.
4. Redeploy the previously recorded stable `READY` deployment and verify all
   Production aliases.
5. Re-run public/protected smoke checks and inspect logs and queues read-only.

Do not delete or rewrite Production database rows, Blob objects, audit records,
messages or drafts as part of this application rollback. Preserve them for
incident review. Database restore is a separate P0 integrity procedure and is
not implied by a feature rollback.
