# F10 — staging piloto ir Production gate preflight

Data: 2026-08-26  
Būsena: **IN PROGRESS — Production NO-GO**  
Galutinis šakos CI: [GitHub Quality run 32903823308](https://github.com/fornyelsegruppen/landing_no/actions/runs/32903823308)  
Staging deployment: `landing-qso18lkhl-darbasnorvegija4-8212s-projects.vercel.app`  
Stabili staging nuoroda: `https://takfornyelse-staging.vercel.app`

## Preflight rezultatas

F10 techninė pradžios sąlyga pasiekta: F0–F9 turi `GO`, galutinis commitas praėjo visą Linux/PostgreSQL/Chromium quality run, Preview infrastruktūra izoliuota, o Production vartai lieka centralizuotai užblokuoti. Techniniai pasiūlymo, sutarties, darbuotojo mobilios kelionės ir komunikacijos V2 QA įrodymai užregistruoti tik Preview.

F10 dar nėra užbaigta. Nė vienas žmogaus, teisinis, fizinio matavimo, realaus piloto ar produkcijos savininko patvirtinimas nėra sukurtas iš techninio testo.

## Jau įrodyta

- `QUOTE_JOURNEY_QA_REFERENCE` — galutinis autentifikuotas CI;
- `CONTRACT_JOURNEY_QA_REFERENCE` — galutinis autentifikuotas CI;
- `WORKER_MOBILE_QA_REFERENCE` — galutinis autentifikuotas CI;
- `COMMUNICATION_V2_QA_REFERENCE` — galutinis autentifikuotas CI;
- `SECURITY_HARDENING_QA_REFERENCE` — F9 saugos ir E2E CI;
- `RESTORE_TEST_REFERENCE` — sintetinės PostgreSQL bazės dump/restore CI;
- Preview platform health: AI, Resend, adresai, pastatų poligonai, vidinis parašas, teisinis šablonas, job, Upstash, Turnstile ir privatus Blob pažymėti paruoštais;
- Production nebuvo diegta ir jokie jos feature flags nebuvo pakeisti.

## Likę privalomi vartai

### Bendri visoms aktyvioms funkcijoms

- `STAGING_QA_REFERENCE` — savininko pasirašyta rankinė staging QA;
- `LEAD_INBOX_PILOT_REFERENCE` — 20–30 realių pilotinių užklausų ataskaita;
- `PRODUCTION_OWNER_APPROVAL_REFERENCE` — atskiras galutinis rašytinis savininko `GO`.

### Specifiniai

- `AI_CONTENT_PILOT_REFERENCE` — kontroliuojamas AI turinio pilotas ir žmogaus kokybės išvada;
- `ROOF_VALIDATION_REFERENCE` — bent 3 reprezentatyvių stogų sistemos matavimo palyginimas su fizine kontrole;
- `PRICING_APPROVAL_REFERENCE` — patvirtintas kainynas, PVM, minimumas, tolerancija ir maksimali kaina;
- `SIGNATURE_APPROVAL_REFERENCE` — patvirtintas parašo įrodymas, sutartis, atsisakymo ir ankstyvo pradėjimo tekstai;
- `COMMUNICATION_APPROVAL_REFERENCE` — patvirtintas laiškų ritmas, turinys ir atsakomybės.

### Prieš pat Production cutover

- šviežias Production snapshot ir privatus Blob inventorius;
- produkciją primenančios kopijos restore bei eilučių/ryšių palyginimas;
- tikri, Production skirti Turnstile raktai;
- incident, monitoring ir rollback atsakingi asmenys;
- visi release-gate įrašai turi realias dokumentų nuorodas, ne paslaptis ir ne bendrus žodinius pažadus.

## Vykdymo seka

1. Užbaigti rankinę desktop/mobile checklist ir užregistruoti visus nukrypimus.
2. Atlikti 20–30 realių lead pilotą pagal `f10-pilot-evidence-template.md`; visus klientui siunčiamus tekstus ir sumas tvirtina administratorius.
3. Bent 3 stogams palyginti automatinį horizontalų plotą, kampo koeficientą ir galutinį plotą su fizine kontrole.
4. Peržiūrėti piloto KPI: gavimo laiško laikas, pasiūlymo parengimo laikas, admin korekcijų dalis, matavimo paklaida, pristatymo klaidos, pasikartojimai ir neteisingos būsenos.
5. Patvirtinti kainas, teisinius tekstus, parašą ir komunikaciją; nukrypimų atveju grįžti į atitinkamą taisymo fazę.
6. Tik po sėkmingo piloto užpildyti Preview release-gate nuorodas ir pakartoti platform health.
7. Prieš Production atlikti šviežią backup/Blob inventorių ir production-like restore.
8. Pateikti savininkui galutinį `GO / NO-GO` paketą. Be atskiro rašytinio `GO` produkcija lieka nepakeista.

## Dabartinis vartas

FUNCTIONAL_RESULT=IN_PROGRESS  
TARGET_ACHIEVED=NO  
REGRESSION_TESTS=PASS  
STAGING_ACCEPTANCE=PENDING_HUMAN_SIGNOFF  
ROLLBACK_READY=YES

