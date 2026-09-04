# Takfornyelse unified admin — F2 checkpoint

**Data:** 2026-09-04  
**Branch:** `codex/unified-admin-f0`  
**Būsena:** `READ FOUNDATION IMPLEMENTED / LOCAL + BRANCH CI GREEN / PREVIEW DATA GATE PENDING`  
**Production:** `NO-GO`; Production aplinka, bendri duomenys ir schemos nepakeisti

## Rezultatas

F2 sujungė Admin V2 kanoninį `CaseNextActionKind` resolverį, Today prioritetą,
Work Queue ir Case Workspace į vieną read-only Preview grandinę. Vykdomas veiksmas
rodomas tik tada, kai šaltinis yra canonical, rolė turi tikslų capability ir
egzistuoja tikslus versijuotas targetas. Nežinomas, pasenęs, neautorizuotas ar
sintetinis kontekstas fail-closed palieka saugų read-only recovery.

| Darbas | Būsena | Rezultatas / likusi riba |
|---|---|---|
| `UA-F2-001` | Įgyvendinta | Viena išsami 27 action kind NB/LT/EN presentation projekcija. Legacy free text yra tik diagnostika, niekada vykdomo veiksmo truth. |
| `UA-F2-002` | Įgyvendinta | Deterministinis safety, recovery, SLA, blocker, waiting ir assignment prioritetas su Oslo/DST bei tie-break testais. Work Queue NB/LT/EN rodo „kodėl dabar“ ir keturias prioriteto dimensijas. |
| `UA-F2-003` | Dalinė | Responsive Work Queue master–detail, URL pasirinkimas, exact workbench CTA ir opaque cursor Next/Back įgyvendinti. Inline komandos sąmoningai neemituojamos; realios mutation action E2E priklauso vėlesniam patvirtintam command adapteriui. |
| `UA-F2-004` | Dalinė | URL filtrai, reset, stale cursor apsauga, bendras kiekis ir counted facets prieš pagination slice bei personal/team saved-view kontraktas įgyvendinti. Kiekis yra tikslus dabartiniame canonical loaded batch; saved-view saugojimas ir dalijimosi UI laukia atskiro schemos GO. |
| `UA-F2-005` | Įgyvendinta lokaliame vartelyje | Stabilus header, šeši etapai (įskaitant blocked ir 6/6 complete), vienas capability-gated NextAction arba recovery, contextual nav ir responsive history rail. Septynios sintetinės būsenos tikrinamos 375/768/1024/1440. Realių Preview duomenų parity dar neatlikta. |
| `UA-F2-006` | Įgyvendinta read kelyje | Case → RF atskiria `new/resume/review/blocked`; deep link kyla tik iš autorizuoto latest snapshot su case/snapshot revision ir hash, o blocked/stale/missing kontekstas fail-closed. Privacy-safe telemetry projekcija neturi PII ar raw ID ir niekur išoriškai nesiunčia. Pilnas realaus Preview Browser Back ir telemetry sink UAT laukia duomenų bei command GO. |
| `UA-F2-007` | Dalinė | Nauji loader/read-model/route kontraktai atskirti nuo mutation komandų, bet visas legacy Case monolitas dar neišskaidytas vertikaliomis workbench dalimis. |
| `UA-F2-008` | Dalinė | Serverinė allowlist/redaction audito projekcija, case-scoped correlation, actor/time/result/reason/version/source ir neutralios empty/denied/unavailable būsenos įgyvendintos. Esama audit schema neturi patikimo semantinio old → new turinio, o hash saugomas be šiame read kelyje prieinamos verifikavimo grandinės. |
| `UA-F2-009` | Dalinė | PII-minimali canonical-vs-legacy klasifikavimo ataskaita ir fixture-leakage deny vartai įgyvendinti. Ataskaita dar nepaleista prieš reprezentatyvų bendros Preview DB duomenų rinkinį. |

## Saugos ribos

- Preview Work Queue canonical kelyje skaito tik esamą `case.read`; naujų
  mutation capability nesukuria.
- Sintetinės Work Queue eilutės visada yra `shadow_read`, be executable CTA.
- RF route sutartis atmeta kitos bylos `returnTo`, pasenusį revision/hash,
  nesutampantį measurement/snapshot ir dubliuotus ar nežinomus parametrus.
- Audito UI gauna tik serverio allowlist laukus; raw metadata, el. paštas,
  pranešimo body ir nepatikimi old/new laukai neperduodami.
- Legacy next-action diagnostika negrąžina raw laisvo teksto; išorėje lieka tik
  presence/status ir nevykdomas suggested kind.
- Vizualinių fixture route Production build'e visada grąžina `404`.
- Nei Preview, nei Production DB migracija, seed, paskyra, siuntimas ar
  publikavimas šiame etape nevykdytas.

## Vizualiniai įrodymai

- [Case Workspace golden states](evidence/admin-unified-f2-case-workspace-golden/README.md)
- [Work Queue](evidence/admin-unified-f2-work-queue/README.md)
- [F1 responsive shell](evidence/admin-unified-f1/README.md)

PNG užfiksuoti iš tikro šios šakos Next.js renderio. Tai nėra generinis maketas.
Atitinkami `layout-gate-results.json` failai saugo viewport, overflow, focus,
breakpoint ir fail-closed būsenų mašininį rezultatą.

## Quality gate

- `npm run typecheck` — PASS.
- `npm run lint` — PASS, 0 klaidų; lieka vienas žinomas R4 `<img>` našumo
  perspėjimas.
- `npm run test:ci:unit` — PASS, 325 testų failai / 1 801 testas.
- `npm run test:ci:migrations` — PASS, 22 failai / 42 testai.
- `npm audit --omit=dev --audit-level=high` — PASS; 0 high/critical, 6 moderate
  dev/migration įrankių grandinėje be prieinamo fix.
- WQ, Case golden ir F1 source-rendered capture vartai — PASS.
- Vietinis Turbopack production build sustojo Windows pnpm junction skaityme
  (`@libsql/client`, OS error 5), dar prieš aplikacijos compile verdictą;
  lygiavertis Webpack fallback šiam repo netinka dėl esamo `node:crypto` client
  importo. Autoritetingas švarus Ubuntu `npm ci` branch CI production buildas
  prieš PostgreSQL — PASS.
- Branch CI `33888477645` — PASS: dependency audit, Payload type sync, lint,
  typecheck, unit/API, migration up/down, empty PostgreSQL bootstrap,
  deterministic seed, production build, 11/11 public/authenticated Chromium
  smoke ir PostgreSQL backup/restore rehearsal.

## Vartotojo žingsniai, kurių reikės po saugaus lokalaus vartelio

1. Atskiras **schema GO**, jei saved-view saugojimą ir audit old → new formatą
   įgyvendiname šiame cikle.
2. Leidimas naudoti bendrą **Preview** reprezentatyviam read-only parity/UAT bei
   saugi Preview testinė tapatybė. Be šio leidimo local/CI fixture negali būti
   pateikiamas kaip realių duomenų parity įrodymas.
3. Atskiras **Production GO** tik po Preview parity, UAT ir rollback vartų.
   Šis checkpointas tokio leidimo nesuteikia.
