# PROD-8.2 Production case integrity audit — 2026-08-28

## Scope

Read-only inspection of controlled synthetic Production case `#10`. No record was created, updated, retried, archived or deleted by this audit.

## Result

**PASS for the tested commercial and assignment path / ATTENTION for one stale delivery job.** The case has one coherent reference chain and no contradictory active document version. A later global invariant scan found one active delivery job attached to an already finished message; it must be cancelled without resending and then rechecked.

| Entity | Evidence | Result |
|---|---|---|
| Lead | active; status `contacted`; qualification present | PASS |
| Measurement | `TM-10-V1`; approved; manual-no-visual; medium confidence | PASS |
| Price basis | `PB-10-V1`; 17,250 NOK; maximum 19,837.50 NOK; superseded after issue | PASS |
| Quote | `T-10-V1`; accepted; terms `PRODUCTION-PILOT-V1`; locked snapshot/hash | PASS |
| Contract | `K-10-V1`; signed by customer and supplier; document hash present | PASS |
| Work order | `A-K-10-V1`; scheduled; worker assigned; arrival schedule present | PASS |
| Change agreement | none expected in this path | PASS |
| Invoice | none expected before completion review | PASS |
| Email trail | receipt, quote, contract and schedule messages recorded as sent by provider | PASS |
| Delivery jobs | one finished message still has an active delivery job | ATTENTION — owner cleanup required, no resend |
| Token presentation | no secure token exposed as visible raw URL in stored HTML | PASS |

## Expected non-blocking observations

- The AI reply job/message is cancelled because the controlled manual package path completed first. It does not block the case.
- The price-calculation record is superseded after the immutable quote package is issued. The accepted quote retains its locked snapshot and price.
- No invoice exists because the work is scheduled, not completed and administrator-reviewed.

## Required owner cleanup

In the authenticated Production admin, inspect the single stale case `#10` delivery job, confirm that its message is already sent/delivered, then cancel the job without retrying or resending. Rerun `scripts/audit-production-invariants-readonly.ts`; the case is operationally clean only when this finding is gone.

## Tools

- `scripts/audit-production-case-readonly.ts`
- Production connection resolved with the existing Neon CLI session.
- Output intentionally contains only references, state, amount integers and boolean integrity signals; no customer contact data or tokens.
