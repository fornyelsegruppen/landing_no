# F0 remediation decision register

**Scope:** staging-only implementation before the full F0–F10 remediation programme.  
**Baseline commit:** `68d115d4f34a80fe20b5a0635c4ec4a48a36e257`  
**Rollback tag:** `rollback/pre-full-audit-f0-2026-08-25`

## State and command boundary

- The authoritative aggregate inventory is `operationalStateInventory` in `src/lib/platform/remediation-contract.ts`.
- A state-changing operation is a server-side command with actor, role, case ID, expected version, idempotency key and timestamp.
- Related lead, measurement, quote, contract, work, message, job and document changes are committed as one controlled command or not committed.
- Every active case resolves to exactly one next action, one owner and either a due date or an explicit blocker.
- Direct UI writes to related operational statuses are migration debt and are removed in F1.

## Commercial and legal snapshots

- Price book version, VAT basis points, tolerance basis points, warranty template version and legal template version are immutable snapshots in every issued document.
- A changed measurement, building, slope or price creates a new version. A signed document is never edited.
- `manual_no_visual` is a valid measurement mode: administrator area, reason, actor and timestamp are stored; quote and contract omit the visual attachment.
- Official invoices and payment accounting are out of scope. The system may create only an invoice draft until an accounting integration and numbering policy are approved.

## Contact routing

- Email is primary.
- SMS is allowed only when email is missing or has a confirmed hard bounce. It carries a short case-specific message and an expiring secure link, not marketing or sensitive case contents.
- With no usable channel, the system creates a manual-contact task.

## Lifecycle exceptions

- Cancellation after signature, early-start requests and disputes freeze automation and require an administrator decision.
- Weather rescheduling preserves the old schedule in audit history and sends the replacement window.
- Quote expiry creates a non-response follow-up task.
- Warranty requests create a new linked case and never rewrite the completed original.
- Only active, explicitly authorised administrators can countersign for the company; offboarding removes permission immediately.

## External integrations

The executable timeout, retry, fallback and manual-continuity matrix is `integrationFailurePolicies` in `src/lib/platform/remediation-contract.ts`. Exhausted automated attempts must create an administrator-visible attention item; no customer action may disappear silently.

## Retention and pilot gate

- Trash grace period is 30 days.
- Signed documents, work evidence and audit events remain under legal hold until an approved retention policy supplies a lawful deletion date.
- The executable pilot thresholds are `pilotGateMetrics`. Any critical integrity, duplicate communication, wrong-case or unauthorised access count above zero is an automatic `NO-GO`.

## Feature flags

F0–F10 remediation capabilities default to disabled. A flag is enabled only in Preview for its phase acceptance, then remains independently reversible. Production activation is forbidden before F10 and a separate owner `GO`.
