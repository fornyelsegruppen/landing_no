# Takfornyelse — PROD-8 kontroliuojamo funkcijų įjungimo planas

Data: 2026-08-27  
Būsena: **PROD-8.1 PASS — PROD-8.2 ir PROD-8.3 VERIFYING — PROD-8.4 PRECHECK**
Apimtis: Production `takfornyelse.as`, administratoriaus `/admin-v2`, darbuotojo `/user`, saugios kliento nuorodos ir automatiniai operaciniai procesai.

## 1. Tikslas ir sprendimas

PROD-8 tikslas — sklandžiai įjungti visą jau Staging aplinkoje patikrintą platformą, tačiau nesujungti visų rizikų vienu neatskiriamu veiksmu. Funkcijos jungiamos keturiomis tarpusavyje izoliuotomis bangomis. Po kiekvienos bangos atliekamas tikslinis Production testas, tikrinami duomenys, laiškai, dokumentai, logai ir autorizacija.

**Nekeičiama perėjimo taisyklė:** kitas etapas nepradedamas, kol ankstesnis neturi `PASS`, visų reikalaujamų įrodymų ir aiškiai užfiksuoto rezultato šiame dokumente. `VERIFYING`, `PILOT_ACTIVE`, `PARTIAL` arba žodinis „atrodo gerai“ nėra `PASS`.

Šis planas leidžia pasiekti veikiantį kontroliuojamą Production pilotą. Jis savaime nesuteikia `GO_FULL_AUTOMATION`. Pilnas automatikos sprendimas galimas tik po 20–30 realių bylų piloto ir bent trijų automatinių stogo matavimų palyginimo su fizine kontrole.

## 2. Saugos principai

1. Klientui siunčiama gavimo žinutė lieka aktyvi; visi komerciniai AI tekstai, kainos, pasiūlymai ir sutartys iki pilno GO reikalauja administratoriaus patvirtinimo.
2. Sintetiniuose testuose naudojamas tik savininko kontroliuojamas el. paštas, telefonas ir objektas. Žymėjimas: `PROD-8-W<bangos numeris>-<testas>`.
3. Vienas testinis veiksmas atliekamas vieną kartą. Pakartojimas leidžiamas tik patikrinus, kad pirmas bandymas nesukūrė dalinio įrašo ar neišsiuntė laiško.
4. Po Production paleidimo duomenų bazė nėra aklai grąžinama iš kopijos, nes taip būtų galima prarasti per tą laiką gautas realias užklausas. Įprastas rollback: išjungti konkrečios bangos flagus, redeployinti paskutinę stabilią konfigūraciją, sustabdyti tos bangos laukiančias užduotis ir išsaugoti sukurtus audito įrašus. DB restore naudojamas tik P0 duomenų vientisumo incidentui, sustabdžius priėmimą ir sutikrinus naujus įrašus.
5. Paslaptys, prisijungimo duomenys, klientų duomenys ir el. laiškų turinys nefiksuojami GitHub dokumentuose ar komandų išvestyje.
6. Kiekviena banga turi atskirą flagų momentinę nuotrauką, aktyvaus deployment ID, ankstesnio stabilaus deployment ID ir rollback komandą.
7. Kiekvienos bangos logai tikrinami iškart bei po 5, 15 ir 30 minučių. P0/P1, dubliuota žinutė, neteisingas dokumentas, kaina arba autorizacijos pažeidimas reiškia `STOP`.
8. Sintetinės bylos po PASS archyvuojamos, bet ne ištrinamos; paliekamas nekintamas audito pėdsakas.
9. Administracijoje aiškiai rodoma, kad sistema veikia `KONTROLIUOJAMO PILOTO` režimu, kokia banga aktyvi ir kurios funkcijos dar išjungtos.
10. Prieš automatinių operacinių laiškų ir priminimų įjungimą turi veikti vienas centrinis avarinis jų pristabdymo veiksmas. Jis nestabdo naujų klientų užklausų gavimo ir gavimo patvirtinimo, bet neleidžia pradėti naujų automatinių komercinių ar operacinių siuntimų.

## 3. Būsenos ir užbaigimo protokolas

| Būsena        | Reikšmė                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `PENDING`     | Etapas nepradėtas                                                                   |
| `PRECHECK`    | Tikrinamos priklausomybės, niekas nejungiama                                        |
| `DEPLOYED`    | Konfigūracija įjungta ir deployment yra `Ready`, bet funkcinis testas dar nebaigtas |
| `VERIFYING`   | Vyksta vienas kontroliuojamas testas ir įrodymų rinkimas                            |
| `PASS`        | Įvykdyti visi etapo kriterijai, nėra atviro P0/P1, galima pereiti toliau            |
| `STOP`        | Aptiktas stabdantis neatitikimas; kitas etapas draudžiamas                          |
| `ROLLED_BACK` | Bangos flagai grąžinti į saugią būseną ir patvirtintas stabilumas                   |

Kiekvieno etapo užbaigimo įrašas privalo turėti:

- datą ir Europe/Oslo laiką;
- testinės bylos bei dokumentų ID, neįrašant PII;
- deployment ir commit ID;
- įjungtų flagų sąrašą;
- tikslinių testų ir logų rezultatą;
- el. laiškų skaičių bei pristatymo būseną;
- audito įrašo patvirtinimą;
- galutinę `PASS`, `STOP` arba `ROLLED_BACK` būseną.

## 4. PROD-8.0 — bendras Production preflight

**Tikslas:** prieš pirmą funkcijų bangą turėti patikrintą pradinę būseną ir momentinį grįžimo kelią.

### Veiksmai

1. Užfiksuoti aktyvų Production deployment, commit ir domenų aliasus.
2. Patvirtinti, kad PROD-7 yra `PASS`, o byla `#8` archyvuota su `lead.archive` audito įrašu.
3. Sukurti šviežią Production Neon kopiją ir patikrinti, kad ji pasiekiama tik skaitymo kontroliniam testui.
4. Užfiksuoti visų 13 `FEATURE_*` reikšmes ir patvirtinti, kad prieš pirmą bangą jos yra `false`.
5. Patikrinti rollback į ankstesnį `Ready` deployment ir konfigūracijos grąžinimo veiksmus.
6. Patikrinti esamus `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `PAYLOAD_SECRET`, Production domeną ir siuntėjo tapatybę, neatskleidžiant reikšmių.
7. Paruošti pirmos bangos Gemini konfigūraciją: `GEMINI_API_KEY`, `GEMINI_MODEL`, dienos ir mėnesio limitus.
8. Užregistruoti tikrus jau atliktų Staging QA, restore ir savininko patvirtinimo identifikatorius. `LEAD_INBOX_PILOT_REFERENCE` nepildomas, kol nėra 20–30 realių bylų ataskaitos.
9. Ištirti žinomą `/meta.json` 500: jei tai aplikacijos klaida, pataisyti prieš pirmą bangą; jei tai nesusijęs platformos zondas, dokumentuoti įrodymą ir poveikio nebuvimą.
10. Patikrinti Production 5xx, neišsiųstų žinučių, laukiančių/įstrigusių darbų ir aktyvių sintetinių bylų pradinį skaičių.
11. Administracijoje paruošti aiškią piloto būsenos juostą. Užfiksuoti iki 5 minučių atliekamą flagų rollback veiksmą; prieš PROD-8.3 papildomai patikrinti centrinį automatinių siuntimų pristabdymą.

### PASS

- yra šviežia DB kopija, aktyvus ir rollback deployment ID;
- flagų pradinė būsena dokumentuota ir visi flagai `false`;
- pirmos bangos priklausomybės paruoštos;
- nėra nekontroliuojamų 5xx, įstrigusių laiškų ar neužbaigtos sintetinės bylos;
- `/meta.json` būklė išspręsta arba įrodyta kaip nepaveikianti platformos;
- administratorius mato kontroliuojamo piloto būseną, o rollback veiksmą galima atlikti per 5 minutes;
- preflight rezultatas įrašytas lentelėje.

### STOP

- backup arba rollback nepatikrinamas;
- aptinkamas nepaaiškintas 5xx, duomenų neatitikimas arba Production/Preview paslapties sumaišymas;
- negalima saugiai nustatyti flagų ar priklausomybių būsenos.

### Vykdymo įrašas — 2026-08-27

**Dabartinė būsena: `PASS`.** PROD-8.0 užbaigtas; PROD-8.1 nepradėtas ir visi jo flagai tebėra išjungti.

Patvirtinta:

- aktyvus safety-only Production deployment: `dpl_CWjdo63P3zdBmvFymZ3RwDnkmPXu` (`Ready`), domenai `takfornyelse.as`, `www.takfornyelse.as` ir `landing-no.vercel.app`;
- momentinis rollback deployment: `dpl_DU2EPy99v6px53cQQfAqTYq3afHj` (`Ready`); numatytas veiksmas `vercel rollback dpl_DU2EPy99v6px53cQQfAqTYq3afHj --yes`;
- šviežia Production DB kopija: `br-damp-unit-as3pdkgr`; kopija pasiekiama tik skaitymui, įrašų skaičiai sutikrinti;
- visi 13 Production `FEATURE_*` flagų yra `false`;
- aktyvių sintetinių bylų nėra; PROD-7 byla `#8` archyvuota;
- Production bazinė eilė: vienas užbaigtas operacinis darbas, viena išsiųsta žinutė, įstrigusių darbų nenustatyta;
- `/meta.json` 500 priežastis pašalinta commitais `8098739` ir `6007e79`;
- 184 testų failai ir 584 testai PASS; TypeScript bei ESLint PASS;
- galutinis Phase 0 Preview deployment `dpl_Ep3DEjGjPyWiAxqDuYCWpFLCwoXQ` yra `Ready`, turi piloto režimo konfigūraciją ir priskirtas `takfornyelse-staging.vercel.app`;
- Preview smoke: `/no`, `/en`, `/no/blogg`, `/robots.txt`, `/sitemap.xml` = 200; `/admin-v2` ir `/user` = saugus login redirect; `/meta.json` = 404; 5xx = 0;
- centrinis automatinių operacinių siuntimų pristabdymas įdiegtas ir padengtas testais;
- administratoriaus kontroliuojamo piloto juosta įdiegta ir turi render testą LT kalba.

Užbaigta per safety-only Production deploy:

- Production `GEMINI_API_KEY` egzistavimas patvirtintas neatskleidžiant reikšmės; modelis `gemini-3.5-flash-lite`, limitai 10 per dieną ir 100 per mėnesį;
- Production veikia `controlled_pilot`, aktyvi banga `PROD-8.0`, `AUTOMATION_EMERGENCY_PAUSE=true`;
- Production įrašyti tikri `STAGING_QA_REFERENCE`, `RESTORE_TEST_REFERENCE` ir `PRODUCTION_OWNER_APPROVAL_REFERENCE` identifikatoriai;
- po deploy visi 13 `FEATURE_*` flagų pakartotinai patvirtinti kaip `false`;
- Production smoke: `/no`, `/en`, `/no/blogg`, `/robots.txt`, `/sitemap.xml` = 200; apex = 308 į `www`; `/admin-v2` ir `/user` = saugus login redirect; `/meta.json` = 404;
- prisijungusio administratoriaus naršyklėje juosta rodo `PROD-8.0`, 0 aktyvių ir 13 išjungtų funkcijų bei pristabdytus automatinius siuntimus; Staging patikrintas ir 390×844 telefono vaizdas;
- po deploy Vercel 5xx patikros iškart ir po daugiau nei 5 minučių: 0;
- Production administratoriaus eilėse nėra naujų, aktyvių, įstrigusių ar dėmesio reikalaujančių bylų/darbų.

## 5. PROD-8.1 — vidinė bylų, AI ir matavimo banga

**Flagai**

- `FEATURE_CASE_STATE_ENGINE_V2=true`
- `FEATURE_ADMIN_EXCEPTION_FLOWS_V2=true`
- `FEATURE_AI_DRAFTS=true`
- `FEATURE_ROOF_MEASUREMENT=true`
- `FEATURE_MEASUREMENT_EVIDENCE_V2=true`

**Priklausomybės:** Gemini raktas, modelis ir limitai; Kartverket ir OSM pasiekiamumas; privatus Blob; patvirtintas savininko kontroliuojamas testinis adresas.

**Saugos patikslinimas prieš įjungimą:** šioje bangoje automatinis job gali sukurti tik AI juodraštį, stogo matavimą ir privatų matavimo įrodymą. Kainos taisyklė, kainos skaičiavimas, pasiūlymas ir sutartis nėra skaitomi ar kuriami, kol `FEATURE_CUSTOMER_QUOTES=false`. Kontroliuojamam matavimo pilotui pakanka `ROOF_TECHNICAL_QA_REFERENCE`; `ROOF_VALIDATION_REFERENCE` rezervuotas trims fiziniams palyginimams ir kartu su realių užklausų piloto įrodymu privalomas prieš `full_automation`.

### Veiksmai

1. Pakeisti tik šios bangos flagus ir atlikti Production redeploy.
2. Patikrinti platform health: penki flagai aktyvūs, jų integracijos paruoštos, visi kiti rizikingi flagai išjungti.
3. Pateikti vieną sintetinę užklausą su savininko el. paštu ir kontroliuojamu adresu.
4. Patikrinti, kad gavimo laiškas išsiųstas vieną kartą.
5. Patikrinti AI santrauką ir atsakymo juodraštį: statusas `draft`, norvegų kalba, nėra kainos, garantijos, išgalvotos datos ar automatinio siuntimo.
6. Administratoriaus aplinkoje pradėti matavimą, patikrinti adreso radimą, pastatų kandidatus, pasirinkto pastato schemą, stogo ploto intervalą, confidence ir šaltinio informaciją.
7. Patikrinti rankinį pastato pasirinkimą ir rankinį ploto override su privaloma priežastimi bei nauja versija.
8. Patikrinti, kad pakartotinis AI/job vykdymas nesukuria antro juodraščio ar matavimo tai pačiai idempotency reikšmei.
9. Patikrinti auditą, laiko juostą, 5xx ir operational jobs.

### PASS

- viena užklausa, vienas gavimo laiškas, vienas AI juodraštis;
- AI nieko neišsiuntė be administratoriaus;
- matavimo įrodymas aiškiai rodo adresą, pasirinktą pastatą ir skaičiavimo duomenis;
- override sukuria atsekamą naują versiją, neperrašo istorijos;
- nėra P0/P1, dublikatų, nesėkmingų jobų ar nepaaiškintų 5xx;
- byla archyvuota tik po įrodymų surinkimo.

### Rollback

Išjungti penkis šios bangos flagus, redeployinti paskutinę stabilią konfigūraciją ir sustabdyti tik `lead.ai.draft` tipo laukiančius darbus. Esami juodraščiai ir auditas išsaugomi.

### Vykdymo įrašas — 2026-08-27

**Dabartinė būsena: `PASS`.** PROD-8.1 užbaigtas; PROD-8.2 flagai neįjungti ir komercinis kelias nepradėtas.

- Aktyvus Production deployment: `dpl_8ff7pKTcjvbJ7hzkvG7cK87JvFYs` (`Ready`), commit `f80a8d9`; momentinis rollback deployment `dpl_6agTKhwKULtEFvoPQJh3Zd5CSRAD`.
- Įjungti tik penki šios bangos flagai: `FEATURE_CASE_STATE_ENGINE_V2`, `FEATURE_ADMIN_EXCEPTION_FLOWS_V2`, `FEATURE_AI_DRAFTS`, `FEATURE_ROOF_MEASUREMENT` ir `FEATURE_MEASUREMENT_EVIDENCE_V2`. Aštuoni vėlesnių bangų flagai liko `false`.
- Kontroliuojama sintetinė Production byla `#9`; naudotas tik savininko kontroliuojamas adresas ir el. paštas, be tikro kliento.
- Sukurtas vienas `receipt` ir išsiųstas vieną kartą. Sukurtas vienas norvegiškas `ai_reply` juodraštis; jis klientui nebuvo išsiųstas ir archyvuojant tapo `cancelled`.
- Matavimo istorija nekintama: `TM-9-V1` automatinė schema su privačiu įrodymu; `TM-9-V2` ir `TM-9-V3` administratoriaus pasirinkto pagrindinio pastato `way/132540663` versijos su atskirais privačiais įrodymais; `TM-9-V4` — administratoriaus rankinis `manual_no_visual` plotas 102,2 m² su privalomu šaltiniu ir priežastimi, būsena `approved`.
- Patvirtinta, kad nėra nė vieno kainos skaičiavimo, pasiūlymo, sutarties, darbo užsakymo ar pakeitimo susitarimo. Abu susiję operaciniai jobai (`message.delivery`, `lead.ai.draft`) yra `completed`; dublikatų nėra, abiejų žinučių idempotency raktai unikalūs.
- Pirmas administratoriaus matavimo veiksmas atskleidė kainodaros priklausomybės izoliavimo klaidą ir vieną paaiškintą `POST /api/admin/leads/9` 500. Vykdymas buvo sustabdytas; pataisa `f80a8d9` izoliuoja matavimo pilotą nuo išjungtos kainodaros. Po pataisos pastato pasirinkimo `POST /api/admin/measurements` grąžino 201, matavimas patvirtintas, o naujų funkcinių 5xx nenustatyta.
- Kokybės įrodymas prieš bangą ir pataisai: TypeScript, ESLint, 185 testų failai ir 594 testai PASS; Vercel Production build `Ready`. Windows ARM64 lokalaus build apribojimas susijęs tik su neegzistuojančiu pasirinktiniu `@libsql/win32-arm64-msvc` paketu ir neveikia Vercel/PostgreSQL Production.
- Byla `#9` archyvuota kaip `other`, būsena `closed`, kitas veiksmas išvalytas. Yra tiksliai vienas nekintamas `lead.archive` audito įrašas; byla neperkelta į šiukšlinę ir neištrinta.

## 6. PROD-8.2 — kontroliuojamas kliento komercinis kelias

**Flagai**

- `FEATURE_SECURITY_HARDENING_V2=true`
- `FEATURE_CUSTOMER_QUOTES=true`
- `FEATURE_CONTRACT_SIGNING=true`
- `FEATURE_CUSTOMER_LIFECYCLE_V2=true`

**Priklausomybės:** atskiras stiprus `CUSTOMER_TOKEN_SECRET`; Production Turnstile ir KV/Upstash; Resend; privatus Blob; savininko patvirtinta `PRODUCTION-PILOT-V1` sąlygų versija ir `LEGAL_REVIEW_REFERENCE`; patvirtintos kainų taisyklės.

### Veiksmai

1. Patikrinti paslaptis, domenus, Turnstile ir rate limit dar prieš flagų pakeitimą.
2. Įjungti tik šios bangos flagus ir atlikti redeploy.
3. Pateikti naują sintetinę bylą; patikrinti automatinį matavimo, kainos, pasiūlymo ir sutarties juodraščių paketą.
4. Administratoriui patikrinti/override plotą, m² kainą, nuolaidą, papildomą paslaugą ir pasirinktinį avansą.
5. Patikrinti PVM, maksimalią sumą, avanso terminą ir sutarties sąlygų versiją.
6. Patvirtinti ir siųsti pasiūlymą tik savininko kontroliuojamu adresu.
7. Patikrinti saugią nuorodą, PDF firminį šabloną, matavimo vizualą, dokumento versiją bei hash.
8. Patikrinti neteisingą, pakeistą, pasibaigusį ir atšauktą tokeną; kitos bylos duomenys negali būti matomi.
9. Klientui priimti pasiūlymą ir pasirašyti; administratoriui pasirašyti tą pačią versiją; patikrinti vieną galutinį PDF su abiem parašais jų vietose ir datomis.
10. Patikrinti klausimo, atsisakymo ir sutarties nutraukimo kelius, įskaitant privalomą priežasties pasirinkimą, išsaugojimo klasifikaciją ir administratoriaus sprendimą.

### PASS

- suma, PVM, maksimali suma, avansas ir paslaugos sutampa UI, PDF, sutartyje ir DB;
- pasiūlymo/sutarties versija bei hash nesikeičia tarp peržiūros ir parašo;
- klientas bei įmonė pasirašo tą patį dokumentą, kopija pristatoma vieną kartą;
- jokio komercinio siuntimo be administratoriaus patvirtinimo;
- autorizacijos ir tokenų neigiami testai PASS;
- visi dokumentai matomi kliento byloje ir Dokumentų skiltyje;
- nėra P0/P1, dublikatų ar nepaaiškintų 5xx.

### Rollback

Išjungti keturis šios bangos flagus ir redeployinti. Jau pasirašyti dokumentai neištrinami ir nekeičiami; nauji klientų veiksmai sustabdomi aiškiu saugiu pranešimu.

## 7. PROD-8.3 — darbo užsakymo ir darbuotojo banga

**Flagai**

- `FEATURE_WORKER_PORTAL=true`
- `FEATURE_COMMUNICATION_ROUTING_V2=true`

**Priklausomybės:** aktyvi testinė darbuotojo paskyra; Resend; `CRON_SECRET` ir jobs health; darbuotojo kontaktai; savininko el. paštas testiniam klientui; patikrintas centrinis automatinių operacinių siuntimų pristabdymas.

### Veiksmai

1. Patikrinti, kad vienas centrinis veiksmas sustabdo naujus automatinius operacinius siuntimus, bet nestabdo lead gavimo; tada įjungti tik šios bangos flagus ir atlikti redeploy.
2. Iš pasirašytos sintetinės sutarties sukurti vieną darbo užsakymą.
3. Priskirti darbuotoją, pasirenkant datą ir atvykimo intervalą; patikrinti išsaugojimą po puslapio perkrovimo.
4. Patikrinti kliento priskyrimo laišką su darbuotojo vardu, kontaktais, data ir intervalu.
5. Darbuotojui telefone patikrinti tik jam priskirtą darbą ir uždrausti kitos bylos prieigą.
6. Pereiti būsenas: priskirtas → suplanuotas → vyksta → atvyko → patikra/matavimas → darbai pradėti → užbaigta.
7. Patikrinti kliento komunikaciją kiekviename numatytame taške, ETA ir dublikatų nebuvimą.
8. Patikrinti galutinį matavimą, tolerancijos ribą, pakeitimo susitarimą, kliento parašą ir administratoriaus užbaigimo peržiūrą.
9. Patikrinti užbaigimo dokumentus, garantijos informaciją, laiko juostą ir audito įrašus.

### PASS

- darbuotojo paskyrimas išlieka ir darbuotojas mato tik savo darbus;
- datos bei intervalai pasirenkami valdikliais ir rodomi Europe/Oslo laiku;
- kiekviena suplanuota kliento žinutė sukurta ir pristatyta tik vieną kartą;
- statusai juda tik leistina seka, o pakartotinis paspaudimas nėra žalingas;
- pakeitimo susitarimas ir užbaigimo dokumentai susieti su ta pačia byla;
- nėra P0/P1, autorizacijos pažeidimų, dublikatų ar nepaaiškintų 5xx.

### Rollback

Išjungti du šios bangos flagus, redeployinti ir sustabdyti laukiančius `work-order.communication` darbus. Jau atlikti statusai ir dokumentai išsaugomi administratoriaus peržiūrai.

## 8. PROD-8.4 — priminimų ir tinklaraščio automatika

**Flagai**

- `FEATURE_AUTOMATED_REMINDERS=true`
- `FEATURE_SEO_SCHEDULER=true`

**Priklausomybės:** `CRON_SECRET`; Gemini ir limitai; Pexels raktas stock nuotraukoms; Resend; patvirtintas priminimų tekstas; cron/job stebėjimas; patikrintas centrinis automatinių siuntimų pristabdymas. Automatinis tinklaraščio publikavimas neegzistuoja arba lieka aiškiai išjungtas.

### Veiksmai

1. Patikrinti cron autentifikaciją ir jobs health, tada įjungti tik šios bangos flagus.
2. Tą patį cron veiksmą testinėje būsenoje iškviesti du kartus; antras vykdymas negali sukurti dublių.
3. Patikrinti neteisingą arba trūkstamą cron paslaptį — užklausa privalo būti atmesta.
4. Patikrinti priminimų laikus Europe/Oslo zonoje, būsenos pasikeitimo atšaukimą ir jau išsiųstos žinutės nebekartojimą.
5. Mokėjimo priminimas rengiamas tik po administratoriaus banko patikros; administratorius atskirai patvirtina siuntimą.
6. Sugeneruoti vieną SEO straipsnio juodraštį su norvegišku tekstu, šaltinių/temos metaduomenimis ir licencijuota stock nuotrauka.
7. Patikrinti nuotraukos pakeitimą, SEO laukus, peržiūrą ir rankinį publikavimą. AI pats nepublikuoja.
8. Patikrinti dienos/mėnesio Gemini limitus, job retry, klaidų sanitarizavimą ir administratoriaus perspėjimus.

### PASS

- dvigubas cron vykdymas nesukuria dublikatų;
- priminimai nevykdomi po būsenos pasikeitimo ir nėra siunčiami be privalomo admin patvirtinimo;
- tinklaraščio turinys lieka juodraščiu iki administratoriaus veiksmo;
- Gemini/Pexels limitai ir klaidos matomi be paslapčių atskleidimo;
- nėra P0/P1, dublikatų ar nepaaiškintų 5xx.

### Rollback

Išjungti du šios bangos flagus, redeployinti, sustabdyti jų laukiančius cron/job įrašus ir palikti sukurtus juodraščius administratoriaus peržiūrai.

## 9. PROD-8.5 — kontroliuojamas realių bylų pilotas

**Tikslas:** po keturių bangų PASS leisti sistemą naudoti realioms byloms su privaloma žmogaus kontrole ir surinkti pakankamai įrodymų pilnam automatikos sprendimui.

### Privaloma imtis

- 20–30 unikalių realių užklausų;
- bent 3 reprezentatyvūs stogai su fiziniu kontroliniu matavimu;
- skirtingos paslaugos, adresas rastas/nerastas, rankinis plotas, klausimas, atsisakymas, pasiūlymo pakeitimas, pasirašymas ir darbuotojo eiga;
- kiekvieną tekstą, kainą, pasiūlymą ir sutartį prieš išsiunčiant patvirtina administratorius.

### Matuojami rodikliai

- gavimo laiško ir AI juodraščio parengimo laikas;
- automatiškai rastų adresų/pastatų dalis;
- matavimo absoliuti ir procentinė paklaida;
- administratoriaus korekcijų dažnis;
- pasiūlymo parengimo bei patvirtinimo laikas;
- laiškų pristatymas, dublikatai, retry ir klaidos;
- klientų klausimai, atsisakymai ir konversijos;
- Gemini/Pexels/Resend naudojimas bei limitai.

### PASS

- užpildytas ir pasirašytas `f10-pilot-evidence-template.md` registras;
- nėra neišspręsto P0/P1 ar duomenų vientisumo incidento;
- trys fiziniai matavimai yra priimtinos iš anksto nustatytos tolerancijos ribose arba taisyklė pakoreguota ir pakartotinai patikrinta;
- `LEAD_INBOX_PILOT_REFERENCE` nustatomas tik į tikrą užbaigtos ataskaitos identifikatorių;
- savininkas atskirai patvirtina arba atmeta `GO_FULL_AUTOMATION`.

Iki šio `PASS` Production būsena vadinama **kontroliuojamu pilotu**, ne pilna automatika.

## 10. Bendros STOP ir incidento ribos

Nedelsiant stabdoma konkreti banga, jeigu:

- klientui be administratoriaus išsiunčiama kaina, pasiūlymas, sutartis ar priminimas;
- dubliuojasi el. laiškas, dokumentas, parašas, job arba darbo būsena;
- nesutampa UI, DB ir PDF kaina, PVM, maksimali suma, avansas, versija arba hash;
- vienas klientas ar darbuotojas gali matyti kitos bylos duomenis;
- parašas pridedamas ne tai dokumento versijai;
- klaidingas matavimo pastatas automatiškai patvirtinamas be administratoriaus galimybės jį pakeisti;
- užklausa prarandama, būsena grįžta atgal arba audito pėdsakas nutrūksta;
- atsiranda nekontroliuojami 5xx, neišvalyta paslaptis loguose arba tiekėjo incidentas.

Po STOP:

1. nebetęsti testinės bylos;
2. išjungti tik tos bangos flagus;
3. redeployinti ir patikrinti bazinius URL, lead priėmimą bei admin login;
4. sustabdyti tik susijusius pending/retry jobus;
5. išsaugoti incidento correlation ID, dokumentų ID ir auditą;
6. pataisyti bei pilnai pakartoti tą pačią bangą; pereiti toliau draudžiama.

## 11. Vykdymo registras

| Etapas                                 | Būsena  | Deployment / commit                                                                                         | Įrodymai                                                                                                             | Patvirtino                     | Laikas                       |
| -------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------- |
| PROD-8.0 Preflight                     | PASS    | Production `dpl_CWjdo63P3zdBmvFymZ3RwDnkmPXu`; Preview `dpl_Ep3DEjGjPyWiAxqDuYCWpFLCwoXQ`; commit `6007e79` | DB kopija, rollback, Gemini ir limitai, 584 testai, Preview/Production smoke, admin juosta, 0×5xx, 13/13 flagų false | Savininkas ir techninė patikra | 2026-08-27 12:59 Europe/Oslo |
| PROD-8.1 Vidinė AI ir matavimo banga   | PASS    | Production `dpl_8ff7pKTcjvbJ7hzkvG7cK87JvFYs`; rollback `dpl_6agTKhwKULtEFvoPQJh3Zd5CSRAD`; commit `f80a8d9` | Byla `#9`, 1× receipt sent, 1× AI draft cancelled archyvuojant, `TM-9-V1`–`V4`, 102,2 m² manual approval, 0 komercinių dokumentų, 2× completed jobs, 1× `lead.archive`, 594 testai PASS | Savininkas ir techninė patikra | 2026-08-27 14:29 Europe/Oslo |
| PROD-8.2 Kliento komercinis kelias     | VERIFYING | Production byla `#10`; [faktinės būsenos auditas](./prod8-current-state-audit-2026-08-28.md) | Pagrindinis pasiūlymo ir dviejų parašų kelias įrodytas; liko klausimo, atmetimo, nutraukimo, gyvo neigiamo tokeno ir `mark_reviewed` UAT | Savininkas ir techninė patikra | 2026-08-28 |
| PROD-8.3 Darbo ir darbuotojo banga     | VERIFYING | Production byla `#10`; [faktinės būsenos auditas](./prod8-current-state-audit-2026-08-28.md) | Darbo sukūrimas, paskyrimas ir baziniai laiškai įrodyti; pilna darbuotojo būsenų, ETA, tolerancijos ir užbaigimo eiga dar nebaigta | Savininkas ir techninė patikra | 2026-08-28 |
| PROD-8.4 Priminimų ir blogo automatika | PRECHECK | [Faktinės būsenos auditas](./prod8-current-state-audit-2026-08-28.md) | Turnstile, Upstash, Gemini ir Resend paruošti; Production `CRON_SECRET`, `PEXELS_API_KEY` ir kontroliuojamas UAT dar neuždaryti | Techninė patikra | 2026-08-28 |
| PROD-8.5 Realių bylų pilotas           | PENDING |                                                                                                             |                                                                                                                      |                                |                              |

## 12. Galutinė PROD-8 užbaigimo sąlyga

PROD-8 galima pažymėti `PASS` tik kai:

- PROD-8.0–PROD-8.4 yra `PASS`;
- visi aktyvūs flagai turi paruoštas Production priklausomybes;
- keturi sintetiniai keliai neturi dublikatų, P0/P1 ar autorizacijos problemų;
- klientų komercinius veiksmus iki realaus piloto pabaigos kontroliuoja administratorius;
- pradėtas PROD-8.5 realių bylų pilotas ir jo ribos aiškiai rodomos administratoriui;
- pagrindinio cutover plano PROD-8 eilutė atnaujinta tikrais įrodymais.

`GO_FULL_AUTOMATION` nėra automatinė PROD-8 išvada. Jis yra atskiras savininko sprendimas po PROD-8.5 `PASS`.
