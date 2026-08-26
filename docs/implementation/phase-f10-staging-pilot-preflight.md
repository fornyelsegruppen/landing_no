# F10 — staging piloto ir Production gate preflight

Data: 2026-08-26  
Būsena: **IN PROGRESS — Production NO-GO**  
Paskutinis patvirtintas šakos CI: [GitHub Quality run 32903823308](https://github.com/fornyelsegruppen/landing_no/actions/runs/32903823308)
Staging deployment: `landing-6r1ahdg42-darbasnorvegija4-8212s-projects.vercel.app`
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

## 2026-08-26 kontroliuojamas sintetinis E2E bandymas

Tai nėra realaus 20–30 užklausų piloto pakaitalas. Bandymas atliktas tik Preview su sintetine byla `#12`, sintetine darbuotojo paskyra ir be tikro kliento ar objekto duomenų.

- Užklausa priimta, gavimo patvirtinimas pristatytas el. paštu.
- Rankiniu būdu nurodytas `150 m²` plotas korektiškai sukūrė matavimą `TM-12-V1`, kainos skaičiavimą, pasiūlymą `T-12-V1` ir sutartį `K-12-V1`.
- Patvirtintas matavimas ir kainos paketas; pasiūlymo PDF atsisiųstas bei patikrintas kaip galiojantis PDF.
- Kliento ir tiekėjo parašai įrašyti į galutinę sutartį; abiem parašais pasirašyta kopija pristatyta kontroliuojamu el. paštu.
- Sukurtas darbo užsakymas `#4`, priskirtas sintetinis darbuotojas, išsaugota `2026-08-27 09:00–11:00` Norway planavimo informacija.
- Klientui pristatyti planavimo, „darbuotojas vyksta“, „darbuotojas atvyko“, „darbas pradėtas“ ir užbaigimo laiškai; darbuotojo paskyrimo laišką el. pašto teikėjas priėmė siuntimui į kontroliuojamą testavimo adresą.
- Darbuotojo eiga praėjo būsenas `scheduled → on_way → arrived → precheck → ready → in_progress → completed → documented`.
- Įkelta po 2 sintetines prieš ir po nuotraukas, užfiksuotas kontrolinis plotas, sauga, kainos rezultatas `within_contract` ir galutinė suma, sutampanti su patvirtintu pasiūlymu.
- Administratoriaus galutinė kontrolė sukūrė sąskaitos juodraštį `FU-4-V1` ir aktyvią garantiją `G-4-V1`; abiem dokumentams sugeneruoti PDF, o užbaigimo laiškas pristatytas.
- Po bandymo sisteminiai invariantai grąžino `ok: true`; Preview release gate sąmoningai liko `Production NO-GO`, nes žmogaus, realaus piloto ir savininko įrodymai dar nepateikti.

### Bandymo metu rastos ir pataisytos regresijos

- Legacy Preview aplinkoje atlaisvintas teisėtas bylos atnaujinimas, kai `FEATURE_CASE_STATE_ENGINE_V2` išjungtas; įjungto V2 režimo monotoniška revizijų apsauga išliko.
- Nepavykus išsaugoti rankinio matavimo, jo dalinis įrašas dabar pašalinamas.
- Pilnai dokumentuotą rankinį matavimą galima patvirtinti be žemėlapio vaizdo, kaip numatyta rankinio fallback taisyklėje.
- Dokumentų hash suvienodintas su JSON saugojimo semantika, todėl persistuoto pasiūlymo ir sutarties snapshotai patikrinami stabiliai.
- Sėkmingai paruošus arba išsiuntus komercinį paketą, nebeaktualūs AI atsakymo juodraščiai atšaukiami.
- Darbuotojo API dabar griežtai tikrina veiksmų seką; dokumentacijos nebegalima pateikti prieš aiškų darbo užbaigimą ar kitaip apeiti būsenų eigą.

### Sąmoningai palikti F10 apribojimai

- Sintetinė byla nėra realus klientas ir nėra įtraukiama į 20–30 realių užklausų piloto imtį.
- `LEAD_INBOX_PILOT_REFERENCE`, fiziniai 3 stogų matavimai, kainų, teisinių tekstų, parašo, komunikacijos ir savininko galutiniai patvirtinimai lieka nepateikti.
- Sąskaita šiame etape yra tik vidinis juodraštis; ji nebuvo išsiųsta kaip mokėjimo reikalavimas.
- Preview turi istorinių operacinių perspėjimų, todėl jie turi būti atskirai peržiūrėti prieš realų pilotą; pats sintetinis kelias nepaliko nepavykusių el. laiškų.

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
REGRESSION_TESTS=PASS (158 failai / 507 testai; galutinis CI numeris atnaujinamas po push)
STAGING_ACCEPTANCE=PENDING_HUMAN_SIGNOFF  
ROLLBACK_READY=YES
