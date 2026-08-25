# F9 — saugumas, observability ir pilnas autentifikuotas E2E

Data: 2026-08-26  
Būsena: **GO**  
Kodo commitas: `1835bbf`  
CI įrodymas: [GitHub Quality run 32902237284](https://github.com/fornyelsegruppen/landing_no/actions/runs/32902237284)  
Staging deployment: `landing-4xove7mch-darbasnorvegija4-8212s-projects.vercel.app`  
Stabili staging nuoroda: `https://takfornyelse-staging.vercel.app`

## Pasiektas tikslas

F0–F8 kelionė dabar turi pakartojamą, autentifikuotą Linux CI vartą ir izoliuotą Preview infrastruktūrą. Administratorius, darbuotojas ir viešas klientas tikrinami prieš produkcinį build; saugos ribos, migracijos, sugeneruoti tipai ir sintetinės PostgreSQL bazės backup/restore repeticija yra vieno privalomo quality run dalis. Produkcija šiame etape nepakeista ir lieka užblokuota iki F10, realaus piloto bei atskiro savininko `GO`.

## Įgyvendinta

- Naršyklės mutacijų API saugomos centralizuotu `Origin` / CSRF boundary; nepatikima kilmė atmetama prieš verslo logiką.
- Kliento ir darbuotojo JPEG įkėlimai tikrinami pagal tikrą failo turinį, dekoduojami ir per-koduojami, šalinant EXIF, GPS, XMP ir ICC metaduomenis; sugadinti, animuoti ir per dideli failai atmetami.
- `platform health` tikrina serverless-safe Upstash rate limit, Cloudflare Turnstile ir privatų Vercel Blob storage.
- Preview turi atskirą Upstash duomenų bazę, atskirą privatų Blob store ir oficialius Cloudflare testinius Turnstile raktus. Production Blob store ir jo aplinkos įrašas nėra naudojami Preview.
- Privatūs dokumentai saugomi tiesiogiai per `@vercel/blob` private SDK kelią; Payload kolekcijoje saugoma tik apsaugota nuoroda ir metaduomenys. Todėl Payload build perspėjimas apie viešo adapterio nebuvimą yra sąmoningas ir nereiškia lokalaus failo naudojimo debesyje.
- F9 saugos būsena, CI nuoroda, restore nuoroda ir patikros laikas įrašyti tik į Preview konfigūraciją.
- Pridėtas deterministinis viešo turinio bei sintetinių administratoriaus ir darbuotojo paskyrų seed. Sintetinės paskyros leidžiamos tik su `E2E_SEED_ALLOWED=true`, `example.invalid` adresais ir pakankamai ilgais slaptažodžiais.
- Autentifikuotas E2E tikrina custom admin, LT/EN kalbas, mobilų vaizdą, bazinį accessibility, darbuotojo portalą ir admin/worker RBAC.
- Panelės kalba saugoma ne jautriame UI slapuke be priklausomybės nuo lėto API atsakymo; pakartotinis LT → EN → LT → EN perjungimas patikrintas CI ir staging.
- CI tikrina sugeneruotų Payload tipų sinchronizaciją, lint, TypeScript, unit/API, visas migracijas aukštyn/žemyn, produkcinį build, viešą ir autentifikuotą E2E bei `pg_dump` → tuščia DB → restore.
- F9 išimčių matrica išplėsta iki 19 sisteminių scenarijų, įskaitant provider klaidas, retry, idempotency, teises, feature flags, retention, parašus ir offboarding.

## Automatiniai vartai

Oficialus run `32902237284`:

- production dependency audit — PASS;
- generated Payload types — PASS;
- ESLint — PASS;
- TypeScript — PASS;
- unit/API: 463 testai — PASS;
- migracijos: 31 testas — PASS;
- tuščios PostgreSQL schemos bootstrap ir deterministiniai seed — PASS;
- Linux production build — PASS;
- viešas ir autentifikuotas Chromium E2E: 11 scenarijų — PASS;
- sintetinės PostgreSQL bazės `pg_dump` ir restore į atskirą DB — PASS.

## Staging priėmimas

1. Deployment target yra Preview ir build baigėsi `READY`.
2. `https://takfornyelse-staging.vercel.app` alias rodo tik į patikrintą Preview deployment.
3. Autorizuotas protected-preview `HEAD /no` grąžina HTTP 200 ir `X-Robots-Tag: noindex`.
4. Cross-site `POST /api/lead` su nepatikimu `Origin` grąžina 403; tas pats neteisingas payload su teisingu Preview `Origin` pasiekia validaciją ir grąžina 400.
5. Prisijungusio administratoriaus `platform health` rodo `rateLimit=upstash-redis`, `botProtection=cloudflare-turnstile` ir `privateStorage=vercel-blob-private` kaip paruoštus.
6. LT/EN perjungimas custom admin nustatymuose pakartotinai veikia be užstrigusio `disabled` valdiklio.
7. Platform health rodo `Production vis dar užblokuota`; F10 sąlygos nėra apeitos.

## Žinomi, sąmoningai neuždaryti F10 vartai

- Backup/restore įrodymas yra sintetinė CI PostgreSQL bazė. Tai nėra gyvos production kopijos eksportas ar production snapshot atkūrimas.
- Production turi gauti tikrus, atskirai valdomus Turnstile raktus; Preview naudoja oficialius Cloudflare testinius raktus.
- PDF struktūra ir matavimo įrodymai turi automatinius testus, tačiau žmogaus vizualinis ir teisinis patvirtinimas lieka F10 piloto dalis.
- Pricing, legal copy, production monitoring atsakomybės, realus pilotas ir savininko `GO` nėra patvirtinti.
- Tuščias, neprijungtas senas Blob store `takfornyelse-staging-private` neturi failų ir nėra susietas su projektu; jo pašalinimas nėra duomenų saugos blokatorius.
- Istorinėje staging bazėje matomi keli seni nepavykę arba vėluojantys operaciniai job. Sintetinis F9 CI seed jų neturi; prieš F10 pilotą staging operacinė eilė bus peržiūrėta ir pilotas pradėtas nuo apibrėžto baseline.

## Rollback

- Kodo rollback taškas prieš galutinę kalbos kontrolės pataisą: `dca4450`.
- `FEATURE_SECURITY_HARDENING_V2` yra įjungtas tik Preview ir gali būti išjungtas nekeičiant Production.
- Preview alias gali būti grąžintas į ankstesnį deployment; Production deployment nebuvo atliktas.
- Preview Upstash ir Blob resursai yra izoliuoti nuo Production, todėl jų išjungimas ar pakeitimas negali nukreipti Production duomenų.

## F9 GO

F9 techninis tikslas pasiektas: oficialūs vartai žali, autentifikuotos rolės ir responsive keliai patikrinti, failų ir request boundary sustiprinti, Preview integracijos izoliuotos, o sintetinės PostgreSQL bazės atkūrimas įrodytas. Galima pradėti F10 staging pilotą, bet Production gate lieka uždarytas.

FUNCTIONAL_RESULT=PASS  
TARGET_ACHIEVED=YES  
REGRESSION_TESTS=PASS  
STAGING_ACCEPTANCE=PASS  
ROLLBACK_READY=YES
