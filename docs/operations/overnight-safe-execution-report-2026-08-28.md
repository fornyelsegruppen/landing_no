# Naktinio saugaus vykdymo ataskaita

Data: 2026-08-28
Galutinė būsena po rytinio UAT: **`mark_reviewed` Preview vartai PASS; Production duomenų sutvarkymas ir rankinio kontakto E2E dar laukia savininko**

## Rezultatas

Naktinis saugus planas įvykdytas tiek, kiek buvo galima be savininko prisijungimo ir be Production mutacijų. Aptikti kodo trūkumai pataisyti lokaliai, padengti regresijos testais ir įrašyti į commit `51ca68f`. Production konfigūracija, duomenys, klientų komunikacija ir feature flagai nebuvo pakeisti.

## PASS — užbaigta automatiškai

- aktyvus Production deployment yra `READY`;
- užfiksuotas ankstesnis `READY` rollback kandidatas;
- vieša svetainė, tinklaraštis ir administratoriaus prisijungimo puslapis grąžina HTTP 200;
- Quality Gate run `33116393482` yra žalias;
- backup/restore įrodymo kintamieji yra Production konfigūracijoje, o paskutinis patikrintas backup buvo užfiksuotas sistemos būklės skydelyje;
- read-only bylos #10 diagnostika patvirtino, kad pasiūlymo, sutarties, abiejų parašų ir darbo užsakymo grandinė išliko vientisa; vienas pasenęs delivery job atskirai pažymėtas rytiniam sutvarkymui be persiuntimo;
- rankinio kontakto atkūrimo srautas sustiprintas atominiu vienkartinio tokeno panaudojimu, aktyvaus šaltinio laiško patikra ir pasikartojančio administratoriaus veiksmo idempotency;
- operacinių darbų vykdytojas sustiprintas atominiu jobo paėmimu, kad Vercel cron ir GitHub Actions negalėtų vienu metu apdoroti to paties darbo;
- tiksliniai rankinio kontakto testai: 26/26 PASS;
- tiksliniai PROD-8.4 preflight testai: 37/37 PASS;
- visas vienetinių testų paketas: 175 failai / 600 testų PASS;
- TypeScript, visas ESLint ir `git diff --check` PASS;
- parengti du read-only Production audito įrankiai ir jie nepakeitė Production duomenų;
- parengtas savininko UAT checklist su tiesioginėmis nuorodomis, laukiamais rezultatais ir STOP sąlygomis.

## RYTINIS SAVININKO UAT — PASS

- `mark_reviewed` pataisa `c2989a1` įdiegta ir lokaliai bei Linux CI patikrinta;
- naujas Preview deployment `dpl_2mBbVwymveu5Jjgw5qc39X7U3dPj` yra `READY` ir priskirtas `takfornyelse-staging.vercel.app`;
- 2026-08-28 savininkas prisijungė prie Preview, atidarė neperžiūrėtą sintetinę bylą `#4`, atnaujino puslapį ir patvirtino, kad byla atsidaro be klaidos;
- `case.mark_reviewed` Preview UAT laikomas PASS;
- Production diegimas vis tiek nevykdomas iki naujausio lokalaus kandidato push ir žalio Linux Quality Gate.

## PLATFORMOS APRIBOJIMAS

- lokalus `npm run test:ci:migrations` Windows ARM aplinkoje neužsibaigė dėl žinomo neprivalomo `libsql` ARM modulio apribojimo ir buvo saugiai nutrauktas be klaidos ar Production poveikio;
- šis rezultatas nėra slepiamas ir nėra vadinamas lokaliu migracijų PASS;
- commit `51ca68f` negali būti laikomas paruoštu Production, kol po savininko patvirtinto push nepraeis Linux Quality Gate, įskaitant migracijas ir PostgreSQL build;
- ankstesnis, jau nuotolinėje šakoje esantis commit `c2989a1` turi žalią Linux Quality Gate `33120965793`.

## Tiesioginės nuorodos

- Production administravimas: <https://www.takfornyelse.as/admin-v2>
- Production bylos: <https://www.takfornyelse.as/admin-v2/cases>
- Preview administravimas: <https://takfornyelse-staging.vercel.app/admin-v2>
- Preview nustatymai: <https://takfornyelse-staging.vercel.app/admin-v2/settings>
- GitHub PR #52: <https://github.com/darbasnorvegija4-eng/landing_no/pull/52>
- paskutinis žalias GitHub Quality Gate: <https://github.com/fornyelsegruppen/landing_no/actions/runs/33120965793>

## OWNER ACTION REQUIRED — teisinga ryto eilė

1. Pushinti savininko peržiūrėtą lokalų kandidatą į `codex/master-platform-implementation` ir laukti žalio Linux Quality Gate. Be žalio CI nėra Preview ar Production deploy.
2. Peržiūrėti [Production invariantų audito](./production-invariant-readonly-audit-2026-08-28.md) 15 dėmesio radinių. Per administravimą archyvuoti arba sutaikyti senas sintetines bylas #1–#7 ir atšaukti vieną pasenusį #10 delivery job **jo nepersiunčiant**. Tada read-only skenerį pakartoti iki 0 kritinių ir 0 nepaaiškintų radinių.
3. Pagal [UAT checklist](./prod8-owner-uat-checklist-2026-08-28.md) atlikti atskirą rankinio kontakto atkūrimo Preview E2E. `mark_reviewed` UAT kartoti nereikia, nebent naujas deploy pakeistų šį kodą.
4. Tik po žalio CI ir reikalingų Preview vartų PASS spręsti dėl siauro Production deploy su užfiksuotu rollback.
5. PROD-8.4 aktyvacijai Production aplinkoje pridėti `CRON_SECRET` ir `PEXELS_API_KEY` tik tada, kai sąmoningai pradedama ši banga. `FEATURE_AUTOMATED_REMINDERS=false` ir `FEATURE_SEO_SCHEDULER=false` palikti išjungtus iki atskiro UAT ir aktyvavimo patvirtinimo.

## Fazės

| Fazė | Būsena |
|---|---|
| O-0 Production freeze | **PASS** — autentifikuotas `mark_reviewed` Preview UAT atliktas byloje `#4` |
| O-1 Planų sutikrinimas | **PASS** |
| O-2 | **PASS KODUI / READY FOR OWNER UAT** — 26/26 tikslinių testų, TypeScript ir tikslinis ESLint PASS; liko rankinio kontakto E2E |
| O-3 | **PASS VIENTISUMUI / BLOCKED OPERACINIAM UŽDARYMUI** — TM/PB/T/K/A-K grandinė ir parašai nuoseklūs; ryte reikia atšaukti vieną pasenusį delivery job be persiuntimo |
| O-4 | **PASS** — savininko likę veiksmai sutraukti į vieną UAT checklist |
| O-5 | **PASS / OWNER ACTION REQUIRED** — 37/37 tikslinių testų; trūksta dviejų Production priklausomybių |
| O-6 | **PASS SU PLATFORMOS APRIBOJIMU** — 175 failai / 600 testų, TypeScript, visas ESLint ir diff PASS; lokalios migracijos paliktos Linux CI |
| O-7 | **PASS** — parengtas pilnas rytinis perdavimas, blokatoriai ir saugi veiksmų eilė |

## Lokalūs commitai ir deploy sprendimas

- `c2989a1 fix(admin): persist reviewed case marker safely` — jau pushintas, Linux CI ir autentifikuotas Preview UAT PASS; Production dar neįdiegtas.
- `51ca68f fix(platform): harden recovery and job processing` — sukurtas lokaliai, nepushintas ir nedeployintas; prieš bet kokį deploy būtinas savininko patvirtintas push ir žalias Linux CI.
- Dokumentacijos uždarymo commit bus atskiras nuo kodo.
- Dabartinis sprendimas: **READY FOR CANDIDATE PUSH AND LINUX CI / NO PRODUCTION MUTATION**.
