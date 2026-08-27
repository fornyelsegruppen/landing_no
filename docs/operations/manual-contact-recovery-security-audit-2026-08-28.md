# Manual contact recovery security audit — 2026-08-28

## Result

**PASS (code and automated verification).** No open P0/P1 finding remains in the manual contact recovery path. Authenticated browser UAT is tracked separately in the overnight execution plan.

## Verified contract

1. Only an authenticated administrator can prepare or record manual contact.
2. Recovery can start only from an active outbound email attached to an active lead.
3. The customer receives a 32-byte opaque token; only its SHA-256 hash is persisted.
4. The token is purpose-bound, message-bound, expiring, revocable and single-use.
5. Token consumption is an atomic conditional update. Concurrent submissions cannot both claim it.
6. Customer email and confirmation must match after normalization.
7. The recovered email is stored as a separate communication address; historical lead, quote, contract and signature identity fields are not rewritten.
8. Future messages prefer the verified communication address.
9. The missed source message is reused through an idempotency key; immediate delivery failure creates one queued retry.
10. Repeated administrator confirmation is idempotent and does not duplicate timestamps or audit entries.

## Evidence

- `src/lib/manual-contact/recovery.test.ts`
- `src/app/api/customer/contact/[token]/route.test.ts`
- `src/app/api/admin/messages/[id]/manual-contact/route.test.ts`
- `src/lib/messages/message-engine.test.ts`
- Targeted Vitest: **4 files / 26 tests PASS**
- TypeScript: **PASS**
- Targeted ESLint: **PASS**
- `git diff --check`: **PASS**

## Remaining owner UAT

After signing in to the authenticated Preview admin, verify one controlled failed-email case end to end: prepare recovery, copy the short message, open the secure customer link, enter the email twice, confirm the original message is sent once, and verify the timeline records the action. This is an owner UAT requirement, not an unresolved code defect.
