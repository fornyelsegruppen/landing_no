# Takfornyelse unified admin — F0 findings register

**Data:** 2026-09-04
**Bazinis commit:** `4d03b94`
**Būsena:** atviras registras; domeno implementacija ir Production nepakeisti,
testų konfigūracija bei generuoti tipai pataisyti

## Registravimo sutartis

Kiekvienas radinys turi stabilų ID, atkūrimą, faktinį ir tikėtiną rezultatą,
įrodymą, prioritetą, owner sritį ir uždarymo vartą. Radinys nėra laikomas
uždarytu vien todėl, kad egzistuoja maketas ar suplanuotas backlog darbas.

| ID | P | Owner | Atkūrimas | Faktinis rezultatas | Tikėtinas rezultatas | Įrodymas | Uždarymo vartas |
|---|---:|---|---|---|---|---|---|
| `UA-FND-001` | P0 | PLATFORM/DESIGN | Palyginti `/admin-v2` ir `/admin-next-preview` shell bei jų navigaciją. | Egzistuoja du custom administravimo shell modeliai, o Preview dalį kelių grąžina į V2. | Vienas custom operatoriaus shell su modulio lygio rollout ir legacy fallback; nekuriamas `admin-v3`. | `src/app/(admin-shell)/admin-v2/layout.tsx`; `src/components/admin-next/admin-next-shell.tsx`; ADR `F0-001`. | `UA-F1-002`, `UA-F1-008`; vienas route/nav kontraktas ir patikrintas fallback. |
| `UA-FND-002` | P1 | CASE/WORKFLOW + RF | Be URL ar instrukcijos iš operatoriaus administravimo pradžios rasti konkrečios bylos RF matavimą. | Realiame bandyme reikėjo keturių techninių pasirinkimų: `Admin Next · Apsaugota peržiūra → Modulių būsena → Stogo matavimas ir R4 → Atidaryti RF UAT`. | Konkrečios bylos `NextAction` vienu pasirinkimu atveria teisingą RF kontekstą; vienas pasirinkimas grąžina į tą pačią bylą. | Produkto bandymas 2026-09-04; backlog incidentas `UA-INC-RF-001`; ADR `F0-009`. | `UA-F2-006`, `UA-F7-001`, `UA-F7-006`; UAT be maršruto instrukcijų. |
| `UA-FND-003` | P0 | PLATFORM/DESIGN | Sulėtinti navigaciją, RF atidarymą arba mutaciją virš 150 ms ir stebėti paveiktą sritį. | Feedback realizuojamas lokaliais `busy` variantais; bendro route/command kontrakto ir `loading.tsx` nėra, todėl senas ekranas gali atrodyti dabartinis. | Per 150 ms rodoma konkrečiai pavadinta lokalizuota pending būsena; senas turinys pažymėtas/pakeistas; klaida turi saugų retry, grįžimą ar koregavimą. | `src/components/admin-v2/measurement-review-panel.tsx`; `src/components/worker/worker-order-actions.tsx`; ADR `F0-008`. | `UA-F1-006`, `UA-F7-004`; 149/150 ms, slow, timeout, retry ir stale-response testai. |
| `UA-FND-004` | P0 | CASE/WORKFLOW | Palyginti Admin V2 `CaseNextActionKind` resolverį su Admin Next Today kontraktu. | V2 turi 27 tipizuotus action kind, o Today adapteris juos susiaurina iki keturių fiksuotų kategorijų ir nėra kanoninis procesų žodynas. | Vienas deterministinis resolveris ir išsami presentation projekcija aptarnauja Today, bylą ir deep linkus. | `src/lib/admin-v2/case-read-model.ts`; `src/lib/admin-next/today-contract.ts`; transition baseline §3. | `UA-F2-001`, `UA-F2-002`, `UA-F2-009`; exhaustive mapping ir shadow-read parity. |
| `UA-FND-005` | P0 | OPS/SECURITY/DATA | Atverti Admin Next modulio capability/mutation būseną ir patikrinti serverio roles. | Moduliai yra `adapter_ready`, mutacijos `legacy_only`; backend tapatybė skiria tik `admin` ir `worker`. Smulkesnės UI personos dar nėra serverio teisės. | Kiekvienas materialus veiksmas tikrinamas serverio capability; UI yra tik serverio leidimo projekcija. | `src/lib/admin-next/capability-registry.ts`; `src/payload/access/roles.ts`; ADR `F0-005`. | `UA-F6-006`; direct API allow/deny, least-privilege ir role-change testai. |
| `UA-FND-006` | P0 | OPS/SECURITY/DATA | Palyginti AuditEvents turinį su bylos Preview timeline. | Audit įrašai yra append-only su hash, bet nėra privacy-safe žmogui suprantamos `nuo → į` projekcijos; Preview aktorius gali būti fiksuotas `Takfornyelse CRM`. | Timeline kyla tik iš allowlist/redacted audito projekcijos ir rodo kas, ką, nuo ko į ką, kada, kodėl ir rezultatą. | `src/payload/collections/AuditEvents.ts`; `src/lib/admin-next/case-read-adapter.ts`; ADR `F0-006`. | `UA-F2-008`; PII/redaction, actor/source, old/new ir tamper testai. |
| `UA-FND-007` | P1 | OPS/SECURITY/DATA | Ieškoti kanoninių Customer ir Property kolekcijų bei jų write owner. | Kliento ir objekto duomenys yra `Leads` laukai/read projekcijos; nepriklausomų kanoninių esybių nėra. | Pirma pateikiamos aiškiai `lead_projection` pažymėtos read projekcijos; dedup/backfill/schema migracija lieka atskiras sprendimas. | `src/payload/collections/Leads.ts`; `src/lib/admin-next/capability-registry.ts`; ADR `F0-007`. | `UA-F6-008`; source lineage, ambiguous identity ir parity testai. |
| `UA-FND-008` | P0 | RF + COMMERCIAL/DOCS/COMMS | Iš patvirtinto RF snapshot atsekti iki RoofMeasurement ir quote draft įrašytą snapshot ID/revision/schema/hash. | RF snapshot ir ledger yra append-only, tačiau pilna exact snapshot tapatybės grandinė iki matavimo ir pasiūlymo dar neįgyvendinta; tiltas sąmoningai gated. | Tik serverio patikrintas approved snapshot su exact hash kuria naują immutable RoofMeasurement ir vieną quote draft; nieko nesiunčia. | `src/payload/collections/RoofFusion.ts`; `RoofMeasurements.ts`; `Quotes.ts`; ADR `F0-009`. | `UA-F3-001`–`UA-F3-003`; atskiras RF owner, migracijos ir implementation GO. |
| `UA-FND-009` | P0 | FIELD OPS + OPS/SECURITY/DATA | Išjungti ryšį worker eigoje, atlikti transition/upload ir atkurti ryšį. | Yra lokalus ne failų formos juodraštis, bet nėra service worker, offline command ledger, background sync ar aiškios conflict/reconciliation semantikos. | Offline būsena niekada nerodoma kaip sėkmė; duomenų apimtis, šifravimas, expiry/revoke ir command queue patvirtinti threat modeliu. | `src/components/worker/worker-order-actions.tsx`; ADR `F0-010`. | `UA-F4-005`, `UA-F4-006`; security ir reconnect/duplicate/conflict matrica. |
| `UA-FND-010` | P1 | OPS/SECURITY/DATA | Custom admin rasti OperationalJob detail, retry/cancel ir susietą bylos kontekstą. | Kolekcija/job būsenos egzistuoja, tačiau custom operatoriaus vientisos konsolės ir policy-safe retry/cancel paviršiaus nėra. | OperationsConsole pateikia redacted health, owner/runbook ir tik autorizuotą idempotentišką retry/cancel/reconciliation. | F0 inventorius; transition baseline §11; pagrindinio plano „Aiškiai nerastos galimybės“. | `UA-F6-001`–`UA-F6-003`; authorization, duplicate/restart ir redaction testai. |
| `UA-FND-014` | P1 | PLATFORM/DESIGN | Atverti Case fixture 375 px pločiu ir patikrinti penkių etapų „Bylos eiga“ indikatorių. | Penki vienoje eilėje rodomi etapai pernelyg susispaudžia; pavadinimai susilieja ir dalis jų tampa sunkiai įskaitoma. | Kiekvienas etapas turi išlaikyti aiškų numerį, būseną ir pavadinimą be persidengimo; mobile gali naudoti horizontaliai valdomą, sutrumpintą arba vieno aktyvaus etapo modelį. | `docs/implementation/evidence/admin-unified-f0-current-ui/admin-next-case-375.png`; `src/components/admin-next/admin-next-case-workspace.tsx`. | 320/375/768 px visual + keyboard/touch testai; nėra teksto persidengimo ar paslėptos aktyvios/blokuotos būsenos. |

## Uždaryti radiniai

| ID | P | Rezultatas | Įrodymas |
|---|---:|---|---|
| `UA-FND-012` | P1 | Audito pradinė prielaida paneigta: visi penki UI fixture puslapiai kviečia `notFound()`, kai `NODE_ENV=production` arba kai `ADMIN_NEXT_VISUAL_FIXTURE` nėra `true`. Vietinis bandymas be flag grąžino 404; 200 gautas tik aiškiai įjungus testinį vartą. | `src/app/(ui-fixtures)/admin-next-fixture/page.tsx`; lygiaverčiai Case/R4/Preflight/Field Visit vartai; F0 screenshot manifestas. |
| `UA-FND-013` | P1 | Izoliuoto Playwright serverio konfigūracija dabar įjungia `FEATURE_WORKER_PORTAL=true`, todėl anoniminis media scenarijus pasiekia autorizacijos ribą ir tikrina `401`, o ne sustoja ties išjungto modulio `503`. | `playwright.config.ts`; galutinis E2E rezultatas 9 passed / 2 credential-dependent skipped. |
| `UA-FND-011` | P0 | Pasirinktas ir patvirtintas oficialus release runneris: repo Ubuntu/PostgreSQL quality gate švariai įdiegė native priklausomybes, atliko production build ir 11/11 E2E. Windows ARM64 vietinis apribojimas lieka dokumentuotas, bet nebėra release vartas. | GitHub Actions run `33865453230`; F0 checkpoint §3. |
| `UA-FND-015` | P0 | `payload-types.ts` regeneruotas tikslia Payload CLI versija; naujas Ubuntu quality gate praėjo generated-types sync ir visus vėlesnius žingsnius. | Commit `938f45b`; GitHub Actions run `33865453230`. |

## Dabartinė suvestinė

- Atviri: 11.
- P0: 7; P1: 4; P2: 0.
- Uždaryti: 4.
- P0 šiame registre reiškia fazės/saugos vartą, ne Production incidentą: F1–F7
  ir Production tebėra `NO-GO`, todėl vartai šiuo metu apsaugo nuo rizikingo
  įjungimo.
