# Naktinio saugaus vykdymo ataskaita

Data: 2026-08-28
Galutinė nakties būsena: **visos nuo savininko nepriklausomos fazės užbaigtos; vienas autentifikuotas Preview UAT ir Production duomenų tvarkymas palikti rytui**

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

## BLOCKED / GRĮŽTI RYTE

- `mark_reviewed` pataisa `c2989a1` įdiegta ir lokaliai bei Linux CI patikrinta;
- naujas Preview deployment `dpl_2mBbVwymveu5Jjgw5qc39X7U3dPj` yra `READY` ir priskirtas `takfornyelse-staging.vercel.app`;
- Preview administratoriaus sesija yra pasibaigusi, todėl negalima be savininko atlikti vieno gyvo autentifikuoto UAT;
- ryte reikia prisijungti į Preview, atidaryti vieną neperžiūrėtą sintetinę bylą ir patvirtinti, kad žyma bei vienas audito įrašas išsisaugo be 5xx;
- iki šio įrodymo Production hotfix nedaromas.

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

1. Prisijungti prie Preview ir pagal [UAT checklist](./prod8-owner-uat-checklist-2026-08-28.md) vienoje neperžiūrėtoje sintetinėje byloje paspausti `Peržiūrėta`; patvirtinti, kad žyma išlieka po perkrovimo, sukuriamas vienas audito įrašas ir nėra 5xx.
2. Peržiūrėti [Production invariantų audito](./production-invariant-readonly-audit-2026-08-28.md) 15 dėmesio radinių. Per administravimą archyvuoti arba sutaikyti senas sintetines bylas #1–#7 ir atšaukti vieną pasenusį #10 delivery job **jo nepersiunčiant**. Tada read-only skenerį pakartoti iki 0 kritinių ir 0 nepaaiškintų radinių.
3. Peržiūrėti lokalų commit `51ca68f`. Tik po savininko patvirtinimo jį pushinti į `codex/master-platform-implementation` ir laukti žalio Linux Quality Gate. Be žalio CI nėra Preview ar Production deploy.
4. Po žalio CI pakartoti rankinio kontakto ir `mark_reviewed` Preview UAT. Tik po jų PASS spręsti dėl siauro Production deploy su užfiksuotu rollback.
5. PROD-8.4 aktyvacijai Production aplinkoje pridėti `CRON_SECRET` ir `PEXELS_API_KEY` tik tada, kai sąmoningai pradedama ši banga. `FEATURE_AUTOMATED_REMINDERS=false` ir `FEATURE_SEO_SCHEDULER=false` palikti išjungtus iki atskiro UAT ir aktyvavimo patvirtinimo.

## Fazės

| Fazė | Būsena |
|---|---|
| O-0 Production freeze | **BLOCKED / GRĮŽTI RYTE — tik vienas autentifikuotas Preview UAT** |
| O-1 Planų sutikrinimas | **PASS** |
| O-2 | **PASS** — 26/26 tikslinių testų, TypeScript ir tikslinis ESLint PASS |
| O-3 | **PASS VIENTISUMUI / BLOCKED OPERACINIAM UŽDARYMUI** — TM/PB/T/K/A-K grandinė ir parašai nuoseklūs; ryte reikia atšaukti vieną pasenusį delivery job be persiuntimo |
| O-4 | **PASS** — savininko likę veiksmai sutraukti į vieną UAT checklist |
| O-5 | **PASS / OWNER ACTION REQUIRED** — 37/37 tikslinių testų; trūksta dviejų Production priklausomybių |
| O-6 | **PASS SU PLATFORMOS APRIBOJIMU** — 175 failai / 600 testų, TypeScript, visas ESLint ir diff PASS; lokalios migracijos paliktos Linux CI |
| O-7 | **PASS** — parengtas pilnas rytinis perdavimas, blokatoriai ir saugi veiksmų eilė |

## Lokalūs commitai ir deploy sprendimas

- `c2989a1 fix(admin): persist reviewed case marker safely` — jau pushintas, Linux CI PASS, Preview READY; Production neįdiegtas, nes trūksta vieno autentifikuoto UAT.
- `51ca68f fix(platform): harden recovery and job processing` — sukurtas lokaliai, nepushintas ir nedeployintas; prieš bet kokį deploy būtinas savininko patvirtintas push ir žalias Linux CI.
- Dokumentacijos uždarymo commit bus atskiras nuo kodo.
- Galutinis nakties sprendimas: **NO PRODUCTION MUTATION / READY FOR OWNER UAT**.
