# Takfornyelse — saugus naktinis vykdymo planas

Data: 2026-08-28
Būsena: **VYKDOMA — O-0 incidentas taisomas pagal savininko išplėstą naktinį įgaliojimą**
Apimtis: Production būklės skaitymo auditas, lokalaus kodo ir testų patikra, PROD-8.2–8.4 spragų registras ir rytojaus savininko UAT paruošimas.

## 1. Tikslas

Kol savininkas miega, maksimaliai užbaigti darbus, kuriems nereikia jo prisijungimo, sprendimo ar rizikingo veiksmo Production aplinkoje. Ryte turi likti trumpas, tikslus veiksmų sąrašas, kur savininkas atlieka tik būtinas kliento, administratoriaus arba Vercel patvirtinimo operacijas.

Šis planas **nepakeičia** [PROD-8 kontroliuojamo funkcijų įjungimo plano](./prod8-controlled-feature-activation-plan-2026-08-27.md). Jis yra saugi tarpinė vykdymo sesija tarp savininko UAT veiksmų.

## 2. Nekeičiama vykdymo taisyklė

1. Fazės vykdomos tik eilės tvarka.
2. Prioritetas išlieka fazių eilė. Jei ankstesnės fazės `COMPLETE GOAL` nepasiektas, ji žymima `BLOCKED / GRĮŽTI RYTE`, o tęsti galima tik tas vėlesnes fazes, kurios neturi techninės, duomenų, autorizacijos ar saugos priklausomybės nuo užblokuotos fazės.
3. Jeigu aptinkamas P0/P1, duomenų vientisumo, autorizacijos, dublikatų arba nepaaiškintas Production 5xx incidentas, pirmiausia aktyvuojamas **taisymo ciklas**: diagnozė → lokalus pataisymas → regresijos testas → pilnos patikros → Preview įrodymas → kontroliuojamas deploy su rollback. Fazė žymima `STOP` tik tada, kai po saugių dokumentuotų bandymų problema neišspręsta arba būtinas savininko sprendimas, secret, finansinis, teisinis ar kitas neatšaukiamas veiksmas.
4. `PARTIAL`, `atrodo gerai`, nebaigtas testas arba nepatikrinta prielaida nėra `PASS`.
5. Joks rezultatas negali būti pažymėtas savininko UAT `PASS`, jeigu jam būtinas savininko paspaudimas, gautas laiškas ar žmogaus įvertinimas.
6. Kiekviena `BLOCKED` fazė privalo turėti: kas nepavyko, atliktus bandymus, įrodymus, riziką, likusį konkretų veiksmą ir sąrašą, kurias vėlesnes fazes ji blokuoja.
7. Užblokuota fazė nestabdo nepriklausomo kodo audito, testų, dokumentacijos, read-only patikrų ar ryto UAT paruošimo.

## 3. Saugumo riba

### Leidžiama be savininko

- skaityti Production būklę, deployment informaciją, sanitarizuotus logus ir agreguotus įrašų skaičius;
- tikrinti viešus puslapius ir prisijungusio administratoriaus puslapius skaitymo režimu;
- audituoti kodą, testus, autorizaciją, idempotency, tokenų ir komunikacijos logiką;
- kurti arba taisyti testus bei dokumentaciją lokaliai;
- paleisti TypeScript, ESLint, Vitest, migracijų ir kitus negriaunamus testus;
- sukurti atskirą commit ir push, jeigu CI bei Preview patikrai to reikia;
- atlikti Preview deploy ir automatinius Preview UAT;
- atlikti siaurą Production hotfix deploy tik tada, kai klaida tiksliai apribota, yra regresijos testas, visos lokalios patikros ir Linux CI yra žalios, Preview įrodymas yra PASS, rollback deployment užfiksuotas ir pakeitimas nekeičia kainodaros, teisinių sąlygų ar klientų dokumentų;
- po tokio hotfix atlikti negriaunamą Production smoke ir stebėti 5xx;
- paruošti tikslias rytojaus instrukcijas ir nuorodas savininkui.

### Draudžiama be savininko

- plataus masto Production deploy, aliaso, domeno, feature flagų arba environment variables keitimas, nesusijęs su patvirtinto incidento pataisymu;
- GitHub merge ar push, jeigu pakeitimas neturi žalios lokalios patikros arba gali nekontroliuojamai pakeisti Production;
- Production DB rašymas, migracija, restore, bylos archyvavimas, trynimas ar statuso keitimas;
- laiško, SMS, kliento nuorodos, pasiūlymo, sutarties, priminimo ar darbuotojo pranešimo siuntimas;
- kliento ar darbuotojo vardu atliktas pasirašymas, priėmimas, atsisakymas ar darbo būsenos pakeitimas;
- paslapčių kūrimas, rodymas, kopijavimas, keitimas ar rotacija;
- kainodaros, teisinių sąlygų, sąskaitų arba mokėjimų taisyklių keitimas;
- veiksmai su tikrais klientais, kurių negalima saugiai atšaukti.

## 4. Patvirtinta pradinė būsena

- Vieša Production svetainė ir `/admin-v2/cases/10` po hotfix atsidaro.
- Senesnių žinučių be `manualRecovery` duomenų skaitymo klaida pataisyta commit `c5ecf4b`.
- Sugeneruoti Payload tipai sinchronizuoti commit `9c8f29b`.
- GitHub `Quality gate` run `33116393482` yra `PASS`: tipų sinchronizacija, lint, TypeScript, testai, migracijos, PostgreSQL build, viešas ir autentifikuotas browser smoke, backup/restore repeticija.
- Sintetinėje Production byloje `#10` yra abiejų šalių pasirašyta `K-10-V1` ir suplanuotas darbo užsakymas.
- Rankinio kontakto atkūrimo funkcija yra Production kode, bet jos pilnas savininko UAT dar neužbaigtas.
- PROD-8.2 ir PROD-8.3 dokumentuose negali būti pažymėti `PASS`, kol neužbaigti likę funkciniai scenarijai.

## 5. Fazės

### O-0 — Production freeze ir bazinė momentinė nuotrauka

**Tikslas:** prieš naktinį auditą įrodyti, kad Production yra stabili ir žinome, ką tikriname.

**Veiksmai**

1. Užfiksuoti aktyvų Git commit, Production deployment ID ir rollback deployment nuorodą.
2. Patikrinti viešus bazinius URL ir administratoriaus bylos skaitymą be būsenos pakeitimo.
3. Patikrinti naujausią žalią GitHub `Quality gate`.
4. Perskaityti paskutinių 30 minučių Production 5xx ir kritinius logus; nefiksuoti paslapčių ar klientų turinio.
5. Patikrinti paskutinio backup/restore įrodymo būseną skaitymo režimu.

**COMPLETE GOAL**

- yra užfiksuotas commit, deployment, rollback, žalias CI ir backup įrodymas;
- baziniai URL grąžina laukiamą būseną;
- nėra nepaaiškinto P0/P1 ar pasikartojančio 5xx;
- nebuvo atliktas joks Production rašymo veiksmas.

Jeigu tikslas nepasiektas: vykdomas taisymo ciklas. Po saugių bandymų likusi problema žymima `BLOCKED / GRĮŽTI RYTE`; tęsiamos visos nuo jos nepriklausomos fazės. Visas naktinis vykdymas stabdomas tik tada, kai nelieka nė vieno saugaus nepriklausomo darbo.

### O-1 — planų ir faktinės Production būsenos sutikrinimas

**Tikslas:** pašalinti pasenusias būsenas dokumentuose, nepervertinant nebaigtų UAT scenarijų.

**Veiksmai**

1. Sutikrinti cutover, PROD-8 ir go-day planus su faktiniais commit, deployment ir bylos `#10` įrodymais.
2. PROD-8.2 ir PROD-8.3 reikalavimus pažymėti tik kaip `PASS`, `ĮRODYTA AUTOMATIŠKAI`, `REIKIA SAVININKO UAT` arba `NEPRADĖTA`.
3. Užfiksuoti rankinio el. pašto atkūrimo funkcijos įdiegimą ir nebaigtą UAT.
4. Nepakeisti jokios teisinės, kainodaros ar GO_FULL_AUTOMATION išvados.

**COMPLETE GOAL**

- kiekvienas PROD-8.2 ir PROD-8.3 kriterijus turi faktinę būseną ir įrodymo nuorodą;
- nė vienas nepatikrintas žmogaus scenarijus nepažymėtas `PASS`;
- aiškiai matyti, ką galima užbaigti automatiškai ir kam ryte reikia savininko.

### O-2 — rankinio kontakto atkūrimo kodo ir saugumo auditas

**Tikslas:** įrodyti, kad naujas emergency kontaktas nekeičia pasirašytų dokumentų ir negali dubliuoti, nutekinti ar nukreipti kitos bylos komunikacijos.

**Tikrinami scenarijai**

1. Neprisijungęs administratorius negali generuoti ar pažymėti rankinio kontakto.
2. Kliento tokenas yra riboto galiojimo, vienkartinis ir susietas su konkrečia žinute bei byla.
3. Neteisingas, pasibaigęs, pakartotinai panaudotas ar pakeistas tokenas atmetamas.
4. El. paštas įvedamas du kartus, normalizuojamas ir validuojamas.
5. Originalus lead el. paštas, pasiūlymas, sutartis, parašai ir hash nekinta.
6. Naujas `communicationEmail` naudojamas tik būsimai komunikacijai.
7. Pasirinktas anksčiau nepasiektas laiškas pakartojamas tik vieną kartą ir tik nauju adresu.
8. Pakartotinis API paspaudimas nekuria antro laiško ar jobo.
9. Rankinis kanalas, laikas ir veiksmas matomi audite/laiko juostoje be paslapčių.
10. Senesnės žinutės be `manualRecovery` saugiai atvaizduojamos.

**Veiksmai**

- atlikti statinę autorizacijos, tokeno, rate-limit, idempotency ir duomenų srauto peržiūrą;
- paleisti esamus susijusius testus;
- trūkstamus edge-case testus pridėti lokaliai;
- aptiktą kodo trūkumą taisyti tik lokaliai ir nekelti į Production be savininko.

**COMPLETE GOAL**

- visi 10 scenarijų turi testą arba aiškų kodo įrodymą;
- visi susiję testai, TypeScript ir ESLint yra `PASS`;
- nėra atviro P0/P1;
- jeigu reikėjo kodo pataisos, ji lieka lokaliame commite su būsena `READY FOR OWNER REVIEW`, be push/deploy.

### O-3 — bylos #10 Production įrodymų auditas tik skaitymo režimu

**Tikslas:** patikrinti jau atlikto komercinio ir darbo paskyrimo kelio vientisumą, nieko byloje nekeičiant.

**Veiksmai**

1. Sutikrinti lead, matavimo, kainos, pasiūlymo, sutarties, parašų, darbo užsakymo, dokumentų, žinučių, jobų ir audito įrašų skaičius.
2. Patikrinti, kad aktyvūs dokumentai naudoja `K-10-V1`, tą pačią kainą, maksimalų dydį ir matavimo versiją.
3. Patikrinti, kad nėra dubliuoto galutinio PDF, parašo, paskyrimo laiško ar aktyvaus darbo užsakymo.
4. Patikrinti pending/retry/failed jobus ir žinučių pristatymo būsenas.
5. Patikrinti, kad darbuotojas susietas tik su jam priskirtu darbu; neatlikti darbuotojo būsenų veiksmų.

**COMPLETE GOAL**

- parengta viena bylos #10 vientisumo lentelė su tiksliais ID ir skaičiais;
- UI, DB ir dokumentų aktyvios versijos sutampa;
- nėra dublių, nepaaiškintų retry/failed jobų ar autorizacijos neatitikimų;
- jokie bylos duomenys nebuvo pakeisti.

Jeigu randamas neatitikimas: `STOP`; nebandyti taisyti Production duomenų be savininko.

### O-4 — PROD-8.2 ir PROD-8.3 likusių UAT veiksmų paketas

**Tikslas:** ryte savininkui pateikti trumpą, vienareikšmį paspaudimų scenarijų be techninio Payload naudojimo.

**Paruošiami paketai**

1. Rankinis kontaktas: sugeneruoti nuorodą → įvesti savininko valdomą testinį el. paštą → patikrinti vieną pakartotinį laišką → patikrinti būsimą laišką.
2. Darbuotojo eiga: `vykstu` → `atvykau` → patikra → darbai pradėti → užbaigimo dokumentai → administratoriaus peržiūra.
3. Neigiami scenarijai, kuriuos saugiau vykdyti automatiniu testu, o ne Production UI.
4. Kiekvienam savininko veiksmui: tiesioginė nuoroda, mygtuko pavadinimas, laukiamas rezultatas ir STOP sąlyga.

**COMPLETE GOAL**

- savininko likęs darbas telpa į vieną nuoseklų checklist;
- kiekvienas žingsnis turi `tikėtinas rezultatas`, `ką pranešti` ir `kada sustoti`;
- nereikalaujama eiti į Payload backend, DB ar terminalą;
- PROD-8.2/8.3 `PASS` dar nesuteiktas, kol checklist realiai neįvykdytas.

### O-5 — PROD-8.4 priminimų ir tinklaraščio automatikos preflight

**Tikslas:** paruošti kitą bangą be feature flagų, cron ar Production konfigūracijos keitimo.

**Veiksmai**

1. Audituoti `CRON_SECRET`, job health, centrinio siuntimų pristabdymo, idempotency ir Europe/Oslo laiko logiką kode.
2. Patikrinti, kad mokėjimo priminimas negali būti išsiųstas be tos dienos banko patikros ir administratoriaus patvirtinimo.
3. Patikrinti, kad SEO automatika sukuria tik juodraštį ir niekada pati nepublikuoja.
4. Patikrinti Gemini/Pexels limitų, retry ir klaidų sanitarizavimo testus.
5. Paruošti tikslius Vercel žingsnius savininkui, jeigu trūksta `CRON_SECRET` ar kitos Production priklausomybės; jokių reikšmių dokumente nefiksuoti.

**COMPLETE GOAL**

- yra aiški priklausomybių lentelė `READY / MISSING / OWNER ACTION`;
- testais įrodyta, kad nėra automatinio blogo publikavimo ir nekontroliuojamo mokėjimo priminimo;
- paruoštas vienas kontroliuojamas PROD-8.4 scenarijus su rollback žingsniu;
- jokie flagai, cron, secrets ar Production jobai nepakeisti.

### O-6 — negriaunanti techninė kokybės patikra

**Tikslas:** patvirtinti nakties lokalių pakeitimų kokybę tiek, kiek leidžia Windows ARM aplinka.

**Veiksmai**

1. Paleisti tikslinius naujų/pakeistų scenarijų testus.
2. Paleisti TypeScript ir ESLint.
3. Paleisti pilną Vitest paketą bei migracijų testus, jeigu aplinka juos palaiko.
4. Dokumentuoti žinomą neprivalomo `@libsql/win32-arm64-msvc` paketo apribojimą; jo neinstaliuoti ir neapeidinėti.
5. Jeigu kodo pakeitimų nėra, remtis paskutiniu žaliu CI `33116393482`; jeigu yra lokalus pakeitimas, jo nevadinti pilnai paruoštu Production, kol Linux CI nepraeis po savininko patvirtinto push.

**COMPLETE GOAL**

- visi aplinkoje įmanomi testai yra `PASS`;
- kiekvienas praleistas testas turi tikslią techninę priežastį;
- nėra paslėpto arba nutylėto raudono patikros rezultato;
- Production nebuvo paliesta.

### O-7 — rytinis perdavimas savininkui

**Tikslas:** savininkas atsikėlęs per kelias minutes supranta, kas padaryta ir ką turi atlikti pats.

**Privalomas rezultatas**

1. `overnight-safe-execution-report-2026-08-28.md` su kiekvienos fazės būsena ir įrodymais.
2. Atskiras sąrašas: `PASS`, `STOP`, `READY FOR OWNER UAT`, `OWNER ACTION REQUIRED`.
3. Tiesioginės nuorodos į bylą, GitHub patikrą ir reikalingus nustatymus.
4. Joks secret, klientų jautrus turinys ar prisijungimo duomuo ataskaitoje nerodomas.
5. Jei yra lokalus kodo commit, nurodytas jo hash ir tikslus saugus push/deploy sprendimas, bet pats push/deploy neatliktas.

**COMPLETE GOAL**

- savininkui pateiktas vienas trumpas veiksmų sąrašas teisinga eilės tvarka;
- aiškiai atskirta, ką sistema įrodė automatiškai ir ką turi patvirtinti žmogus;
- naktinis darbas baigtas be Production mutacijų ir be atviro neaprašyto P0/P1.

## 6. Būsenų registras

| Fazė | Būsena | Įrodymas / rezultatas | Pastaba |
|---|---|---|---|
| O-0 Production freeze | **TAISOMA — LOCAL PASS** | Aktyvus deployment `dpl_CvS7U3tgY16XmLss8aAciiKtZzK5`, rollback kandidatas `dpl_FQW24KoJryQ3iAw1gRd3qrWWQ4bi`, ankstesnis CI run `33116393482` PASS, vieši URL 200, backup įrodymas užfiksuotas; `mark_reviewed` pataisa turi 13/13 tikslinius ir 581/581 unit PASS | Liko Preview, naujas Linux CI ir kontroliuojamas Production patikrinimas. |
| O-1 Planų sutikrinimas | PENDING |  | Pradedama tik užbaigus O-0 PASS. |
| O-2 Rankinio kontakto auditas | PENDING |  |  |
| O-3 Bylos #10 read-only auditas | PENDING |  | O-0 metu atliktas tik ribotas diagnostinis skaitymas. |
| O-4 Savininko UAT paketas | PENDING |  |  |
| O-5 PROD-8.4 preflight | PENDING |  |  |
| O-6 Techninė kokybės patikra | PENDING |  |  |
| O-7 Rytinis perdavimas | PENDING | [Naktinio vykdymo ataskaita](./overnight-safe-execution-report-2026-08-28.md) | Ataskaita bus atnaujinama tęsiant darbus. |

## 7. Geresnis vykdymo modelis

Optimalus nakties scenarijus yra **du atskiri srautai**:

1. **Naktinis saugus srautas:** read-only Production auditas, lokalus kodas, automatiniai testai, dokumentacija ir rytojaus UAT paruošimas.
2. **Rytinis savininko srautas:** tik tie veiksmai, kurie siunčia laišką, keičia bylos būseną, įveda secret, aktyvuoja flagą ar patvirtina žmogaus matomą rezultatą.

Taip pasiekiama didžiausia pažanga nepaliekant automatikai teisės naktį savarankiškai keisti klientų, sutarčių ar Production konfigūracijos.
