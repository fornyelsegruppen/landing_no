# Takfornyelse — Production cutover vykdymo planas

Data: 2026-08-27  
Būsena: **VYKDOMA — PROD-0–PROD-8.1 PASS; PROD-8.2 nepradėtas**
Tikslas: saugiai perkelti patvirtintą `takfornyelse.as` platformos versiją iš izoliuotos Preview aplinkos į Production, išsaugant dabartinės svetainės veikimą, duomenis ir patikimą rollback kelią.

## 1. Nekeičiama vykdymo taisyklė

Fazės vykdomos tik eilės tvarka. Nauja fazė nepradedama, kol ankstesnė neturi:

1. užbaigtų visų veiksmų;
2. faktinio patikros įrodymo;
3. įrašyto `PASS` rezultato;
4. atsakingo asmens ir laiko žymos;
5. uždarytų P0/P1 defektų.

Jeigu fazė nepasiekia savo PASS kriterijaus, jos rezultatas žymimas `STOP`. Trūkumas taisomas ir ta pati fazė kartojama. Produkcijos deploy, domeno perjungimas arba rizikingų funkcijų įjungimas negali būti naudojami kaip būdas patikrinti dar nepatikrintą prielaidą.

## 2. Patvirtinta pradinė būsena

### Patvirtintas release kandidatas

- šaka: `codex/master-platform-implementation`;
- galutinis release commit: `bf2e21aca0b95ba4ca40009dd87554207482f4a4`;
- galutinis release tag: `production-rc-2026-08-27`;
- Production kopijos repeticijoje rastų P1 suderinamumo pataisų commit: `7b6b5a7997c6512255d4717692cadb6b7cb2630e`;
- galutinis cutover RC tagas sukurtas tik po šių pataisų, pakartotinio CI ir šviežios Neon kopijos PASS;
- stabili Preview patikra: deployment `dpl_2aKDKXpgUZMB58MRTz89ok7wUSrw`;
- staging priėmimas: savininko patvirtintas `Staging GO`;
- viešo blogo B0–B6 fazės: PASS;
- paskutinė registruota automatinė patikra: 537 vienetiniai/API testai, 34 migracijų testai, TypeScript, ESLint, production build ir naršyklės smoke scenarijai — PASS.

### Prieš cutover buvusi Production ir rollback

- prieš cutover buvęs Production commit: `380f64d2d7092cfb0bdf7f681ad6afebe30030c1`;
- Git rollback tag: `backup-live-before-master-2026-08-23`;
- prieš cutover buvęs Production deployment: `dpl_8MqTs2mWsijDYvi1AAWqz46VvDWh`;
- deployment URL: `landing-p0tcgf4i3-darbasnorvegija4-8212s-projects.vercel.app`;
- vieši aliasai: `www.takfornyelse.as`, `takfornyelse.as`, `landing-no.vercel.app`.

### Production DB identifikavimas

- Neon paskyra: `darbas.norvegija4@gmail.com`;
- projektas: `landing_no`;
- projekto ID: `square-star-31002403`;
- regionas: AWS Europe Central 1 (Frankfurt);
- pagrindinė šaka: `production`;
- duomenų bazė: `neondb`;
- vizualiai patikrintos svetainės lentelės: `leads`, `media`, `pages`, `faq`, `payload_kv`, versijuotos `services`, `projects`, `site_settings` ir susijusios lentelės;
- išvada: tai dabartinės `landing_no` / `takfornyelse.as` Production svetainės duomenų bazė.

„Vercel“ `DATABASE_URL` yra `Secret`, todėl sena reikšmė redagavimo lange nerodoma ir negali būti naudojama vizualiam palyginimui. Jos negalima perrašyti vien bandant ją perskaityti.

## 3. Komandinio darbo protokolas

- Asistentas atlieka kodo, migracijų, testų, infrastruktūros būsenos, logų, smoke rezultatų ir dokumentacijos patikrą.
- Savininkas atlieka prisijungimus, 2FA, CAPTCHA, slaptų raktų sukūrimą arba įvedimą ir veiksmo momento patvirtinimus.
- Slaptažodžiai, OTP, API raktai, pilni DB URL ir klientų duomenys nesiunčiami pokalbyje ir nerašomi į Git.
- Kai reikalingas savininko veiksmas, pateikiama tiksli nuoroda ir trumpi žingsniai. Savininkas atsako `atlikta`, `prisijungta` arba konkrečiu prašomu rezultatu.
- Produkcijos deploy, domeno aliaso pakeitimas, realaus laiško siuntimas, feature flag įjungimas, DB restore/perjungimas ir negrįžtamas trynimas turi atskirą veiksmo momento patvirtinimą.
- Kiekvienos fazės įrodymas įrašomas šio dokumento vykdymo registre.

## 4. Fazių planas

### PROD-0 — release freeze ir atsekamumas

**Tikslas**

Užfiksuoti vieną nekintamą release kandidatą ir vieną patikrintą dabartinės Production versijos rollback tašką.

**Veiksmai**

1. Patikrinti, kad release tag rodo tikslų patvirtintą commitą.
2. Patikrinti šakos būseną ir atskirti naudotojo nesusijusius neįtrauktus failus.
3. Užregistruoti dabartinį Production deployment, commitą, aliasus ir laiką.
4. Patikrinti, kad ankstesnį deployment galima pasirinkti Vercel rollback veiksmui.
5. Nuo šio momento neįtraukti naujo funkcionalumo į release kandidatą; leidžiami tik P0/P1 cutover pataisymai su pakartotiniu pilnu testu.

**PASS įrodymas**

- release commit/tag ir rollback commit/tag sutampa su 2 skyriumi;
- Git būsenoje nėra nepaaiškintų release pakeitimų;
- dabartinis Production deployment Vercel matomas ir pasiekiamas;
- įrašyta tikrinimo data ir atsakingas asmuo.

**STOP**

- tagas ir testuotas commitas nesutampa;
- nėra pasiekiamo ankstesnio Production deployment;
- release šakoje yra neperžiūrėtų pakeitimų.

### PROD-1 — Production DB snapshot ir inventorius

**Tikslas**

Sukurti šviežią, nuo Production atskirtą DB kopiją ir užregistruoti duomenų bazės bei privačių failų būseną prieš migracijas.

**Veiksmai**

1. Neon projekte `landing_no` iš `production` šakos sukurti point-in-time šaką `backup-before-production-2026-08-27`.
2. Užregistruoti snapshot/branch ID, sukūrimo laiką, šaltinio šaką, savininką ir planuojamą saugojimo terminą.
3. Pagrindinėje ir backup šakoje palyginti ne slaptus lentelių bei eilučių skaičius.
4. Registruoti pagrindinių ryšių kontrolę: naudotojai, užklausos, viešas turinys, dokumentų/metaduomenų lentelės ir migracijų istorija, jei lentelės jau egzistuoja.
5. Vercel Blob aplinkoje sukurti privatų inventorių: failo kelias/ID, dydis, sukūrimo laikas ir bendras objektų skaičius. Failų turinys nekopijuojamas į Git.
6. Patikrinti, kad backup šaka ir Blob inventorius pasiekiami tik įgaliotoms paskyroms.

**PASS įrodymas**

- egzistuoja šviežia Neon backup šaka su ID ir laiko žyma;
- pradinių lentelių/eilučių skaičiai užregistruoti ir sutampa tarp šaltinio bei kopijos;
- pagrindiniai ryšiai neprarasti;
- privataus Blob inventoriaus objektų skaičius ir bendras dydis užregistruoti;
- joks slaptas URL arba kliento failas nepateko į dokumentaciją.

**STOP**

- nepavyksta sukurti ar atidaryti backup šakos;
- skiriasi eilučių skaičiai be paaiškinimo;
- nežinomas Production Blob šaltinis arba nėra inventoriaus;
- neaiški backup prieigos kontrolė.

### PROD-2 — izoliuotas restore ir aplikacijos smoke

**Tikslas**

Įrodyti ne tik backup egzistavimą, bet ir tai, kad patvirtintas release kandidatas gali saugiai paleisti migracijas ir veikti su izoliuota Production kopija.

**Veiksmai**

1. Naudoti PROD-1 backup šaką kaip izoliuotą restore/kopijos aplinką; Production šaka neliečiama.
2. Sukurti laikiną tik šiai patikrai skirtą Preview aplinkos DB jungtį, neatskleidžiant URL pokalbyje ar Git.
3. Išjungti realių laiškų, automatinių publikacijų, SMS ir realių klientų veiksmų siuntimą.
4. Paleisti migracijų statusą ir visas laukiančias addityvias migracijas tik kopijoje.
5. Paleisti release build ir aplikaciją prieš kopiją.
6. Patikrinti viešą puslapį, `/admin`, `/admin-v2`, `/user`, blogą, formos atvaizdavimą ir autorizuotą/uždraustą privataus failo prieigą.
7. Po migracijų dar kartą palyginti pradinius eilučių skaičius ir pagrindinius ryšius.
8. Užregistruoti visus sukurtus naujus nullable laukus/lenteles ir įsitikinti, kad senas turinys neprarastas.

**PASS įrodymas**

- aplikacija su backup kopija sėkmingai pasileidžia;
- migracijos baigiasi be klaidos ir nėra destruktyvaus duomenų praradimo;
- prieš/po skaičiai ir ryšiai sutampa pagal numatytą migracijų poveikį;
- pagrindiniai vieši ir autentifikuoti keliai grąžina teisingą rezultatą;
- neautorizuota privataus turinio prieiga atmetama;
- realus klientas negauna jokio bandymo laiško.

**STOP**

- aplikacija nepasileidžia su kopija;
- migracija trina arba netikėtai keičia senus duomenis;
- privatūs failai atsidaro be autorizacijos;
- testas gali siųsti realius Production laiškus.

### PROD-3 — Production secrets ir saugūs feature flags

**Tikslas**

Paruošti Production skirtas paslaptis ir saugų pradinį funkcijų rinkinį, neperrašant veikiančių Production kintamųjų spėjimais.

**Jau rasti Production kintamieji**

- `DATABASE_URL`;
- `PAYLOAD_SECRET`;
- `BLOB_READ_WRITE_TOKEN`;
- `RESEND_API_KEY`;
- `LEAD_FROM_EMAIL`;
- `LEAD_TO_EMAIL`;
- `NEXT_PUBLIC_SITE_URL`.

Papildomai rasti viešos analitikos kintamieji: `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL`, `NEXT_PUBLIC_META_PIXEL_ID`.

**Reikia patikrinti arba pridėti**

- `GEMINI_API_KEY`;
- `PEXELS_API_KEY`;
- `CRON_SECRET`;
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`;
- `TURNSTILE_SECRET_KEY`;
- `KV_REST_API_URL`;
- `KV_REST_API_TOKEN`;
- `KV_REST_API_READ_ONLY_TOKEN`;
- visus `FEATURE_*` flagus su aiškiai dokumentuota pradine reikšme.

**Patvirtinta saugi pirmo deploy būsena**

- visi žemiau išvardyti flagai pirmajam Production deploy turi būti aiškiai nustatyti į `false` (ne vien palikti numatytai išjungti):
  - `FEATURE_AI_DRAFTS`;
  - `FEATURE_ROOF_MEASUREMENT`;
  - `FEATURE_CUSTOMER_QUOTES`;
  - `FEATURE_CONTRACT_SIGNING`;
  - `FEATURE_WORKER_PORTAL`;
  - `FEATURE_AUTOMATED_REMINDERS`;
  - `FEATURE_SEO_SCHEDULER`;
  - `FEATURE_CASE_STATE_ENGINE_V2`;
  - `FEATURE_MEASUREMENT_EVIDENCE_V2`;
  - `FEATURE_ADMIN_EXCEPTION_FLOWS_V2`;
  - `FEATURE_COMMUNICATION_ROUTING_V2`;
  - `FEATURE_CUSTOMER_LIFECYCLE_V2`;
  - `FEATURE_SECURITY_HARDENING_V2`;
- `ALLOW_PREVIEW_EMAIL_LOG=false` ir `SMS_PROVIDER=disabled`;
- `EMAIL_ASSET_BASE_URL=https://www.takfornyelse.as`;
- viešas blogas ir esamas lead priėmimas nėra slepiami šiais naujos automatikos flagais;
- kiekvienas flagas vėliau jungiamas atskiru PROD-8 mini-gate, tik kai jo priklausomybės ir įrodymai yra Production aplinkoje.

**Privalomos Production paslaptys prieš atitinkamų funkcijų įjungimą**

| Funkcija | Privaloma prieš `true` | Pradinė būsena |
|---|---|---|
| AI juodraščiai / SEO | `GEMINI_API_KEY`, `GEMINI_MODEL`, dienos ir mėnesio limitai | išjungta |
| Stock nuotraukos | `PEXELS_API_KEY` | išjungta kartu su AI |
| Cron / priminimai | `CRON_SECRET` | išjungta |
| Kliento saugios nuorodos / parašai | atskiras `CUSTOMER_TOKEN_SECRET` (nenaudoti spėjamos reikšmės) | išjungta |
| Bot apsauga | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | security hardening išjungtas |
| Rate limit | `KV_REST_API_URL` + `KV_REST_API_TOKEN` arba atitinkami Upstash kintamieji | security hardening išjungtas |
| Sutartys | `LEGAL_REVIEW_REFERENCE` su savininko patvirtinta sąlygų versija | išjungta |
| Ortofoto, jei vėliau aktyvuojama | `NORGE_I_BILDER_TOKEN`, `MAP_TERMS_ACCEPTED_AT` | neprivaloma baziniam scheminiam matavimo įrodymui |

Feature įrodymų kintamieji į Production keliami tik kartu su konkretaus mini-gate PASS. Bendri įrodymai: `STAGING_QA_REFERENCE`, `RESTORE_TEST_REFERENCE`, `LEAD_INBOX_PILOT_REFERENCE`, `PRODUCTION_OWNER_APPROVAL_REFERENCE`. Jų reikšmės yra versijuoti patikros identifikatoriai, ne slapti raktai.

**Veiksmai**

1. Nekeisti esamų `DATABASE_URL`, `PAYLOAD_SECRET`, Blob ir Resend reikšmių vien tam, kad jas būtų galima perskaityti.
2. Patikrinti siuntėjo domeną ir `post@takfornyelse.as` Production siuntimą.
3. Paruošti Production Turnstile, Upstash/KV, Gemini, Pexels ir cron paslaptis arba aiškiai išjungti nuo jų priklausančias funkcijas iki rakto patvirtinimo.
4. Visus komercinius, AI, darbuotojo, automatinio priminimo ir SEO scheduler flagus pirmam deploy nustatyti saugia pradine būsena.
5. Patikrinti, kad Preview ir Production DB, Payload, Resend, Turnstile bei KV reikšmės nėra sumaišytos.
6. Paleisti tik pavadinimų/aplinkų auditą, niekur neišvedant paslapčių reikšmių.

**PASS įrodymas**

- nėra trūkstamos privalomos paslapties aktyviai funkcijai;
- visi rizikingi flagai turi aiškią pradinę `false` arba patvirtintą `true` reikšmę;
- Production ir Preview infrastruktūra atskirta;
- `NEXT_PUBLIC_SITE_URL` rodo viešą Production domeną;
- Production laiškų siuntėjas patvirtintas;
- paslapčių auditavimo išvestyje nėra jų reikšmių.

**STOP**

- aktyvi funkcija neturi privalomos paslapties;
- neaišku, ar rakto reikšmė priklauso Preview ar Production;
- būtina perrašyti veikiantį Secret spėjama reikšme;
- Production forma neturi patvirtintos apsaugos nuo piktnaudžiavimo.

### PROD-4 — galutinis pre-deploy quality gate

**Tikslas**

Pakartotinai įrodyti, kad deployinamas būtent tas commitas, kuris praėjo visus testus ir restore patikrą.

**Veiksmai**

1. Paleisti TypeScript, ESLint, vienetinius testus, migracijų testus ir production build.
2. Paleisti GitHub Quality gate patvirtintam release commitui.
3. Patikrinti, kad nėra necommitintų release failų.
4. Patikrinti sitemap, robots, locale maršrutus, blogo canonical/JSON-LD ir pagrindinius admin API kontraktus.
5. Peržiūrėti atvirus P0/P1 defektus ir įsitikinti, kad jų nėra.

**PASS įrodymas**

- visi vietiniai ir CI testai PASS;
- CI commit SHA sutampa su deployinamu SHA;
- nėra P0/P1;
- release artefaktas nekito po testų.

**STOP**

- bent vienas privalomas testas FAIL;
- CI testavo kitą commitą;
- yra neperžiūrėtas P0/P1 arba necommitintas release pakeitimas.

### PROD-5 — kontroliuojamas Production deploy

**Tikslas**

Deployinti patvirtintą release kandidatą neįjungiant dar nepatikrintos automatikos ir išsaugant momentinį rollback kelią.

**Veiksmai**

1. Prieš deploy dar kartą užregistruoti ankstesnį deployment ID ir Production DB backup ID.
2. Gauti atskirą savininko veiksmo momento patvirtinimą.
3. Deployinti tik patvirtintą release SHA.
4. Stebėti build/migracijų logus ir sustabdyti veiksmus radus nepaaiškintą klaidą.
5. Patikrinti, kad `takfornyelse.as` ir `www.takfornyelse.as` rodo naują deployment, o staging aliasas liko Preview aplinkoje.
6. Neįjungti papildomų feature flagų šioje fazėje.

**PASS įrodymas**

- Production deployment yra `Ready`;
- deployment SHA sutampa su patvirtintu release SHA;
- domenų aliasai rodo teisingą deployment;
- migracijų loguose nėra klaidos;
- ankstesnis deployment ir rollback instrukcija tebėra pasiekiami.

**STOP / rollback**

- build ar migracija nepavyksta;
- domenas rodo neteisingą deployment;
- vieša svetainė nepasiekiama;
- aptinkamas P0/P1 — stabdyti feature flags ir nedelsiant grąžinti ankstesnį deployment.

### PROD-6 — Production smoke prieš funkcijų įjungimą

**Tikslas**

Patikrinti naują Production aplikaciją su saugiai išjungtomis rizikingomis funkcijomis.

**Veiksmai**

1. Patikrinti `/`, `/no`, `/en`, paslaugas, kontaktus, privatumo ir sutarties puslapius.
2. Patikrinti desktop ir mobilų meniu, telefono/el. pašto nuorodas ir pagrindinį CTA.
3. Patikrinti `/no/blogg`, vieną publikuotą straipsnį, sitemap, canonical ir JSON-LD.
4. Patikrinti `/admin`, `/admin-v2` ir `/user` login puslapius bei rolėmis apribotą prieigą.
5. Patikrinti `/api/admin/platform-health`, Vercel logus ir pagrindinius 4xx/5xx rodiklius.
6. Patikrinti, kad klientų tokenai ir privatūs failai nėra viešai pasiekiami.
7. Patikrinti, kad Production svetainėje nėra staging užrašų, sintetinių klientų ar testinių CTA.

**PASS įrodymas**

- visi kritiniai URL grąžina tikėtiną būseną;
- nėra nepaaiškintų 5xx;
- prisijungimo ir prieigos kontrolė veikia;
- viešas blogas bei SEO elementai veikia;
- privataus turinio anoniminė prieiga atmetama.

**STOP / rollback**

- neveikia vieša svetainė, admin login arba pagrindinė navigacija;
- matomas staging/testinis turinys;
- pažeista autorizacija arba privatūs failai;
- atsiranda nekontroliuojami 5xx.

### PROD-7 — kontroliuojama sintetinė Production užklausa

**Tikslas**

Patikrinti vieną pilną, savininko kontroliuojamą Production lead kelią be realaus kliento ir be nekontroliuojamos komercinės išvesties.

**Veiksmai**

1. Įjungti tik lead priėmimą ir gavimo patvirtinimą.
2. Naudoti aiškiai pažymėtą sintetinę užklausą ir savininko kontroliuojamą el. paštą.
3. Patikrinti: forma → DB byla → admin eilė → vienas gavimo laiškas → laiko juosta.
4. Patikrinti idempotency: pakartotinis veiksmas nesukuria dublikato.
5. Patikrinti, kad Gemini/matavimas/pasiūlymas lieka juodraščiu ir nieko komercinio neišsiunčia be admin patvirtinimo.
6. Patikrinti logus, audit event ir laiško pristatymo būseną.

**PASS įrodymas**

- sukurta viena byla ir vienas gavimo laiškas;
- nėra dublio, klaidingo gavėjo ar 5xx;
- komercinės išvestys lieka administratoriaus kontrolėje;
- testinė byla aiškiai pažymėta ir vėliau archyvuojama pagal taisykles.

**STOP / rollback**

- dublikatas, netinkamas gavėjas arba savavališkai išsiųsta kaina/sutartis;
- forma nepriima užklausos arba neužregistruoja jos admin;
- apsauga nuo piktnaudžiavimo neveikia.

### PROD-8 — laipsniškas funkcijų įjungimas

Detalus vykdymo, PASS/STOP ir rollback planas: [PROD-8 kontroliuojamo funkcijų įjungimo planas](./prod8-controlled-feature-activation-plan-2026-08-27.md).

**Tikslas**

Įjungti tik tas funkcijas, kurių Production priklausomybės ir konkretus kelias yra patikrinti.

**Privaloma seka**

1. Lead gavimas ir gavimo patvirtinimas.
2. AI santrauka bei matavimo/pasiūlymo juodraščiai su admin patvirtinimu.
3. Kliento pasiūlymo saugi nuoroda ir PDF.
4. Kliento ir įmonės parašai tai pačiai dokumento versijai.
5. Darbo užsakymas ir darbuotojo portalas.
6. Kontroliuojami operaciniai el. laiškai.
7. Blogo AI juodraščių generavimas; automatinis publikavimas lieka išjungtas.
8. Cron/reminders tik po atskiro idempotency ir pristatymo testo.

Kiekvienas punktas yra atskiras mini-gate: įjungiamas vienas flagas, atliekamas tikslinis smoke, patikrinami logai ir tik tada einama prie kito.

**PASS įrodymas**

- kiekvienas aktyvus flagas turi Production paslaptį ir sėkmingą tikslinį testą;
- joks komercinis tekstas, kaina ar sutartis neišsiunčiami be admin patvirtinimo;
- klientas, administratorius ir darbuotojas mato tik savo leistiną informaciją;
- blogo straipsnius publikuoja tik administratorius.

**STOP**

- aktyvuota funkcija neturi patikrintos priklausomybės;
- el. laiškas, dokumentas ar būsena dubliuojasi;
- skiriasi kaina, PVM, maksimali suma, dokumento versija ar hash;
- feature flag išjungiamas ir grįžtama į paskutinę stabilią mini-gate būseną.

### PROD-9 — savininko Production priėmimas

**Tikslas**

Savininkui pateikti vieną faktinį GO/NO-GO paketą ir užregistruoti sprendimą.

**Paketas**

- deploy SHA ir URL;
- backup šakos ID bei restore įrodymas;
- Blob inventoriaus santrauka;
- Production secrets/flags auditas be reikšmių;
- CI ir Production smoke rezultatai;
- sintetinės bylos ID ir komunikacijos rezultatas;
- atvirų P2/P3 trūkumų bei priimtų rizikų sąrašas;
- rollback deployment ir atsakingas asmuo.

**PASS**

- nėra P0/P1;
- PROD-0–PROD-8 PASS;
- savininkas raštu patvirtina `GO_CONTROLLED_PRODUCTION_PILOT`.

**Kiti galimi rezultatai**

- `GO_TECHNICAL_ONLY` — technika veikia, bet bent vienas verslo/infrastruktūros vartas neuždarytas; realūs klientai nejungiami;
- `NO-GO` — yra P0/P1 arba neįrodytas backup/restore/rollback.

### PROD-10 — 24 valandų stebėjimas ir tolesnis pilotas

**Tikslas**

Stabilizuoti Production po cutover ir neleisti vienam sėkmingam smoke būti palaikytam pilnos automatikos įrodymu.

**Veiksmai**

1. Pirmą valandą tikrinti kritinius logus po 5, 15, 30 ir 60 minučių.
2. Per pirmas 24 valandas tikrinti 5xx, el. pašto pristatymą, dublikatus, DB klaidas, autorizacijos incidentus ir cron veiksmus.
3. Pirmas 20–30 realių bylų palikti su privaloma administratoriaus peržiūra.
4. Bent 3 reprezentatyvius stogo matavimus palyginti su fizine kontrole.
5. Registruoti admin korekcijų dalį, matavimo paklaidą, pasiūlymo laiką ir konversijų eigą.
6. `GO_FULL_AUTOMATION` svarstyti tik atskiru sprendimu po piloto.

**PASS**

- per 24 valandas nėra P0/P1 ir nepaaiškintų kritinių klaidų;
- incidentų/rollback atsakingas žmogus pasiekiamas;
- pirmų realių bylų peržiūros procesas veikia;
- visi nukrypimai įrašyti į defektų registrą.

## 5. Prisijungimų ir savininko veiksmų planas

### Jau pasiekiama

- **Vercel** — prisijungta, projektas `landing-no` matomas;
- **Neon** — prisijungta, projektas `landing_no` ir šaka `production` patikrinti;
- **staging admin** — anksčiau patikrintas;
- **kontroliuojamas el. paštas** — savininkas gali patikrinti testinius laiškus.

### Labiausiai tikėtina, kad dar reikės

1. **Vercel** — Production env įvedimas, deploy ir galimas rollback; dabartinio prisijungimo turėtų pakakti.
2. **Neon** — backup šakos kūrimas ir restore/kopijos patikra; dabartinio prisijungimo turėtų pakakti.
3. **Cloudflare Turnstile** — tik jei Production raktų nėra; savininkui gali reikėti prisijungti ir sukurti Production site/secret raktus.
4. **Upstash / Vercel Marketplace** — KV/rate-limit Production resurso sukūrimui arba susiejimui; gali reikėti patvirtinti Vercel integracijos leidimą.
5. **Google AI Studio (Gemini)** — tik jei norime AI funkciją įjungti iškart ir Production neturi rakto.
6. **Pexels** — tik jei norime Production blogo nuotraukų parinkimą įjungti iškart ir Production neturi rakto.
7. **Resend** — tik jei Production API rakto ar siuntėjo domeno patikra nepraeina; dabartinis raktas jau egzistuoja, todėl naujo kurti iš anksto nereikia.
8. **Production admin** — savininko prisijungimas smoke metu; slaptažodžio pokalbyje nesiunčiame.
9. **Gmail / post@takfornyelse.as gavimas** — kontroliuojamam testiniam laiškui patikrinti.

### Šiam cutover nereikia

- Fiken prisijungimo, nes pilotas nenaudoja Fiken API ir nesiunčia sintetinės sąskaitos kaip mokėjimo reikalavimo;
- Google Ads ar Meta prisijungimo, nes reklamos nustatymai nėra šio Production deploy dalis;
- DNS tiekėjo prisijungimo, jei esami Vercel domenų aliasai po deploy lieka teisingi.

## 6. Defektų ir sprendimų taisyklė

| Lygis | Pavyzdys | Veiksmas |
|---|---|---|
| P0 | duomenų nutekėjimas, netinkamas gavėjas, nekontroliuojama finansinė išvestis | STOP, feature off, rollback, incidentas |
| P1 | klaidinga kaina/PVM/hash/parašas, neveikiantis kritinis kelias, neįrodytas restore | NO-GO iki pataisymo ir pilno pertestavimo |
| P2 | paini administravimo eiga arba netikslus statusas be duomenų rizikos | taisyti prieš susijusios funkcijos įjungimą arba aiškiai priimti ribotam pilotui |
| P3 | kosmetinis ar nekritinis tekstinis trūkumas | registruoti; gali būti pataisytas po kontroliuojamo GO |

## 7. Vykdymo registras

| Fazė | Būsena | Įrodymas | Patvirtino | Laikas |
|---|---|---|---|---|
| PROD-0 Release freeze | PASS | Galutinis release tag `production-rc-2026-08-27` → `bf2e21aca0b95ba4ca40009dd87554207482f4a4`; rollback tag `backup-live-before-master-2026-08-23` → `380f64d2d7092cfb0bdf7f681ad6afebe30030c1`; Vercel ankstesnis Production `dpl_8MqTs2mWsijDYvi1AAWqz46VvDWh` yra `Ready`, CLI rollback komanda patikrinta | Techninė patikra | 2026-08-27 08:31 EEST |
| PROD-1 DB snapshot ir Blob inventorius | PASS | Neon `backup-before-production-2026-08-27` (`br-nameless-bread-as1qukkv`) sukurta iš `production` (`br-tiny-sea-asltfa3n`) 2026-08-27 00:40 EEST, būsena `ready`, loginis dydis 36 134 912 B, galioja iki 2026-09-03 00:40 EEST. Papildomai iškart prieš deploy sukurta šviežia kopija `backup-immediate-predeploy-2026-08-27-0835` (`br-patient-moon-asfuv0vx`), parent LSN `0/10ABED30`, būsena `ready`, galioja iki 2026-09-03 08:40 EEST; Production ir kopijoje po 36 pradines lenteles / 210 eilučių, skirtumų 0. Production Blob `takfornyelse-production-private` (`store_FzFUn9vF8bJVXcDI`) aktyvus, `fra1`, 0 B / 0 failų; staging Blob atskiras | Techninė patikra | 2026-08-27 08:40 EEST |
| PROD-2 Izoliuotas restore | PASS | Iš nepakeistos `production` šakos `br-tiny-sea-asltfa3n` sukurta nauja trumpalaikė kopija `restore-final-production-2026-08-27` (`br-curly-bar-asjsrltd`, galioja iki 2026-08-29). Prieš migracijas: 36 bazinės lentelės ir 210 eilučių. Kopijoje be klaidų įvykdytos visos 38/38 dabartinio release migracijos; pakartotinai palyginus visas 36 pradines lenteles, skirtumų nėra. Patvirtinta nauja `_posts_v` versijų lentelė ir rollback suderinamumo `posts_v` view. Production DB nepakeista ir bandymo laiškai nesiųsti | Techninė patikra | 2026-08-27 08:07 EEST |
| PROD-3 Production secrets ir flags | PASS | Savininkui aiškiai patvirtinus, į Vercel Production įrašyta 16 saugių Config reikšmių: visi 13 `FEATURE_*` jungiklių nustatyti į `false`, `ALLOW_PREVIEW_EMAIL_LOG=false`, `SMS_PROVIDER=disabled`, `EMAIL_ASSET_BASE_URL=https://www.takfornyelse.as`. Pakartotinis vardų/aplinkų auditas: 16/16 rasta, visos taikomos tik Production. Esami `DATABASE_URL`, `PAYLOAD_SECRET`, Blob, Resend, siuntėjo ir svetainės URL kintamieji neperrašyti; nuo trūkstamų Gemini/Pexels, cron, Turnstile, KV ir kliento tokeno paslapčių priklausančios funkcijos aiškiai išjungtos. Production ir Preview DB bei Blob ištekliai atskirti | Savininkas ir techninė patikra | 2026-08-27 08:20 EEST |
| PROD-4 Quality gate | PASS | Galutinis RC SHA `bf2e21aca0b95ba4ca40009dd87554207482f4a4`: GitHub Quality gate run `33042242317` PASS per 4m56s — dependency audit, Payload tipų sync, lint, typecheck, 537/537 unit/API testai, 34/34 migracijų testai, tuščios PostgreSQL schemos bootstrap, production build su DB, vieši ir autentifikuoti Playwright testai bei sintetinė backup/restore repeticija. `npm audit --omit=dev`: 0 critical/high, 6 moderate transitive Payload/Drizzle `esbuild` dev-server įrašai be tiekėjo pataisos. Vercel Preview `dpl_2aKDKXpgUZMB58MRTz89ok7wUSrw` yra Ready; `/no`, `/en`, blogas, konkretus straipsnis, `robots.txt` ir `sitemap.xml` grąžina 200, admin/worker zonos nukreipia į login, privatūs admin API be sesijos grąžina 401 | Techninė patikra | 2026-08-27 08:31 EEST |
| PROD-5 Production deploy | PASS | Po savininko aiškaus veiksmo momento patvirtinimo deployintas tik galutinis RC `bf2e21aca0b95ba4ca40009dd87554207482f4a4`. Pirmas Vercel Production deployment `dpl_3ctaeH2yc3cBFsxvznMdrh3togs1` tapo `Ready`. Pataisius tik Production `LEAD_FROM_EMAIL` formatą ir perleidus tą patį patikrintą kodą su dokumentacijos commit `59dfc8f`, aktyvus deployment yra `dpl_DjHgvHsNKUSmNLGU6fvSRyomX8cS`; `www.takfornyelse.as`, `takfornyelse.as` ir `landing-no.vercel.app` priskirti naujam deployment. Build metu visos 38 migracijos baigėsi be klaidos. Visi 13 rizikingų `FEATURE_*` flagų liko `false`. Ankstesnis `dpl_8MqTs2mWsijDYvi1AAWqz46VvDWh` tebėra `Ready`; momentinis rollback: `vercel rollback dpl_8MqTs2mWsijDYvi1AAWqz46VvDWh --yes` | Savininkas ir techninė patikra | 2026-08-27 08:42–11:10 EEST |
| PROD-6 Bazinis Production smoke | PASS | Techninė dalis PASS: `/no`, `/en`, `/no/blogg`, `/robots.txt`, `/sitemap.xml`, `/admin` → 200; `/admin-v2` ir `/user` anoniminį vartotoją nukreipia į login; privatūs `/api/admin/platform-health` ir `/api/admin/blob` → 401; apex domenas → 308 į `www`. Puslapyje yra kaina, blogo nuoroda ir patvirtinti kontaktai; nėra staging/UAT teksto; bloge yra canonical ir JSON-LD. Production naršyklės smoke: 8/8 PASS, įskaitant 375×812 mobilų vaizdą, galerijos 4 nuotraukų seką, klaviatūros fokusą ir saugumo antraštes. Patikrinti visi 32 sitemap URL, nesėkmių 0. Per pirmą patikros langą neužregistruota nė vieno HTTP 500. Po deploy Production DB turi 72 bazines lenteles ir 38 migracijas; visų 35 prieš deploy egzistavusių verslo lentelių palyginimas su šviežia kopija — skirtumų 0. Sukurtas atskiras aktyvus Production administratorius, slaptažodžio nustatymo laiškas pristatytas, savininkas sėkmingai prisijungė. `/admin` techninė aplinka parodė administratoriaus resursus, o `/admin-v2` parodė lietuvišką „Apžvalga“ ir po savininko atlikto `Ctrl+R` išlaikė autentifikuotą sesiją. Reali ar sintetinė užklausa dar nesiųsta, automatikos flagai nepakeisti | Savininkas ir techninė patikra | 2026-08-27 11:10 EEST |
| PROD-7 Sintetinė Production užklausa | PASS | Pirmas aiškiai pažymėtas sintetinis pateikimas grąžino 500 ir buvo iškart sustabdytas: byla bei laiškas nesukurti. Priežastis buvo trūkstama `takvask_impregnering` enum reikšmė. Addityvi idempotentinė migracija patikrinta 4/4 tiksliniais, 38/38 visų migracijų ir 537/537 unit/API testais, typecheck, lint, dviem šviežiomis Production kopijomis ir Ready Preview deployment. Prieš Production P1 deploy sukurta kopija `backup-before-prod7-p1-2026-08-27` (`br-lucky-lake-ashj4ieo`); ankstesnis deployment `dpl_DjHgvHsNKUSmNLGU6fvSRyomX8cS`. Naujas Production deployment `dpl_DU2EPy99v6px53cQQfAqTYq3afHj` Ready, migracijos įrašas ir enum reikšmė Production DB yra po vieną, kritiniai URL grąžina 200. Vienintelis pakartotinis pateikimas sukūrė bylą `#8`: DB yra tik viena atitinkanti PROD-7 byla, tik viena `receipt` žinutė būsenoje `sent` su tiekėjo ID, o matavimų, pasiūlymų, sutarčių ir darbų yra 0. `/api/lead` grąžino 200 ir po šio veiksmo neturi 5xx. Savininkas patvirtino, kad firminis norvegiškas gavimo laiškas pristatytas ir byla `#8` matoma Production administravimo aplinkoje. Testinė byla perkelta į archyvą su klasifikacija `other`, aiškia PROD-7 priežastimi, administratoriaus ID ir nekintamu `lead.archive` audito įrašu; ji neperkelta į šiukšlinę | Savininkas ir techninė patikra | 2026-08-27 12:33 EEST |
| PROD-8 Laipsniškas funkcijų įjungimas | IN_PROGRESS — PROD-8.1 PASS | Production `dpl_8ff7pKTcjvbJ7hzkvG7cK87JvFYs`; rollback `dpl_6agTKhwKULtEFvoPQJh3Zd5CSRAD`; code `f80a8d9` | Penki PROD-8.1 flagai aktyvūs, aštuoni vėlesni flagai false. Sintetinė byla `#9`: 1 gavimo laiškas, 1 neišsiųstas AI juodraštis, matavimo versijos `TM-9-V1`–`V4`, patvirtintas rankinis 102,2 m² plotas, 0 kainų/pasiūlymų/sutarčių/darbų. Pradinis paaiškintas izoliavimo 500 pataisytas prieš tęsiant; po pataisos kelias PASS. Byla archyvuota su vienu `lead.archive`; 594 testai PASS. PROD-8.2 nepradėtas | Savininkas ir techninė patikra | 2026-08-27 14:29 Europe/Oslo |
| PROD-9 Savininko priėmimas | PENDING |  |  |  |
| PROD-10 24 h stebėjimas | PENDING |  |  |  |

## 7.1. Naktinio darbo perdavimo paketas

### Padaryta be savininko prisijungimų

1. Užfiksuotas release ir patikrintas momentinis Vercel rollback kelias.
2. Sukurta atskira Neon kopija ir prieš migracijas lineage pagrindu sutapatinti 36 lentelių / 210 eilučių skaičiai.
3. Inventorizuotas Production privatus Blob resursas; jis atskirtas nuo staging ir šiuo metu tuščias.
4. Tik izoliuotoje kopijoje paleistos visos migracijos; Production DB nepakeista.
5. Rastos ir regresiniais testais uždarytos dvi Production schemos suderinamumo P1 kliūtys.
6. Pridėtas suderinamumo view, kad kodo rollback atveju senas deployment vis dar galėtų pasiekti `posts_v`.
7. PASS: TypeScript, ESLint, 537 vienetiniai testai, 34 migracijų testai ir production build/route generavimas.
8. Atliktas tik Production Vercel kintamųjų **pavadinimų** auditas; reikšmės neišvestos ir Production niekas nepakeista.
9. Windows ARM64 kompiuterio neprieinamą `libsql` native paketą apeina oficialus Codex x64 Node runtime; papildomi native paketai įdiegti tik lokaliame `node_modules`. Tai nėra Production/Vercel apribojimas.
10. Naujausio galutinio SHA Preview `https://landing-6ikw81arw-darbasnorvegija4-8212s-projects.vercel.app` maršrutų smoke PASS: `/no`, `/en`, `/no/blogg`, konkretus straipsnis, `robots.txt` ir `sitemap.xml` grąžina 200; `/admin-v2` ir `/user` nukreipia į login; privatūs `/api/admin/platform-health` ir `/api/admin/blob` be sesijos grąžina 401.
11. Užfiksuotas ir ištaisytas Payload el. pašto perspėjimas: oficialus `@payloadcms/email-resend` 3.88.0 adapteris įjungiamas tik esant `RESEND_API_KEY`, todėl administratoriaus slaptažodžio atkūrimo laiškai nebelieka tik konsolėje.
12. `private-media` kolekcija paslėpta techniniame CMS ir jos tiesioginis create/update/delete užblokuotas. Privatūs dokumentai toliau kuriami tik serverio helperiu į privatų Vercel Blob; apsaugoti skaitymo endpointai reikalauja administratoriaus arba konkrečiam darbui autorizuoto darbuotojo sesijos.
13. `npm audit --omit=dev`: nėra critical/high; liko 6 moderate transitive Payload/Drizzle `esbuild` dev-server įrašai, kuriems tiekėjas šiuo metu nepateikia automatinės pataisos. Tai registruota kaip priimta P3 tiekėjo priklausomybė, ne kaip Production runtime blokatorius.

### Vienas prisijungimų blokas savininkui atsikėlus

Šie veiksmai atliekami tik šia eilės tvarka:

1. **Vercel Git autorizacija — ATLIKTA.** Galutinio SHA Preview deploy ir smoke PASS.
2. **Vercel CLI autorizacija — ATLIKTA.** Preview ir Production kontekstai identifikuoti; Production nepakeista.
3. **Neon prisijungimas — ATLIKTA.** Šviežia trumpalaikė Production kopija migruota 38/38, 36 pradinių lentelių palyginimas be skirtumų; PROD-2 PASS.
4. **Vercel Production Environment Variables** — savininkas įveda tik trūkstamus slaptus raktus; techninė patikra tvarko neslaptus `false` flagus ir tikrina vardus. Esami `DATABASE_URL`, `PAYLOAD_SECRET`, Blob ir Resend secretai neperrašomi.
5. **Cloudflare Turnstile** — sukurti Production domenams skirtą site/secret porą, jei jos dar nėra.
6. **Upstash/Vercel KV** — prijungti atskirą Production rate-limit resursą, ne staging resursą.
7. **Google AI Studio ir Pexels** — tik jei PROD-8 metu iškart jungsime AI juodraščius; priešingu atveju šie prisijungimai atidedami, o flagai lieka `false`.
8. **Resend** — patikrinti, kad `takfornyelse.as` tebėra Verified ir Production siuntėjas yra `post@takfornyelse.as`; naujo rakto be reikalo nekurti. Po naujo Preview patikrinti administratoriaus slaptažodžio atkūrimą tik į kontroliuojamą savininko adresą.
9. **Galutinis RC ir Production deploy** — tik kai šviežios Neon kopijos, naujausio Preview ir GitHub statusai yra PASS. Produkcijos deploy vykdomas gavus atskirą veiksmo momento patvirtinimą.

Production deploy, bazinis autentifikuotas smoke ir PROD-7 sintetinė Production užklausa užbaigti saugia pradine būsena. Realių automatizacijų įjungimas ir bet koks `FEATURE_*` pakeitimas galimi tik po atskiro savininko patvirtinimo.

## 8. Galutinė užbaigimo sąlyga

Šio dokumento vykdymo darbas laikomas užbaigtu tik tada, kai:

- PROD-0–PROD-9 yra `PASS`;
- savininkas įrašė `GO_CONTROLLED_PRODUCTION_PILOT`;
- įjungtos tik patikrintos funkcijos;
- rollback ir backup įrodymai yra aktualūs;
- pradėtas PROD-10 stebėjimas su paskirtu atsakingu asmeniu.

Tai nėra `GO_FULL_AUTOMATION`. Pilna automatika sprendžiama atskirai po 20–30 realių bylų ir bent 3 fizinių matavimų piloto.
