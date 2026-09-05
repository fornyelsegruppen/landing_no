# Admin Unified Preview mutation/schema gate

## Decision

Local implementation gate: **GO for protected Preview owner UAT**.

Production remains **NO-GO** until the owner supplies a separate explicit
`PRODUCTION GO`.

## Delivered scope

- Preview-only canonical case-address correction with revision CAS,
  idempotency, append-only history, and atomic invalidation of address-bound RF
  and unapproved commercial drafts.
- Fail-closed RF workbench recovery with an explicit `Continue old / Start
  new` choice. New draft revisions persist an exact server-built recovery
  binding; legacy or stale drafts cannot auto-load.
- Exact RF snapshot-to-offer bridge creating immutable RoofMeasurement,
  PriceCalculation, Quote draft, and Contract draft identities in one
  transaction.
- Exactly-once behavior by canonical case/address/snapshot binding and by
  client idempotency scope, including duplicate and concurrent retry recovery.
- No automatic customer message, quote approval, contract issue, send, or
  signature side effect.
- Localized case-history entries for address correction and RF offer-draft
  creation, including privacy-safe case/address/RF revisions and
  measurement/quote/contract references.
- Existing bounded history paging and disclosure remain unchanged; no endless
  timeline scroll was reintroduced.
- Actual integrated ReviewAndCommit screenshots and a zero-mutation capture
  assertion, not a generic visual concept.

## Preview gates

Both mutation entry points fail closed before Payload initialization,
authentication, or database access unless all relevant Preview conditions are
true:

- `VERCEL_ENV=preview`;
- `FEATURE_ROOF_FUSION_V1=true` for RF workbench/offer behavior;
- `FEATURE_ADMIN_NEXT_CASE_ADDRESS_COMMAND=true` for address correction;
- `FEATURE_ADMIN_NEXT_RF_OFFER_BRIDGE=true` for RF-to-offer creation.

The visual fixture additionally requires non-Production execution and
`ADMIN_NEXT_VISUAL_FIXTURE=true`; unknown fixture states return 404.

## Database and rollback

Additive migrations:

1. `20260904_180000_preview_case_address_revisions`
2. `20260904_190000_preview_rf_offer_bridge`

Each migration has a tested `down` path. The draft-recovery record reuses the
existing append-only JSON field with a versioned envelope and therefore adds no
third migration. Existing direct draft JSON remains readable as legacy but is
not resumable.

## Verification

- `npm run test:ci:unit`: 344 files / 1,929 tests passed.
- `npm run test:ci:migrations`: 24 files / 45 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed; one pre-existing intentional `no-img-element`
  warning remains for authenticated RF imagery.
- `npm run generate:types`: deterministic; generated file hash unchanged.
- `npm audit --omit=dev --audit-level=high`: passed the configured threshold;
  seven transitive moderate advisories currently have no upstream fix.
- `git diff --check`: passed.

## Known Preview risks

- The diagnostic free-form UAT address lookup is not proof that the selected
  capture address equals the canonical case address. Commercial use therefore
  still requires the separately approved, canonical address-bound RF snapshot.
- Owner browser UAT and hosted Preview checks remain required before any release
  decision.
- The current authenticated RF image intentionally bypasses the public Next.js
  image optimizer and retains its documented lint warning.

## Recommended owner UAT sequence

1. Open a real authorized case through its visible RF next action, without a
   copied deep link.
2. Correct the address; confirm before/after values, reason, invalidation list,
   typed confirmation, and that no customer message is sent.
3. Reopen the workbench with an existing draft; verify no auto-load and test
   both exact `Continue old` and stale/legacy `Start new` behavior.
4. Calculate and approve one RF result, then use `Įkelti matavimą į pasiūlymą`.
5. Verify one immutable measurement, price calculation, quote draft, and
   contract draft; retry the action and confirm no duplicates.
6. Open the case history and confirm localized address/RF events, correlation
   ID, revisions, and measurement/quote/contract references through bounded
   paging/disclosure.
7. Confirm no email/message was sent, no quote was approved, no contract was
   issued, and no signature state changed.
