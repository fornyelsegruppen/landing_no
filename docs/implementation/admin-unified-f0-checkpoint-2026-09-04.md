# Takfornyelse unified admin — F0 checkpoint

**Data:** 2026-09-04
**Bazinis commit:** `4d03b94`
**Rezultatas:** `CONDITIONAL — F0 ĮRODYMAI SURINKTI / F1 NO-GO`
**Production:** `NO-GO`; Production aplinka, duomenys, schemos, kainodara,
siuntimai ir automatizacijos nepakeisti

## 1. Rezultatas

F0 inventorius, būsenų/perėjimų bazė, architektūros sprendimai, prioritetizuotas
F1–F7 backlogas, radinių registras ir source-built responsyvių vaizdų bazė yra
paruošti. Kodo pakeitimai apsiriboja izoliuoto Playwright serverio worker feature
vartu, CI generatorių atitinkančiu `payload-types.ts` ir pakartojamu vizualinių
įrodymų fiksavimo skriptu; domeno logika nepakeista.

F0 dar nėra besąlygiškai uždaryta ir F1 nepradedama. Repo jau turi pilną
`ubuntu-latest` + PostgreSQL quality gate su sintetinėmis admin/worker paskyromis,
tačiau bazinio commit CI sustojo prieš testus dėl nesinchronizuoto generuoto
`payload-types.ts`; pataisa paruošta lokaliai ir turi būti patvirtinta nauju CI
paleidimu. Stabilios Preview apsaugos autorizuotas smoke praėjo, bet joje nėra
sintetinių aplikacijos paskyrų pilnai UAT/parity sesijai.

## 2. Paruošti įrodymai

| Artefaktas | Rezultatas |
|---|---|
| [Pagrindinis planas](../product/takfornyelse-unified-admin-ui-ux-system-plan-2026-09-04.md) | Patvirtinta kryptis, fazės, vartai ir leidimų ribos. |
| [Inventorius](admin-unified-f0-inventory-2026-09-04.md) | 41 page route, 65 API route failai, 32 Payload kolekcijos + global, 39 kritiniai mutation control ir 359 `file:line` nuorodos. |
| [State/transition baseline](admin-unified-f0-state-transition-baseline-2026-09-04.md) | Dabartinės būsenos, 27 `CaseNextActionKind`, prioritetai ir tikslinė šešių etapų projekcija. |
| [Architektūros sprendimai](admin-unified-f0-architecture-decisions-2026-09-04.md) | 10 ADR: shell, URL/Payload riba, resolveris, komandos, capabilities, auditai, projekcijos, feedback, RF ir offline vartai. |
| [F1–F7 backlogas](admin-unified-f0-backlog-2026-09-04.md) | 57 stabilūs darbų ID su owner, priklausomybėmis, rizika, acceptance ir testais. |
| [Radinių registras](admin-unified-f0-findings-2026-09-04.md) | Atviri fazių vartai, reprodukcija, faktinis/tikėtinas rezultatas ir uždarymo kriterijai. |
| [Dabartinio UI vaizdų bazė](evidence/admin-unified-f0-current-ui/README.md) | 12 source-built PNG: Today 4 pločiais ir Case/R4/Preflight/Field Visit desktop + mobile. |

Interaktyvi vizualinė specifikacija yra
`C:\Users\Fornyelsegruppen\.codex\visualizations\2026\09\04\01a06b3e-d8ad-7570-8eeb-550f6b44b129\takfornyelse-admin-system.html`.
Ji yra tikslinis acceptance kontraktas, o ne teiginys, kad F1–F7 jau
įgyvendintos.

## 3. Vykdomosios patikros

| Patikra | Rezultatas | Pastaba |
|---|---|---|
| `npm ci` | PASS | 902 paketai įdiegti; lockfile nepakeistas. Audit: 6 moderate; 6 dependency script leidimai laukia atskiro review. |
| `npm audit --omit=dev --audit-level=high` | PASS | 6 moderate transitive `esbuild` radiniai; high/critical nėra, todėl quality policy praeina. |
| Payload generated types sync | FIX PARUOŠTAS | Bazinio commit CI run `33843634021` sustojo šiame žingsnyje; `payload-types.ts` regeneruotas ir antras generavimas deterministiškas. Naujas remote CI dar nepaleistas. |
| `npm run typecheck` | PASS | Exit 0. |
| `npm run lint` | PASS su 1 esamu warning | 0 klaidų; `<img>` warning `admin-next-r4-measurement-review.tsx:153`. |
| `npm run test:ci:unit` | PASS | 296 failai, 1401 testas. |
| `npm run test:ci:migrations` | PASS | 22 failai, 42 testai, izoliuotas PGlite. |
| Playwright E2E | PASS / 2 SKIP | 9 passed, 2 skipped; skip tik autentifikuotiems admin/worker scenarijams, nes synthetic prisijungimai nesukonfigūruoti. |
| `next build` | PASS dokumentuotame laikiname x64 procese | Compile, TypeScript, page data ir 78 statiniai puslapiai; Production DB nenaudota. |
| `npm run test:preview:auth-smoke` | PASS | Vercel CLI autorizuotas `https://takfornyelse-staging.vercel.app/no` atsakė HTTP 200; Production nekeista. |
| Repo Linux CI kontraktas | YRA / LAUKIA RUN | `.github/workflows/quality.yml`: Ubuntu, PostgreSQL 16, švarus `npm ci`, build, 11 browser testų ir backup/restore rehearsal. |
| Windows ARM64 švarus native restore | FAIL / OPEN | `libsql@0.4.7` neturi publikuoto `@libsql/win32-arm64-msvc`; vietiniam įrodymui naudotas Node 22.12.0 x64 ir tikslūs x64 prebuilt paketai. |

E2E testų matricoje iš viso yra 11 scenarijų. Du skip nevadinami žaliais:
jiems reikia saugiai sukonfigūruotų `E2E_ADMIN_*` ir `E2E_WORKER_*` synthetic
paskyrų arba lygiaverčio testinio identity mechanizmo.

## 4. UAT / leidimo būsena

| Sritis | Būsena |
|---|---|
| Vartotojo testavimas | Preview Deployment Protection autorizuotas smoke praėjo, tačiau pilna aplikacijos sesija neatlikta, nes Preview aplinkoje nėra `E2E_ADMIN_*` / `E2E_WORKER_*` paskyrų. |
| Agentų pataisos | Playwright feature gate, CI generuotų Payload tipų sinchronizacija ir F0 įrodymai; domeno/UI F1 implementacija nepradėta. |
| Sujungta | Nieko; pakeitimai šiame worktree dar nesujungti. |
| Stabili Preview | Esamas remote deployment nekeistas. |
| Production | Nepaliesta; `NO-GO`. |

## 5. Atviri vartai prieš F1

1. Commit/push šiame worktree paruoštą generated-types pataisą ir paleisti esamą
   Ubuntu/PostgreSQL quality gate iki žalios būsenos; jis pats sukuria
   `example.invalid` admin/worker paskyras ir vykdo visus 11 E2E.
2. Preview aplinkoje saugiai sukurti atskiras sintetines aplikacijos paskyras
   arba pasirinkti lygiavertį read-only identity mechanizmą, tada atlikti V2 ↔
   Next parity ir click/time baseline. Vercel apsaugos smoke jau žalias.
3. Uždaryti arba aiškiai priimti `UA-FND-014` mobile etapų indikatoriaus riziką
   prieš įvardijant Case mobile kaip acceptance-ready.

## 6. Vienas kitas operatoriaus veiksmas

Patvirtinkite `codex/unified-admin-f0` šakos sukūrimą ir push, kad esamas
Ubuntu/PostgreSQL quality gate realiai patikrintų generated-types pataisą, build
ir visus 11 E2E. Tai nekeis Production.
