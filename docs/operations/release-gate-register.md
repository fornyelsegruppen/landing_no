# Go/no-go-register

Systemets `/api/admin/platform-health` og adminoversikt beregner dette registeret uten å vise verdiene bak referansene. Tabellen under er den menneskelige kontrollflaten. `Ikke utført` kan aldri tolkes som godkjenning.

## Felles bevis for alle aktiverte funksjoner

| Miljønøkkel | Bevis | Status |
|---|---|---|
| `STAGING_QA_REFERENCE` | Staging-QA: Preview `dpl_Ep3DEjGjPyWiAxqDuYCWpFLCwoXQ`, commit `6007e79`, 584 tester og route-smoke | Bestått og registrert i Production env |
| `RESTORE_TEST_REFERENCE` | Tidligere restore-øvelse `br-curly-bar-asjsrltd`; fersk lesekontroll `br-damp-unit-as3pdkgr` | Bestått og registrert i Production env |
| `PRODUCTION_OWNER_APPROVAL_REFERENCE` | Eier godkjente PROD-8-planen, preflight-konfigurasjonen og safety-only deployment 2026-08-27 | Godkjent og registrert i Production env |

`LEAD_INBOX_PILOT_REFERENCE` er ikke et felles krav for kontrollerte PROD-8-bølger. Det settes først etter rapporten fra 20–30 reelle pilotleads og kreves for overgang fra `controlled_pilot` til `full_automation`.

## Feature-spesifikke bevis

| Feature-flagg | Ekstra bevis | Nåstatus |
|---|---|---|
| `FEATURE_AI_DRAFTS` | `AI_CONTENT_PILOT_REFERENCE` | Avslått |
| `FEATURE_ROOF_MEASUREMENT` | `ROOF_VALIDATION_REFERENCE`, `PRICING_APPROVAL_REFERENCE` | Avslått |
| `FEATURE_CUSTOMER_QUOTES` | `PRICING_APPROVAL_REFERENCE`, `QUOTE_JOURNEY_QA_REFERENCE` | Avslått |
| `FEATURE_CONTRACT_SIGNING` | `SIGNATURE_APPROVAL_REFERENCE`, `CONTRACT_JOURNEY_QA_REFERENCE` | Avslått |
| `FEATURE_WORKER_PORTAL` | `WORKER_MOBILE_QA_REFERENCE` | Avslått |
| `FEATURE_AUTOMATED_REMINDERS` | `COMMUNICATION_APPROVAL_REFERENCE` | Avslått |
| `FEATURE_SEO_SCHEDULER` | `SEO_PILOT_REFERENCE` | Avslått |
| `FEATURE_CASE_STATE_ENGINE_V2` | `STATE_INVARIANT_QA_REFERENCE` | Avslått |
| `FEATURE_MEASUREMENT_EVIDENCE_V2` | `ROOF_EVIDENCE_QA_REFERENCE` | Avslått |
| `FEATURE_ADMIN_EXCEPTION_FLOWS_V2` | `ADMIN_OPERATIONS_QA_REFERENCE` | Avslått |
| `FEATURE_COMMUNICATION_ROUTING_V2` | `COMMUNICATION_V2_QA_REFERENCE` | Avslått |
| `FEATURE_CUSTOMER_LIFECYCLE_V2` | `CUSTOMER_LIFECYCLE_QA_REFERENCE` | Avslått |
| `FEATURE_SECURITY_HARDENING_V2` | `SECURITY_HARDENING_QA_REFERENCE` | Avslått |

En rad får bare `go` når flagget er eksplisitt aktivert, alle tekniske integrasjoner er klare og alle felles og feature-spesifikke referanser finnes. Et avslått flagg rapporteres `disabled`, ikke `go`. Manglende `LEAD_INBOX_PILOT_REFERENCE` blokkerer ikke en kontrollert bølge, men blokkerer `full_automation`.
