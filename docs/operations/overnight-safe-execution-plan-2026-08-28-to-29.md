# Takfornyelse — saugus naktinis vykdymo planas 2026-08-28 → 2026-08-29

**Būsena:** savininko patvirtintas ir vykdomas

**Kandidatas:** `29e51a76f9edfe132ab503bc7b6266cbfd76b822` (`fix(admin): remove duplicate question recovery actions`)

**Preview:** `dpl_4B2m6UdCxxcboBX8fSZthdRTXNPd` — `READY`

**Staging alias:** `https://takfornyelse-staging.vercel.app`

**Production baseline:** `dpl_CvS7U3tgY16XmLss8aAciiKtZzK5`, SHA `c5ecf4b…` — naktį nekeičiamas

**Patvirtinta apimtis:** lokalios saugios kodo pataisos, testai,
dokumentacija ir lokalūs commit; GitHub push tik į dabartinę darbo šaką ir
Vercel Preview deploy tik po visų žalių patikrų. Production, klientų
komunikacija, DB duomenys, secrets, env, webhook, cron, kainos, sutartys ir
išorinės paskyros nekeičiamos.

## 1. Nakties tikslas

Iki ryto maksimaliai užbaigti darbus, kuriems nereikia savininko prisijungimo, žmogaus UAT, laiško gavimo patvirtinimo ar rizikingo Production veiksmo:

1. užrakinti klausimų ir DI atsakymų srauto logiką testais;
2. rasti bei lokaliai ištaisyti tiksliai atkuriamas mažos rizikos klaidas;
3. atlikti išsamų būsenų, dublių, konkurencinių paspaudimų ir pristatymo auditą;
4. paruošti implementavimui tinkamą `Case Workspace V3` specifikaciją;
5. surinkti release saugos įrodymus ir paruošti trumpą ryto UAT;
6. nepalikti neaprašyto P0/P1 radinio.

## 2. Nekeičiamos vykdymo taisyklės

1. Fazės vykdomos eilės tvarka, tačiau užblokuota fazė nestabdo nuo jos nepriklausomų saugių fazių.
2. Fazė baigiama tik pasiekus jos `COMPLETE GOAL`. `Atrodo gerai`, dalinis testas ar prielaida nėra `PASS`.
3. Radus atkuriamą lokalią kodo klaidą: diagnozė → siaura pataisa → regresijos testas → tiksliniai testai → pilna patikra.
4. Jeigu pataisai reikia Production duomenų, paslapties, išorinės paskyros, teisinio ar kainodaros sprendimo, fazė pažymima `BLOCKED / OWNER ACTION`, įrodymai išsaugomi, o darbas tęsiamas kitose nepriklausomose fazėse.
5. Naktiniai pakeitimai negali tyliai pakeisti esamo proceso, kainų, sutarčių, laiškų turinio ar next-action prioriteto.
6. Visi radiniai ir testų rezultatai įrašomi į rytinę ataskaitą.

## 3. Leidžiama be savininko

- skaityti kodą, Git būklę, CI, deployment metaduomenis ir sanitarizuotus agreguotus logus;
- vykdyti lokalius unit, integration, component, TypeScript, ESLint, Prettier ir build testus;
- rašyti dokumentaciją, testus ir mažos rizikos lokalias pataisas;
- kurti lokalų commit atskiroms patikrintoms pataisoms;
- vykdyti tik GET/HEAD viešų ir auth-boundary endpointų smoke patikras;
- inventorizuoti aplinkos kintamųjų pavadinimus ir scope, ne reikšmes;
- naudoti tik aiškiai read-only DB rolę ir tik agreguotoms invariantų patikroms be PII;
- stebėti, kad Preview ir Production deployment bei aliasai nepasikeitė.

## 4. Draudžiama be savininko

- bet koks Production deploy, promote, rollback, aliaso, domeno ar feature flago keitimas;
- Preview deploy arba GitHub push, jei savininkas tam aiškiai nepatvirtino naktinės apimties;
- Production ar shared staging DB rašymas, migracija, snapshot, restore, bylos kūrimas, archyvavimas ar trynimas;
- laiškų, SMS, pasiūlymų, sutarčių, nuorodų ar priminimų siuntimas;
- webhook replay, cron/job paleidimas ar provider konfigūracijos keitimas;
- kliento ar įmonės parašas, kainos, sutarties, mokėjimo ar darbo būsenos pakeitimas;
- secrets, API raktų, bypass raktų, DNS, billing ar išorinių paskyrų keitimas;
- GitHub merge, darbo šakos trynimas arba destruktyvus failų/duomenų veiksmas;
- `Case Workspace V3` plataus masto UI perrašymas be rytinio sprendimo.

## 5. Agentų atsakomybės

| Srautas                             | Atsakingas                  | Naktinis rezultatas                                                                               |
| ----------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| Klausimų ir DI atsakymų srautas     | James + pagrindinis agentas | Būsenų matrica, regresijos testai, saugios lokalios pataisos ir P0/P1 sąrašas                     |
| Release ir Production sauga         | Ptolemy                     | Tikslus RC/Preview/Production manifestas, 5xx/CI/alias kontrolė ir rollback kortelė               |
| `Case Workspace V3` UX              | Hume                        | Implementavimui tinkama specifikacija, komponentų ribos, mobilus/a11y modelis ir etapinis rollout |
| Integracija ir galutinis sprendimas | Pagrindinis agentas         | Agentų išvadų sutikrinimas, pilna techninė patikra ir rytinė ataskaita                            |

## 6. Fazės

### N-0 — Baseline freeze ir darbo medžio kontrolė

**Veiksmai**

1. Užfiksuoti tikslų `HEAD`, bazinį commit, diff, necommitted failus ir ne savo pakeitimus.
2. Užfiksuoti GitHub Quality run, Preview deployment/alias/SHA ir dabartinį Production deployment/SHA.
3. Patikrinti, kad staging alias rodo `29e51a7`, o Production liko `c5ecf4b…`.
4. Sukurti rytinės ataskaitos karkasą.

**COMPLETE GOAL**

- kiekvienas vėlesnis pakeitimas atsekamas iki `29e51a7`;
- neperrašyti ir neįtraukti svetimi/untracked naudotojo failai;
- Preview ir Production baseline įrodyti ir Production nepakeista.

---

### N-1 — Klausimų srauto būsenų ir vieno veiksmo auditas

**Tikrinama grandinė**

`question received → needs reply → AI/manual draft → safety accepted/rejected → admin review → queued/sent → delivered/failed → signing unlocked/blocked`

**Veiksmai**

1. Patikrinti `case-read-model`, customer-question workbench, action visibility helperį, message engine ir API kontraktus.
2. Įrodyti, kad vienu metu yra vienas pagrindinis CTA ir vienas aktyvus atsakymo redaktorius.
3. Patikrinti, kad `delivered`, o ne vien `queued/sent`, panaikina signavimo blokavimą.
4. Patikrinti, kad bounce/failure, stale source, pasikeitęs fingerprint ar atšauktas juodraštis turi aiškų recovery kelią.
5. Užfiksuoti, kurios būsenos rodomos administratoriams LT/EN, o klientams tik NB.

**COMPLETE GOAL**

- kiekviena būsena turi vieną šaltinį, vieną pagrindinį veiksmą, sėkmės įrodymą ir recovery kelią;
- nėra dviejų vienodos reikšmės geltonų mygtukų tame pačiame būsenos pjūvyje;
- neatitikimai turi testą ir konkretų taisymo sprendimą.

---

### N-2 — Neigiami scenarijai, idempotency ir concurrency

**Veiksmai**

1. Testais patikrinti dvigubą paspaudimą ir lėtą response: neturi būti dviejų dokumentų, žinučių, jobų ar AI užklausų.
2. Patikrinti cancelled draft → recreate, safety rejection → new draft ir source-changed → administrator review scenarijus.
3. Patikrinti CAS/revision/fingerprint ribas: pasenęs procesas negali perrašyti aktyvaus ar siunčiamo atsakymo.
4. Patikrinti AI kvotą: vienas Gemini bandymas = vienas audito įrašas; safety retry daugiausia vienas; transporto retry papildomos AI kvotos nenaudoja.
5. Patikrinti 2 000 simbolių skaitiklį, submit būseną, fokusą ir `aria-live` rezultatą.

**COMPLETE GOAL**

- visi P0/P1 neigiami scenarijai turi deterministinį testą;
- rastos mažos rizikos klaidos pataisytos su regresijos testu;
- nelieka nepaaiškinto dublikavimo, klaidingo unlock arba stale overwrite kelio.

---

### N-3 — DI faktų šaltinių ir atsakymų saugos auditas

**Veiksmai**

1. Įrodyti, kad atsakymas remiasi aktyviu pasiūlymu, matavimo versija, aktyviomis kainomis, galiojančiomis sutarties sąlygomis ir įmonės duomenimis iš DB.
2. Patikrinti NOK/øre formatavimą, PVM, maksimalios kainos ir papildomų paslaugų paaiškinimą.
3. Patikrinti, kad neaktyvi ar sena sutarties/kainos versija nepatenka į naują juodraštį.
4. Patikrinti faktų tikrinimo atmetimo paaiškinimą bei profesionalų rankinio teksto perfrazavimą.
5. Pridėti regresiją dėl netaisyklingo `endringsavtalel` ir analogiškų sugeneruotų galūnių, jei tai galima saugiai blokuoti validatoriumi/prompt taisykle.

**COMPLETE GOAL**

- kiekvienas komercinis teiginys turi atsekamą aktualų duomenų šaltinį;
- atsakymas negali tyliai naudoti seno kainoraščio ar senų sąlygų;
- faktų atmetimas nepalieka neaiškių/dubliuotų veiksmų.

---

### N-4 — Responsive, prieinamumo ir lokalizacijos auditas

**Veiksmai**

1. Statiškai ir komponentų testais patikrinti 360–375 px plotį, ilgus LT/EN/NB tekstus ir CTA neišnykimą.
2. Patikrinti klaviatūros eigą, focus management, `aria-live`, disabled/loading/success/error būsenas.
3. Patikrinti, kad administravimo vertimai nekeičia kliento norvegiško teksto.
4. Parengti aiškių būsenų etikečių modelį: trumpa frazė, svarbos spalva, jokio perteklinio `Būsena:`.

**COMPLETE GOAL**

- kritiniai veiksmai pasiekiami telefonu ir klaviatūra;
- po veiksmo vartotojas aiškiai mato rezultatą toje pačioje vietoje;
- nėra nelokalizuoto techninio statuso pagrindiniame admin sraute.

---

### N-5 — `Case Workspace V3` implementavimo specifikacija

**Naktį nekoduojamas platus perrašymas.** Parengiamas sprendimas rytiniam patvirtinimui.

**Veiksmai**

1. Aprašyti kompaktišką sticky bylos juostą: klientas, byla, aktyvi versija, sutartis, suma, būsena ir vienas kitas veiksmas.
2. Aprašyti centrinę proceso laiko juostą su paspaudžiamais etapais, dokumentais, blokavimo priežastimis ir recovery šakomis.
3. Nustatyti vienintelį next-action/workbench ir vienintelį `MessageDraftEditor` savininką.
4. Parengti mobilų modelį, naudojant Takfornyelse logotipą administratoriaus ir darbuotojo aplinkose.
5. Pateikti du rollout variantus, rekomenduojant laipsnišką komponentų iškėlimą, išlaikant esamus API ir read-model kontraktus.
6. Kiekvienam etapui aprašyti testus, rollback ir `COMPLETE GOAL`.

**COMPLETE GOAL**

- specifikacija pakankama pradėti kodavimą be papildomo proceso interpretavimo;
- V3 nekeičia verslo logikos „big-bang“ būdu;
- kiekvieną implementacijos pjūvį galima nepriklausomai patvirtinti, testuoti ir atšaukti.

---

### N-6 — Release saugos ir read-only infrastruktūros įrodymai

**Veiksmai**

1. Patikrinti GitHub Quality, Preview READY, staging alias → deployment → SHA ir Production nepakitimą.
2. Peržiūrėti agreguotą Preview 5xx langą ir provider health be klientų turinio.
3. Inventorizuoti Production env pavadinimus/scope be reikšmių.
4. Jei egzistuoja tikra read-only DB rolė, vykdyti tik row/migration/invariant skaičiavimus be PII; kitu atveju pažymėti `OWNER ACTION`.
5. Parengti rollback kortelę: dabartinis Production deployment, SHA, išjungtinų flagų sąrašas ir incidento savininkas.

**COMPLETE GOAL**

- tiksliai žinoma, kokį kandidatą ryte UAT tikrina savininkas;
- Production nepajudinta ir tai įrodyta;
- kiekvienas trūkstamas backup/restore/Blob/DB įrodymas turi konkretų rytinį veiksmą.

---

### N-7 — Pilna techninė patikra

**Veiksmai**

1. Paleisti tikslinius klausimų srauto testus.
2. Paleisti pilną unit/integration testų paketą.
3. Paleisti TypeScript, ESLint, Prettier/diff ir production build.
4. Dokumentuoti žinomą Windows ARM neprivalomo `libsql` modulio apribojimą; jo nenaudoti kaip Linux/Vercel build nesėkmės įrodymo.
5. Jeigu yra patvirtintas push į darbo šaką, laukti žalio Linux CI ir tik tada laikyti kandidatą `READY FOR OWNER UAT`.

**COMPLETE GOAL**

- visi įmanomi patikrinimai `PASS` arba aiškiai dokumentuotas platforminis apribojimas;
- kiekviena lokali pataisa turi regresijos testą;
- nėra nutylėto raudono rezultato.

---

### N-8 — Rytinis perdavimas

**Privalomi artefaktai**

1. `overnight-safe-execution-report-2026-08-29.md` su kiekvienos fazės `PASS / FAIL / BLOCKED / OWNER ACTION`.
2. RC manifestas: SHA, base, diff, CI run ir Preview deployment.
3. P0/P1/P2 radinių bei pataisų sąrašas su failais ir testais.
4. `Case Workspace V3` specifikacija ir rekomenduojama įgyvendinimo tvarka.
5. Ne ilgesnis kaip 10–15 min. savininko UAT ant tikslaus Preview kandidato.
6. Atskiras sąrašas, ko naktį sąmoningai nepakeitėme.

**COMPLETE GOAL**

- savininkas per 5 minutes supranta nakties rezultatą;
- žino tikslų pirmą ryto veiksmą ir STOP sąlygą;
- nėra neaprašyto P0/P1, Production mutacijos ar realaus kliento kontakto.

## 7. Ryto UAT branduolys

Tik po naktinių automatinių patikrų savininkas Preview aplinkoje patikrina:

1. klausimas: `Er impregnering inkludert i dette tilbudet, og hva skjer med prisen dersom kontrollmålingen viser et større takareal?`;
2. DI juodraštis → atšaukti → sukurti iš naujo;
3. matomas vienas aiškus veiksmas ir vienas redaktorius;
4. faktai sutampa su aktyviu pasiūlymu, matavimu, kainomis ir sąlygomis;
5. administratorius patvirtina tik savininko valdomame sintetiniame scenarijuje;
6. pristatymo ir signavimo blokavimo būsena pasikeičia tik pagal tikrą delivery rezultatą.

## 8. Griežti STOP signalai

Naktinis vykdymas nedelsiant sustabdo susijusį srautą ir fiksuoja įrodymą, jeigu:

- `HEAD`, Preview SHA arba staging alias netikėtai pasikeitė;
- pajudėjo Production deployment/alias;
- aptiktas realaus kliento gavėjas, bylos mutacija ar siuntimo bandymas;
- reikia DB write/migration, secret, env, webhook, cron, DNS ar billing keitimo;
- randamas nepaaiškintas dublikatas, autorizacijos pažeidimas, duomenų neatitikimas ar 5xx;
- testas raudonas ir saugi lokali pataisa neįmanoma;
- backup/restore, DB ar Blob įrodymas nesutampa;
- kyla rizika išnaudoti AI ar kito providerio gyvą kvotą.

Užblokuotas srautas aprašomas ir paliekamas rytui; visi nepriklausomi saugūs darbai tęsiami.

## 9. Patvirtinimo apimtis

Rekomenduojama savininko formuluotė prieš naktinį vykdymą:

> Patvirtinu naktinį planą. Leidžiu lokalius saugius kodo pataisymus, testus, dokumentaciją ir lokalius commit. Taip pat leidžiu GitHub push į dabartinę darbo šaką ir Vercel Preview deploy tik po visų žalių patikrų. Neleidžiu Production, klientų komunikacijos, DB duomenų, secrets, env, webhook, cron, kainų, sutarčių ar išorinių paskyrų pakeitimų.
