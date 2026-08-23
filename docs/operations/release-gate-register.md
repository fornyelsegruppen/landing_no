# Go/no-go-register

Systemets `/api/admin/platform-health` og adminoversikt beregner dette registeret uten å vise verdiene bak referansene. Tabellen under er den menneskelige kontrollflaten. `Ikke utført` kan aldri tolkes som godkjenning.

## Felles bevis for alle aktiverte funksjoner

| Miljønøkkel | Bevis | Status |
|---|---|---|
| `STAGING_QA_REFERENCE` | Signert staging-QA | Ikke utført |
| `RESTORE_TEST_REFERENCE` | Bestått restore-øvelse | Ikke utført |
| `LEAD_INBOX_PILOT_REFERENCE` | Rapport fra 20–30 pilotleads | Ikke utført |
| `PRODUCTION_OWNER_APPROVAL_REFERENCE` | Eksplisitt produkteiergodkjenning | Ikke utført |

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

En rad får bare `go` når flagget er eksplisitt aktivert, alle tekniske integrasjoner er klare og alle felles og feature-spesifikke referanser finnes. Et avslått flagg rapporteres `disabled`, ikke `go`.

