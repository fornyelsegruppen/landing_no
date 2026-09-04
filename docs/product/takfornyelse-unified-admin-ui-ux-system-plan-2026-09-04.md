# Takfornyelse vientisos administravimo UI/UX sistemos planas

**Owner:** PLATFORM
**Technologijos partneris:** RF
**Statusas:** PATVIRTINTA · F0 CI GREEN · PREVIEW UAT PENDING · F1 NO-GO
**Data:** 2026-09-04
**Bazinis commit:** `4d03b94` (`feat(rf): implement one-card preview workflow`)
**Apimtis:** visa administravimo kelionė, darbuotojo mobili eiga ir susiję
operaciniai paviršiai
**Production:** neliečiama; šis dokumentas neleidžia diegti, keisti schemų,
kainodaros, el. laiškų, automatizacijų ar klientų duomenų

## Sprendimas trumpai

Takfornyelse neturėtų statyti dar vienos administravimo versijos šalia
`admin-v2` ir `admin-next-preview`. Rekomenduojamas kelias yra **strangler tipo
evoliucija**: viena bendra tamsi operacinė sistema palaipsniui pakeičia atskirus
dabartinius ekranus, bet išsaugo patikrintas komandų, audito, versijų, CAS,
idempotentiškumo ir RF saugos ribas.

Pagrindinis produkto modelis:

> viena darbo eilė → viena byla → viena dabartinė būsena → vienas paaiškinamas
> kitas veiksmas → viena audituojama komanda.

„RF One Card“ principas taikomas ne kaip viena milžiniška kortelė viskam, o kaip
vienas sprendimo paviršius. Pirmame matymo lauke visada turi būti aišku:

- kas tai per byla ar užduotis;
- kur ji yra procese;
- kas atsakingas ir iki kada;
- kas trukdo;
- ką tiksliai galima daryti dabar;
- kas pasikeis atlikus veiksmą.

Vizualinė kryptis: beveik juodas fonas, grafito ir melsvai pilkos pakeltos
plokštumos, subtilūs rėmeliai, balta/pilkšva tipografija ir saikingas gintaras tik
fokusui, aktyviam etapui ir pagrindiniam CTA. Klaida ar blokatorius nėra
gintarinis: jam naudojama raudona; sėkmei – žalia; informacijai – mėlyna arba
neutrali. Reikšmė niekada neperduodama vien spalva.

## Audito metodas ir ribos

Tai read-only būklės auditas ir įgyvendinimo planas. Audituota:

- Next.js/Payload maršrutai, kolekcijos, komponentai, serverio komandų ir
  perėjimų kodas;
- `admin-v2`, `admin-next-preview`, darbuotojo `/user` ir techninio Payload
  `/admin` paviršiai;
- bylos, RF/matavimų, pasiūlymų, sutarčių, darbų, dokumentų, komunikacijos,
  archyvo, SEO ir operacijų modeliai;
- esami planavimo dokumentai, ypač bylos darbo erdvės v3 ir RF One Card v2;
- šeši pateikti UI etalonai originaliu dydžiu;
- oficiali Salesforce, Microsoft Dynamics 365, ServiceNow, HubSpot, Procore,
  DocuSign ir Linear dokumentacija.

Inventorizacijos metu nebuvo atlikta jokių domeno ar Production mutacijų.
F0 vykdomoji bazė vėliau atkurta: typecheck, lint, 296 unit failai / 1401 testas,
22 migracijų failai / 42 testai ir 9 E2E scenarijai praėjo; 2 autentifikuoti E2E
scenarijai aiškiai praleisti dėl nesukonfigūruotų synthetic paskyrų. Izoliuotas
build praėjo su laikinu Node x64 runneriu, tačiau švarus Windows ARM64 restore
tebėra atviras dėl nepaskelbto `@libsql/win32-arm64-msvc`. Pilna įrodymų ir
vartų būsena pateikta
[F0 checkpoint](../implementation/admin-unified-f0-checkpoint-2026-09-04.md).
Repo Ubuntu/PostgreSQL CI turi sintetinių paskyrų seed ir visų 11 E2E kontraktą;
bazinio commit generated Payload tipų drift pataisytas, o commit `938f45b`
quality run `33865453230` užbaigė visus vartus žaliai.

### Esamos sistemos įrodymų žemėlapis

| Sritis | Patikrinta kode | Išvada |
|---|---|---|
| Bendras shell | `src/app/(admin-shell)/admin-v2/layout.tsx:19`, `src/components/admin-v2/admin-navigation.tsx:8` | Veikiantis tamsus custom admin turi 11 aukšto lygio nuorodų, atskirą mobilų meniu ir nuorodą į techninį Payload admin. |
| Antras shell | `src/app/(admin-shell)/admin-next-preview/layout.tsx:8`, `src/components/admin-next/admin-next-shell.tsx:83` | Preview kuria antrą navigacijos ir semantikos sluoksnį; dalis nuorodų grįžta į `admin-v2`, o „Cases“ šiuo metu veda į „Today“. |
| Dizaino tokenai | `src/lib/admin-next/design-tokens.ts:1` | Tamsus/gintarinis pagrindas, focus ir semantinės spalvos jau aprašyti; jį reikia paversti bendru, ne preview-only kontraktu. |
| Rollout sauga | `src/lib/admin-next/rollout-view.ts:52`, `src/lib/admin-next/capability-registry.ts:110` | Preview turi fail-closed Production vartus ir modulio lygio fallback. Tai tinkamas laipsniško perėjimo pagrindas. |
| Dashboard/eilės | `src/app/(admin-shell)/admin-v2/page.tsx:21`, `src/lib/admin-v2/dashboard.ts:114` | Duomenų eilės plačios, bet pateikiamos kaip atskiri skydeliai ir nuorodos, ne viena vykdoma darbo eilė. |
| Today preview | `src/lib/admin-next/today-contract.ts:1`, `src/lib/admin-next/today-read-adapter.ts:12` | Kontraktas susiaurintas iki keturių etapų ir keturių legacy eilių; neapima viso esamo `nextAction` žodyno. |
| Bylos sprendimas | `src/lib/admin-v2/case-read-model.ts:12`, `src/lib/admin-v2/case-workspace-view-model.ts:24` | Jau yra deterministinis kito veiksmo medis ir prioritetizuotas pateikimo modelis. Tai turi tapti vieninteliu bendru šaltiniu. |
| Bylos UI | `src/app/(admin-shell)/admin-v2/cases/[id]/page.tsx:1` | Turtinga, bet beveik 3 000 eilučių serverio darbo erdvė didina dubliavimo, regresijų ir netolygios hierarchijos riziką. |
| Bylos komandos | `src/lib/cases/case-command.ts:34` | Yra idempotency/correlation hash, optimistinis `caseRevision` konfliktas ir audito įvykis; UI turi remtis šia riba, jos neapeiti. |
| Bylos duomenys | `src/payload/collections/Leads.ts:114`, `src/lib/admin-next/capability-registry.ts:28` | Klientas ir objektas dabar yra `leads` projekcijos, ne atskiros kanoninės esybės. IA gali juos rodyti atskirai, bet ankstyvoje fazėje neturi apsimesti, kad schema jau atskirta. |
| Rolės | `src/payload/access/roles.ts:3` | Backend šiandien turi tik `admin` ir `worker`; smulkesnės rolės yra tikslinis teisių modelis, ne dabartinė galimybė. |
| Auditas | `src/payload/collections/AuditEvents.ts:4`, `src/lib/audit/audit-event.ts:36` | Įrašai append-only ir saugo hash bei pakeistų laukų pavadinimus, bet ne pakankamą privatumą saugantį `nuo → į` paaiškinimą UI. |
| RF | `docs/implementation/admin-next-roof-fusion-one-card-v2-plan-2026-09-04.md:1`, `src/payload/collections/RoofFusion.ts:44` | One Card A–D yra Preview; nekintamo patvirtinimo ir „į pasiūlymą“ komanda tebėra aiškiai užrakinta E fazėje. |
| Matavimai | `src/payload/collections/RoofMeasurements.ts:37`, `src/payload/collections/RoofMeasurements.ts:230` | Patvirtintos versijos nekintamos, turi šaltinio/evidence/input hash ir approval vartus. |
| Pasiūlymai/sutartys | `src/payload/collections/Quotes.ts:6`, `src/payload/collections/Contracts.ts:6` | Po patvirtinimo/išdavimo saugomos nekintamos versijos, hash, supersedes ir pasirašymo įrodymai. |
| Dokumentai | `src/lib/admin-v2/documents.ts:3`, `src/components/admin-v2/case-version-history.tsx:58` | Vienas loaderis apima 11 tipų ir yra quote/contract versijų grandinė, bet nėra universalaus dabartinės/senos versijos ir diff modelio. |
| Darbai/mobile | `src/payload/collections/WorkOrders.ts:159`, `src/components/worker/worker-order-actions.tsx:406` | Plati būsenų mašina ir įrodymų eiga jau egzistuoja; mobilus klientas stambus ir happy-path orientuotas, offline konfliktas nėra pirmos klasės būsena. |
| Komunikacija | `src/payload/collections/Messages.ts:36`, `src/components/admin-v2/customer-question-workbench.tsx:1` | Yra draft/approval/queue/send/delivery/error ir idempotency duomenys, bet veiksmai išskaidyti per bylos panelius. |
| SEO | `src/lib/blog/transitions.ts:7`, `src/components/admin-v2/blog-editor.tsx:17`, `src/app/api/admin/blog/performance/route.ts:20` | Kokybės vartai ir leidybos perėjimai yra, tačiau trūksta vientisos turinio eilės, kalendoriaus ir analizės darbo erdvės. |
| Operacijos | `src/payload/collections/OperationalJobs.ts:4`, `src/components/admin-v2/platform-health-panel.tsx:19` | Yra darbų/idempotency/klaidų ir platformos sveikatos duomenys, bet operacinis centras sumaišytas su bendrais nustatymais. |

## 1. Dabartinės būklės ir UX skolos žemėlapis

### Dabartiniai paviršiai

| Kelias / modulis | Dabartinė paskirtis | Išsaugoti | UX / architektūros skola |
|---|---|---|---|
| `/admin-v2` | KPI, eilės, paieška | Platus operacinis padengimas ir serveriniai skaičiavimai | Kortelių katalogas reikalauja modulių medžioklės; nėra vienos prioritetizuotos darbo eilės. |
| `/admin-v2/cases` | Bylų paieška ir filtrai | Paieška, būsenos, savininkas, datos | Kortelės neatlieka darbo; filtrai neišsaugomi kaip bendri rodiniai. |
| `/admin-v2/cases/[id]` | Visa bylos darbo erdvė | Platus domeno funkcionalumas ir saugios komandos | Per didelis puslapis, daug vienodo svorio panelių, keli konkuruojantys CTA, nevienoda progressive disclosure. |
| `/admin-v2/contract-requests` | Kliento sutarčių prašymai | Atskira įeinanti eilė | Semantiškai tai Today/Case užduotys, bet pateikta kaip atskiras modulis. |
| `/admin-v2/offers` | Pasiūlymų sąrašas | Būsenos ir bylos ryšys | Plona įrašų nuorodų lentyna; nėra review/commit, versijų palyginimo ar inline darbo. |
| `/admin-v2/contracts` | Sutarčių sąrašas | Būsenos ir bylos ryšys | Toks pats šablonas kaip pasiūlymams, nors rizikos ir leidžiami veiksmai skiriasi. |
| `/admin-v2/work` | Darbų sąrašas | Operacinės būsenos | Nėra pilno grafiko/dispečerio darbo stalo; priskyrimas ir planavimas lieka bylos kontekste. |
| `/admin-v2/documents` | 11 dokumentų tipų, filtrai, eksportas | Vienas agreguotas loaderis, versijos ir hash | Trūksta vienodo manifest/diff/current-old modelio ir su byla susieto veiksmo konteksto. |
| `/admin-v2/archive` | Archyvas / šiukšlinė | Saugūs lifecycle vartai ir retention | Atskira lentyna be universalaus istorijos/atkūrimo paaiškinimo. |
| `/admin-v2/blog`, `/blog/[id]` | Turinys, redagavimas, QA, publikavimas | Kokybės vartai, perėjimai, performance duomenys | Sąrašas nėra turinio pipeline; redagavimas, peržiūra, grafikas ir analitika nėra viena darbo erdvė. |
| `/admin-v2/employees` | Darbuotojai | Admin/worker valdymo pradžia | UI rolės negali būti smulkesnės už dabartinį dviejų rolių backend. |
| `/admin-v2/settings` | Įmonė, terminai, release/health, techninis admin | Svarbios Production ir sveikatos apsaugos | Nustatymai ir operacinis monitoringas yra skirtingi darbai, dabar sumaišyti. |
| `/admin-next-preview/*` | Today, Case, RF, preflight, field visit preview | Tokenai, rollout guard, adapteriai, One Card kryptis | Antras shell, dalinis kanoninis padengimas ir fixtures gali maskuoti realių duomenų spragas. |
| `/user`, `/user/arbeid/[id]` | Darbuotojo darbų sąrašas ir vykdymas | Aiški būsenų seka, nuotraukos, laikai, checklist | Nėra pilno offline/pending/conflict ir išimčių modelio; per daug logikos viename klientiniame komponente. |
| `/admin` | Payload techninis administravimas | Galingas backoffice / avarinis kelias | Neturi tapti kasdienio operatoriaus IA dalimi; paliekamas tik autorizuotam techniniam administravimui. |

### Sisteminės skolos prioritetas

**P0 – prieš vizualinį perstatymą**

1. Dvi lygiagrečios administravimo patirtys ir du navigacijos žodynai.
2. `Today` preview naudoja mažesnį veiksmų modelį nei realus bylos sprendimų medis.
3. Etapas, būsena, prioritetas, rizika, blokatorius ir dokumento versija kai kur
   pateikiami kaip ta pati „statuso“ sąvoka.
4. Auditui trūksta žmogui suprantamo, privatumą saugančio `nuo → į` pokyčio ir
   pasekmės.
5. Tikslinis role-based UX negali būti saugus, kol leidimų branduolys yra tik
   `admin/worker`.
6. RF → pasiūlymas neturi patvirtinto nekintamo, exact-hash susieto tilto.

**P1 – pagrindinė operacinė patirtis**

1. Dashboard reikia pakeisti vykdoma ir paaiškinama „Šiandien“ eile.
2. Bylos puslapiui reikia bendro šablono ir vienos veiksmų zonos.
3. Pasiūlymų, sutarčių, dokumentų ir komunikacijos review/commit modeliai
   nevienodi.
4. Darbų planavimas neturi dispečerio master–detail/grafiko patirties.
5. Mobile nepakankamai modeliuoja ryšio nebuvimą, konfliktą, saugos incidentą,
   perdavimą, perplanavimą ir klaidingo perėjimo taisymą.
6. Realiame operatoriaus bandyme RF buvo randamas tik žinant techninį kelią
   `Admin Next · Apsaugota peržiūra → Modulių būsena → Stogo matavimas ir R4 →
   Atidaryti RF UAT`. Be instrukcijos operatorius RF nebūtų radęs. Tai P1
   navigation/discoverability defektas, o ne mokymų problema.

**P2 – efektyvumas ir analizė**

1. Nėra vienodų išsaugomų rodinių, bendrų filtrų ir klaviatūros veiksmų.
2. Kliento ir objekto patirtis yra naudinga projekcija, bet ne savarankiškas
   domeno modelis.
3. SEO turi gerus backend vartus, bet ne vientisą pipeline ir performance loop.
4. Nėra bendros versijų palyginimo ir „žiūrite seną versiją“ sąveikos.

### Etalonų audito išvada

Šeši pateikti vaizdai patvirtina tinkamą kryptį: bylos centras, „One Card“,
master–detail Today, mobili vieno CTA eiga ir review/commit paketas. Nekopijuotini
elementai:

- daug vienodo vizualinio svorio kortelių;
- to paties blokatoriaus dubliavimas;
- gintaras navigacijai, rizikai, etapui ir CTA vienu metu;
- prieštaringi „aktyvus / išspręstas / 0 atvirų“ pavadinimai;
- happy-path mobile be offline ir klaidų kelių;
- techninis hash be patikimo stabilaus šaltinio ID, revizijos ir approval;
- bendrinis patvirtinimo checkbox, kuris gali tapti ritualiniu paspaudimu.

| Pateiktas vaizdas | Kas veikia | Ką planas taiso |
|---|---|---|
| `exec-20a113a0-2523-40b0-b5e0-42cb2ed60a0e.png` | bylos blocker tiesiogiai tampa darbuotojo užduotimi; matomos RF/quote versijos ir offline signalas | mažina vienodo svorio korteles, nedubliuoja blocker, atskiria mobile būseną nuo siūlomo veiksmo |
| `exec-ba952dfb-4b2e-4476-80d9-66fb4edd02b8.png` | keturi aiškūs mobile žingsniai, vienas lipnus CTA, įrodymai ir automatizacijos | prideda offline, pause, saugos, klaidos, handoff, reschedule ir sync conflict kelius |
| `exec-51f11b86-7411-4bbd-9aa5-237ca32b5c13.png` | stiprus Next Action, evidence, proceso ir utility rail modelis | suderina „aktyvus/išspręstas“ blocker semantiką, stage pavadinimus ir utility rail dydį |
| `exec-82d7c43b-e777-4898-948d-2268b678330d.png` | tas pats shell stabiliai rodo kitą bylos įvykį | timeline papildoma `kas / ką / nuo → į / pasekmė`, ne kuriamas dar vienas šablonas |
| `exec-14225b20-c440-45c2-b141-941c358b7df7.png` | Today master–detail, „kodėl dabar“, terminas ir owner | KPI paverčia aiškiais filtrais arba metrika, struktūruoja prioritetą, rodo inline CTA, saved views ir mobile transformaciją |
| `exec-a153ab87-fd88-4e29-8257-11311b1e75d5.png` | review/commit, manifestas, būsena po veiksmo ir idempotency | rodo turinio/siuntėjo/gavėjų preview, klaidos/recovery kelią ir RF exact ID/revision/hash kilmę |

## 2. Tikslinė informacijos architektūra ir navigacija

### Viena pirminė navigacija

| Grupė | Punktas | Atsakomas klausimas | Dabartinių paviršių šaltinis |
|---|---|---|---|
| Darbas | **Šiandien** | Ką turiu atlikti dabar ir kodėl? | dashboard, contract requests, klausimai, quote review, signing, upcoming work, failures |
| Ryšiai | **Bylos** | Kokia visa kliento/objekto darbo būsena? | cases ir visa bylos darbo erdvė |
| Ryšiai | **Klientai ir objektai** | Kokios bylos, kontaktai, adresai ir istorija susiję? | pradžioje – saugios `leads` projekcijos; vėliau galima kanoninė migracija |
| Vykdymas | **Darbai** | Kas priskirta, suplanuota, vyksta ar blokuojama? | work, WorkOrders, worker visit |
| Artefaktai | **Dokumentai** | Kokia dabartinė patvirtinta versija ir kas ją panaudojo? | documents, offers, contracts, invoice, warranty, work evidence |
| Turinys | **SEO studija** | Ką generuoti, peržiūrėti, suplanuoti ir optimizuoti? | blog list/editor/review/performance |

### Antrinė, kontekstinė navigacija

Šie dalykai neturi būti lygiaverčiai globalūs moduliai. Jie atsidaro bylos ar
atitinkamos darbo erdvės kontekste:

- RF ir matavimai;
- kainodara bei pasiūlymai;
- sutartys ir pakeitimų susitarimai;
- komunikacija;
- sąskaitos, užbaigimas ir garantija;
- susiję vizitai/darbai;
- bylos veikla ir auditas.

### Administravimo grupė

| Punktas | Turinys |
|---|---|
| **Operacijos** | platformos sveikata, darbų eilės, integracijų būsena, klaidos, retry/recovery, backup/release gate |
| **Archyvas** | archyvuotos ir išmestos bylos, retention, atkūrimas ir purge statusas |
| **Komanda ir teisės** | darbuotojai, profiliai, kompetencijos, darbo pajėgumas ir capability bundles |
| **Nustatymai** | įmonės profilis, darbo laikas, šablonai, kanalai ir konfigūracija |
| **Techninis administravimas** | Payload `/admin`; atskira, tik privilegijuota nuoroda, ne kasdienė navigacija |

### Navigacijos taisyklės

1. „Šiandien“ yra numatytasis operacinės rolės pradinis puslapis.
2. Globali paieška randama iš bet kur ir ieško pagal bylos numerį, klientą,
   adresą, telefoną, el. paštą, dokumento numerį, darbo numerį ir stabilų ID.
3. Navigacijos punktas niekada neturi vesti į semantiškai kitą modulį; dabartinis
   preview „Cases“ → „Today“ ryšys turi išnykti.
4. Skirtukai naudojami tik tos pačios esybės pjūviams, ne atskiriems procesams
   slėpti.
5. Desktop išlaiko kairį rail, mobile – apatinę prioritetinių sričių navigaciją
   ir „Daugiau“ administravimo darbams.
6. URL migracija nėra P0 tikslas. Dabartinis `/admin-v2` namespace gali likti
   tol, kol visas modulis pereina rollout vartus; vėliau sprendžiamas alias arba
   redirect. `/admin` konfliktas su Payload neapeinamas savavališkai.
7. RF kasdienis kelias prasideda konkrečioje byloje: `Kitas veiksmas → Atverti
   matavimą` arba `Tęsti matavimą`. Atveriant perduodamas case ID, measurement/RF
   kontekstas ir grįžimo URL. „Modulių būsena“ lieka diagnostikos paviršius
   techniniam administratoriui, ne operatoriaus navigacijos žingsnis.

### Tiksliniai puslapių pjūviai

```text
Šiandien
├─ Mano darbai
├─ Vėluoja
├─ Laukia kliento
├─ Laukia sistemos / integracijos
├─ Be atsakingo
└─ Išsaugomi komandos rodiniai

Bylos
├─ Visos / aktyvios / blokuojamos / užbaigtos
└─ Bylos darbo erdvė
   ├─ Apžvalga ir kitas veiksmas
   ├─ Matavimas / RF
   ├─ Komercija
   ├─ Darbai
   ├─ Dokumentai
   ├─ Komunikacija
   └─ Istorija

Darbai
├─ Grafikas
├─ Nepriskirti
├─ Vykstantys
├─ Reikia dėmesio
└─ Darbo / vizito darbo erdvė

Dokumentai
├─ Visi dokumentai
├─ Reikia peržiūros
├─ Pasirašymas / pristatymas
└─ Versijos ir paketo įrodymai

SEO studija
├─ Idėjos ir eilė
├─ Juodraščiai
├─ Žmogaus peržiūra
├─ Kalendorius
├─ Publikuota
└─ Rezultatai ir rekomendacijos
```

## 3. Bendra dizaino ir sąveikos sistema

### Vizualinis kontraktas

Esami `admin-next` tokenai yra pradinis šaltinis, ne atskira tema. Galutinė
sistema turi turėti semantinius tokenus, kad komponentas nenaudotų žalių HEX
reikšmių:

| Semantika | Naudojimas |
|---|---|
| `canvas` | beveik juodas aplikacijos fonas |
| `surface-1/2/3` | pagrindas, pakelta kortelė, modalas/drawer |
| `border-subtle/strong` | struktūra ir aktyvus kontekstas |
| `text-primary/secondary/muted` | aiški tipografijos hierarchija |
| `focus` / `action-primary` | gintarinis fokusas ir vienas pagrindinis CTA |
| `danger` | atviras blokatorius, nepavykęs veiksmas, destruktyvus sprendimas |
| `success` | užbaigta/patvirtinta, bet ne kliką viliojantis CTA |
| `info` | neutrali sistemos informacija, sync ir papildomas kontekstas |

Tikslios pradinės spalvos lieka `src/lib/admin-next/design-tokens.ts`, bet prieš
Production turi būti patikrintos pagal WCAG 2.2 AA kiekvienoje teksto, border,
focus ir disabled kombinacijoje.

### Informacijos hierarchija

Kiekvienas darbo ekranas laikosi penkių lygių:

1. **Kontekstas:** ID, klientas/objektas, dabartinis etapas, savininkas.
2. **Sprendimas dabar:** kitas veiksmas arba vienas konkretus blokatorius.
3. **Įrodymai:** tik tai, ko reikia sprendimui patikrinti.
4. **Susijęs darbas:** dokumentai, komunikacija, vizitai, automatizacijos.
5. **Techninė detalė:** hash, koreliacija, pilna istorija, senos versijos.

### CTA hierarchija

- Viename sprendimo kontekste – tik vienas vizualiai pirminis CTA.
- Leidžiami daugiausia du antriniai veiksmai; retesni keliauja į aiškiai
  pavadintą overflow.
- Neaktualūs ar rolei neleidžiami veiksmai slepiami.
- Dabartiniam kitam žingsniui svarbus, bet negalimas veiksmas rodomas disabled su
  konkrečia priežastimi ir pataisymo keliu.
- Finansiniai, teisiniai, išsiuntimo, archyvavimo ir kiti didelės pasekmės
  veiksmai naudoja `ReviewAndCommit`, kuriame matomi gavėjai, šaltiniai, versijos,
  būsena po veiksmo ir idempotentiškumas.
- Pavojingi veiksmai turi atskirą danger zoną. Typed confirmation naudojamas tik
  sunkiai atšaukiamam veiksmui; bendriniai ritualiniai checkboxai nenaudojami.

### Modalai, drawer ir pilnas puslapis

| Modelis | Kada naudoti | Kada nenaudoti |
|---|---|---|
| Modalas | trumpai peržiūrai ir vienos atominės komandos patvirtinimui | ilgam redagavimui, kelioms proceso stadijoms, dideliems palyginimams |
| Dešinysis drawer | greitam eilutės patikrinimui, mažam redagavimui, klaidos atkūrimui, neprarandant eilės | kritinei komandai be pilno pasekmės vaizdo |
| Pilnas puslapis / workbench | RF, pasiūlymo redagavimui, sutarties ar SEO turinio darbui, kai reikia kelių įrodymų | vienam paprastam statuso pakeitimui |
| Inline veiksmas | mažos rizikos, vienareikšmiam veiksmui Today ar lentelėje | kai reikia papildomų įvesčių arba teisinės/finansinės peržiūros |

Visi overlay paviršiai turi focus trap, grąžinamą fokusą, `Esc` taisyklę,
neišsaugotų pakeitimų apsaugą ir tiesioginį URL, jei darbą reikia tęsti ar
pasidalyti.

### Paieška, filtrai ir išsaugomi rodiniai

- Vienas bendras `SearchQuery` kontraktas su scope, tekstu, būsenomis,
  atsakingais, terminu, blokatoriumi, etapu ir rūšiavimu.
- KPI kortelė yra arba aiškiai paspaudžiamas filtras, arba tik metrika; viename
  ekrane ji negali būti abiem nepaaiškintai.
- Filtrai atsispindi URL, išlieka po grįžimo ir gali būti išsaugomi kaip asmeninis
  ar bendras komandos rodinys.
- Rodinys saugo stulpelius, jų tvarką, density, filtrą ir rūšiavimą, bet ne
  jautrius rezultatų duomenis.
- Globali paieška pateikia paskutinius įrašus, tikslų ID match ir suskirstytus
  rezultatus; klaviatūros shortcutas dokumentuojamas UI.
- Masiniai veiksmai leidžiami tik vienodos būsenos, mažos rizikos komandų rinkiniui
  ir kiekvienam objektui kuria atskirą audito rezultatą.

### Prieinamumas ir responsive

- Tikslas – WCAG 2.2 AA; kritiniai keliai tikrinami klaviatūra ir ekrano
  skaitytuvu.
- Fokusas matomas ant kiekvieno interaktyvaus elemento; nėra hover-only turinio.
- Būsena visada turi tekstą ir/ar ikoną, ne tik spalvą.
- Mobilūs taikiniai ne mažesni nei 44 × 44 px, lipnus CTA neuždengia turinio.
- Lentelė transformuojama į užduočių korteles, o ne horizontaliai suspaudžiama.
- Gerbiamas `prefers-reduced-motion`; loading, empty, error, unauthorized,
  offline, pending sync ir conflict yra suprojektuotos būsenos.

### Asinchroninio veiksmo grįžtamasis ryšys

Asinchroniškai kraunamas turinys negali palikti seno ekrano taip, tarsi
paspaudimas neįvyko. Kiekvienas route, workbench ir komandos perėjimas laikosi
vieno modelio:

1. paspaustas CTA iš karto pakeičia būseną į konkretų veiksmažodį, pvz.
   `Atveriamas RF R4`, `Tikrinamas hash`, `Kuriamas pasiūlymo juodraštis`;
2. lokalizuotas skeleton arba overlay dengia tik keičiamą darbo sritį, o bylos
   antraštė, ID ir orientacija lieka matomi;
3. ankstesni duomenys neatrodo „current“ – jie pritemdomi ir pažymimi kaip
   atnaujinami arba pakeičiami skeleton;
4. ilgesnė eiga rodo dabartinį etapą, o ne neapibrėžtą spinner;
5. klaida pateikia priežastį, saugų retry ir `Grįžti į bylą` arba `Koreguoti`
   kelią, neprarandant įvesties;
6. užbaigus focus perkeliamas į naują antraštę arba result statusą ir live region
   praneša rezultatą.

Priėmimo slenkstis: jei vizualus rezultatas neatsiranda per 150 ms, tame pačiame
kontekste turi atsirasti loading būsena su konkrečiu veiksmo pavadinimu. Joks
kelias negali rodyti seno aktyvaus CTA kartu su vykdoma ta pačia komanda.

## 4. Bendri puslapių šablonai ir komponentų sistema

### Puslapių šablonai

| Šablonas | Paskirtis | Privaloma anatomija | Mobile transformacija |
|---|---|---|---|
| `AppShell` | visas custom admin | semantinė nav, globali paieška, aplinkos/rollout žyma, locale, vartotojas, sistemos pranešimai | apatinė 4–5 sričių nav, paieška per visą ekraną, administravimas per „Daugiau“ |
| `WorkQueuePage` | Today, contract requests, reviews, failures | saved views, aiškiai interaktyvūs KPI filtrai, eilė, explainable rank, master–detail inspector, inline CTA | task cards; pasirinkimas atveria pilno ekrano inspector su lipniu CTA |
| `EntityIndexPage` | bylos, klientai/objektai, dokumentai | paieška, filtrai URL, išsaugomi rodiniai, server-side pagination, stulpelių pasirinkimas, tuščia/klaidos būsena | svarbiausi laukai kortelėje; papildomi laukai po progressive disclosure |
| `CaseWorkspace` | vienos bylos centras | header, proceso juosta, `NextActionCard`, blocker summary, kontekstiniai tabs, utility rail, audit stream | trumpa santrauka, dabartinis etapas, vienas veiksmas, blocker; sekcijos atskirais maršrutais/sheets |
| `StageWorkbench` | RF, matavimas, pasiūlymas, sutartis, completion | darbo įvestys, vizualus įrodymas, validacija, versija, sticky action bar | vienas žingsnis vienu metu; ne suspaustas trijų kolonų desktop |
| `ReviewAndCommit` | ekonominis, teisinis, išsiuntimo ar lifecycle sprendimas | veiksmo santrauka, šaltinių manifestas, gavėjai, versijos/hash, būsena po veiksmo, warnings, confirm CTA | pilno ekrano sheet; tas pats turinys ir ta pati komanda |
| `VersionedArtifactPage` | pasiūlymai, sutartys, pakeitimai, sąskaitos, garantijos | current badge, immutable system version, human label, supersedes chain, compare, provenance, events | dabartinė versija pirma; senos versijos ir diff atskirai |
| `DispatchWorkspace` | darbo priskyrimas ir grafikas | nepriskirtų eilė, kalendorius/timeline, darbuotojo pajėgumas, travel/context, conflict warnings, commit drawer | šiandienos grafikas ir konkretus perplanavimo veiksmas; pilnas planavimas – desktop |
| `MobileTaskRunner` | darbuotojo vizitas/darbas | bylos kontekstas, vienas dabartinis žingsnis, required evidence, sync būsena, išimtys, lipnus CTA | tai yra pirminė forma; desktop naudoja tą pačią būsenų mašiną supervisoriaus režimu |
| `ContentPipeline` | SEO studija | stulpelinė/list pipeline, temos, žmogaus peržiūra, kalendorius, performance signalai | eilė ir review; sudėtingas turinio redagavimas gali rekomenduoti desktop |
| `OperationsConsole` | jobs, integrations, invariants, release health | severity, affected entity, attempts, last error summary, correlation ID, retry/cancel policy, runbook | incidentų triage ir acknowledgement; masinis valdymas – desktop |

### Bendrų komponentų katalogas

**Orientacija ir būsena**

- `PageHeader`, `Breadcrumbs`, `EnvironmentBadge`, `ProcessStageBar`;
- `StatusPill`, `RiskBadge`, `BlockerBadge`, `OwnerChip`, `DueIndicator`;
- `SystemVersionBadge`, `HumanRevisionLabel`, `CurrentVersionBanner`;
- `SyncStatus` su `synced | pending | offline | conflict | failed`.

**Sprendimas ir įrodymai**

- `NextActionCard`: pavadinimas, kodėl dabar, savininkas, terminas,
  prielaidos, poveikis, vienas CTA;
- `BlockerCard`: tipas, sunkumas, susieta esybė, atsakingas, terminas ir
  pašalinimo kelias;
- `EvidenceChecklist`, `EvidencePreview`, `SourceProvenance`;
- `ReadinessGate`: aiškiai išvardija patenkintas ir neįvykdytas sąlygas;
- `ActionResult`: success/partial/failure ir tiesioginis kitas žingsnis.

**Sąrašai ir duomenų tankis**

- `SavedViewPicker`, `FilterBar`, `SearchOmnibox`, `DensityControl`;
- `WorkQueue`, `DataTable`, `TaskCard`, `MasterDetailInspector`;
- `EmptyState`, `NoResultsState`, `AccessDeniedState`, `StaleDataBanner`;
- `Pagination` arba cursor modelis; dokumentų centre nebekrauti visko į atmintį.

**Komandos ir sauga**

- `PrimaryAction`, `SecondaryAction`, `DangerAction` iš bendros hierarchijos;
- `ReviewAndCommitDialog`, `UnsavedChangesGuard`, `ConflictResolutionDialog`;
- `ActionOverflow` tik retiems veiksmams; kritinės išimtys neturi būti
  paslėptos tik „...“;
- `IdempotencyNotice` žmogui aiškina rezultatą, bet nerodo paslapties ar
  nereikalingo techninio rakto.

**Istorija, dokumentai ir komunikacija**

- `AuditTimeline`, `AuditEventDetail`, `FieldChangeDiff`;
- `VersionChain`, `VersionCompare`, `DocumentManifest`, `DeliveryEvents`;
- `ConversationThread`, `MessageComposer`, `RecipientReview`, `DeliveryState`;
- `ActivityEvent` naudoja vieną schemą žmogaus, API, webhook ir automatikos
  veiksmams.

### Komponentų nuosavybės taisyklė

Komponentas rodo būseną, bet jos neišgalvoja. Domeno read-model apskaičiuoja
etapą, blocker, kitą veiksmą, leidimą ir pasekmę; komandų servisas dar kartą
patikrina tuos pačius invariantus serveryje. UI `disabled` nėra saugos kontrolė.

Esami komponentai perkeliami po vieną, pirmiausia ištraukiant jų read model ir
komandos kontraktą iš 2 944 eilučių bylos puslapio. Draudžiama vienu commit
perrašyti visą bylos workspace arba kopijuoti jį į trečią administravimo
versiją.

## 5. Bylos gyvavimo ciklas, būsenos, blokatoriai, istorija ir kitas veiksmas

### Vienas žodynas skirtingoms sąvokoms

| Sąvoka | Tikslinis modelis | Ko ji nereiškia |
|---|---|---|
| `processStage` | `inquiry → evidence → commercial → agreement → work → completion` | ne konkretaus dokumento statusas ir ne rizika |
| `caseState` | išvedama `on_track | needs_action | waiting | blocked | completed` | ne laisvai pasirenkama pipeline etiketė |
| `recordState` | `active | archived | trashed` | ne verslo proceso etapas |
| `nextActionKind` | tipizuota komanda / klausimas / panelis / laukimas | ne laisvo teksto `Leads.nextAction` |
| `priority` | apskaičiuotas eiliškumas su paaiškinimu | ne statuso spalva |
| `risk` | SLA, finansinė, teisinė, saugos ar duomenų rizika | ne pats blocker |
| `blocker` | pirmos klasės neišpildyta sąlyga ar struktūrinis ryšys | ne laisvas tekstas be savininko ir būsenos |
| `artifactVersion` | nekintama sistemos versija su ID/hash ir `supersedes` | ne vien redaguojama „R4“ etiketė |
| `visitState` | esama serverinė WorkOrder seka | ne bylos bendro proceso būsena |

Esamas `case-read-model` ir `case-workspace-view-model` yra rekomenduojamas
kanoninio **pateikimo resolverio** pagrindas. Jis turi absorbuoti siauresnį
Admin Next Today kontraktą. Kol migracija neužbaigta, laisvo teksto
`Leads.nextAction` gali būti rodomas kaip operatoriaus pastaba, bet negali valdyti
leidžiamų perėjimų.

### Bylos proceso stadijos

| Stadija | Įėjimo signalas | Pagrindinis rezultatas | Tipiniai blockeriai |
|---|---|---|---|
| `inquiry` | gauta užklausa | pakankamas klientas/objektas ir sutartas tolesnis žingsnis | trūksta kontakto, adreso, sutikimo ar atsakymo |
| `evidence` | objektas tinkamas vertinti | patvirtintas, nekintamas matavimas su provenance | netinkamas pastatas, trūksta vaizdo/aukščio, per mažas confidence, reikia vizito |
| `commercial` | patvirtintas matavimo pagrindas | peržiūrėtas ir klientui pateiktas versijuotas pasiūlymas | pasenęs matavimas, trūksta kainodaros, quote hash konfliktas |
| `agreement` | pasirinktas pasiūlymas / sutarties prašymas | abiejų šalių patikimai pasirašyta sutartis | trūksta įrodymo, terminas, parašo ar counter-signature |
| `work` | galiojanti sutartis | priskirtas, suplanuotas ir dokumentuotas darbas | nėra darbuotojo/laiko, saugos ar scope problema, nepatvirtintas pakeitimas |
| `completion` | darbas užbaigtas | peržiūrėta dokumentacija, sąskaita, garantija ir bylos uždarymas | trūksta before/after, completion approval, invoice ar delivery įrodymo |

Blocker nepakeičia proceso stadijos. Pvz., pasiūlymo stadijoje trūkstant
matavimo įrodymo, byla lieka `commercial`, jos `caseState` tampa `blocked`, o
blokeris nurodo grįžimo į evidence workbench kelią. Taip istorija išlieka
stabili ir neatsiranda „septintas etapas“ kiekvienai išimčiai.

### Perėjimo kontraktas

Kiekvienas svarbus perėjimas turi vieną konfigūruotą aprašą:

```ts
type TransitionDefinition = {
  command: string
  from: string[]
  to: string
  allowedCapabilities: string[]
  requiredInputs: string[]
  requiredEvidence: string[]
  blockingRules: string[]
  reviewMode: 'inline' | 'review_and_commit' | 'danger'
  produces: Array<'audit_event' | 'document' | 'message' | 'job'>
  automationEffects: string[]
  nextActionResolverKey: string
}
```

Tai loginė specifikacija, ne siūlymas dabar pridėti TypeScript tipą. Vienas
serverinis command handleris yra galutinis leidimo, esamos versijos, transition,
idempotency ir audito arbitras. UI, API, webhook ir automatikos negali turėti
skirtingų taisyklių ar administratoriaus „nematomo apėjimo“ teisiškai svarbiam
perėjimui.

### Pirmos klasės blokatorius

Tikslinis `Blocker` kontraktas:

- stabilus `blockerId`, `caseId`, `entityType/entityId`;
- tipas: duomenys, klientas, dokumentas, integracija, finansai, sauga, planas,
  konfliktas;
- sunkumas ir ar jis blokuoja konkretų perėjimą;
- `ownerId` arba atsakinga capability/komanda;
- terminas, būsena `open | acknowledged | resolved | waived`;
- sukūrimo šaltinis, taisyklė, žmogui aiški priežastis;
- resolution įvykis, aktorius, laikas ir susijusi versija.

`caseState=blocked` išvedama iš atvirų transition-blocking įrašų. Laisvo teksto
`nextActionBlocker` migracijos metu lieka compatibility laukas; nauji UI neturi
kurti neidentifikuojamų tekstinių blockerių.

### Kitas geriausias veiksmas

Resolveris turi būti deterministinis ir paaiškinamas. Rekomenduojama tvarka:

1. teisinis, saugos arba duomenų vientisumo stop;
2. nepavykusi komanda / pristatymas, kurį būtina atkurti;
3. kliento klausimas ar terminuota komunikacija;
4. šiandienos SLA ar vizito veiksmas;
5. verslo proceso veiksmas;
6. laukimas su aiškiu savininku ir wake-up sąlyga;
7. užbaigta / nėra veiksmo.

Kiekvienas `NextAction` pateikia:

- `kind`, žmogui aiškų pavadinimą ir „kodėl dabar“;
- owner, due time, SLA/risk ir į eilę įtraukusią taisyklę;
- required capability, duomenis, įrodymus ir blocker sąrašą;
- vykdomos komandos pavadinimą, review režimą ir laukiamą rezultatą;
- deep link į tą patį action context desktop ir mobile.

AI gali vėliau apibendrinti kontekstą ar pasiūlyti tekstą, tačiau negali
savarankiškai parinkti neleistino perėjimo, pakeisti prioriteto taisyklių arba
apeiti evidence/hash vartų.

### Istorija ir auditas

Vienas įvykis UI turi atsakyti: **kas, ką, iš ko į ką, kada, kodėl, kokiu
šaltiniu ir kas nutiko toliau**.

Tikslinis pateikimo kontraktas:

- immutable audit event ID ir UTC laikas; UI rodo vietinį laiką su timezone;
- aktorius: žmogus, API klientas, webhook arba automation/job;
- veiksmas, esybė, jos nekintama versija ir correlation ID;
- allowlist'intas struktūrinis `from → to` skirtumas arba saugi semantinė
  santrauka;
- priežastis / operatoriaus komentaras, jei reikalingas;
- rezultatas `succeeded | partial | failed | compensated`;
- sukurti dokumentai, pranešimai, jobs, blocker pakeitimai ir naujas
  `nextAction`.

Dabartinių `AuditEvents` raw snapshotų saugoti nereikia ir negalima pradėti
rodyti PII vien dėl patogaus diff. Reikia atskiros, allowlist ir redaction
taisyklėmis valdomos history projekcijos. Esami `beforeHash/afterHash` išlieka
vientisumo įrodymas. Case timeline turi skaityti realius audit events, o ne
rekonstruoti veiklą tik iš esybių timestampų ar rodyti hardcodintą aktorių.

### Dokumentų ir versijų taisyklės

1. Nauja versija visada sukuria naują įrašą ir `supersedes`; patvirtintas,
   išsiųstas ar pasirašytas artefaktas neperrašomas.
2. Nekintamas sistemos `version/id/hash` atskiriamas nuo žmogui patogios
   revizijos žymos.
3. Pagal nutylėjimą atidaroma dabartinė galiojanti versija.
4. Atidarius seną versiją rodomas aiškus „Ne dabartinė“ banneris, nuoroda į
   dabartinę ir compare.
5. „Atkurti“ reiškia sukurti naują versiją iš senos, ne pakeisti istoriją.
6. Paketas turi manifestą: kiekvieno dokumento ID, versiją, hash, gavėją,
   kalbą, kanalą ir delivery events.
7. Pasirašytas dokumentas ir jo completion/signature įrodymas yra atskiri,
   susieti artefaktai.

### Saugus nekintamas RF → pasiūlymo tiltas

Ši dalis priklauso RF One Card v2 **Phase E** ir negali būti įgyvendinta šio
plano vardu. Tikslas – vienas sąmoningas operatoriaus veiksmas
`Įkelti matavimą į pasiūlymą`, bet ne vienas neaudituojamas shortcutas.

**Privalomos įvestys**

- `caseId` ir expected `caseRevision`;
- `rfSnapshotId`, RF revizija, schema versija ir perskaičiuotas `snapshotHash`;
- approval aktorius/laikas ir provider/evidence/provenance nuorodos;
- dabartinė kainodaros/terms versija;
- idempotency key ir correlation ID.

**Vienos komandos eiga**

1. Serveris pakartotinai patikrina rolę/capability, case revision, snapshot
   approval, hash ir atvirus kritinius blockerius.
2. Exact RF snapshot projektuojamas į naują nekintamą `RoofMeasurement` versiją,
   aiškiai išsaugant RF snapshot ID, reviziją, hash, input hash ir evidence
   nuorodas. Skaičiai nekopijuojami ranka.
3. Esamas komercinis quote engine gauna tik measurement ID, versiją, input hash
   ir patvirtintą kainodaros pagrindą; jis sukuria naują pasiūlymo **juodraščio
   versiją**.
4. Vienas correlation ID sujungia command ledger, measurement, quote ir audito
   įvykius. Rezultatas grąžina sukurtų objektų ID/versijas/hash ir kitą veiksmą
   `Peržiūrėti pasiūlymą`.
5. Komanda **nesiunčia**, **nepatvirtina** ir nepasirašo pasiūlymo. Tai lieka
   atskiras review/commit sprendimas.

**Nekintamumo ir klaidų taisyklės**

- Pakartotas identiškas idempotency key grąžina tą patį rezultatą ir nesukuria
  antro pasiūlymo.
- Naujas RF skaičiavimas sukuria naują snapshot; jau sukurtas pasiūlymas
  nepasikeičia. UI siūlo kurti naują pasiūlymo versiją.
- Stale case revision, hash neatitikimas, nepatvirtintas snapshot ar kritinis
  blocker uždaro komandą fail-closed ir paaiškina pataisymo kelią.
- Jei keli įrašai negali būti sukurti viena DB transakcija, command ledger ir
  `OperationalJob` turi suteikti saugų resume/compensate modelį; tylus dalinis
  rezultatas neleidžiamas.
- Jokio Production tilto, kol nėra RF Phase E kontrakto patvirtinimo, API/unit/
  integration/E2E testų, migracijos plano, owner UAT ir atskiro release `GO`.

## 6. Kritinių kelionių paspaudimų analizė

Skaičiavimo taisyklė: skaičiuojami sąmoningi mygtuko/nuorodos pasirinkimai nuo
dažniausio pradinio ekrano iki verslo rezultato; neskaičiuojamas teksto įvedimas,
nuotraukos pasirinkimas ar būtinas įrodymo gestas. „Dabar“ yra statinio kodo
audito intervalas, ne instrumentuota Production telemetrija. P0 turi užfiksuoti
realų baseline ir pakoreguoti šias reikšmes prieš nustatant KPI.

| Kritinė kelionė | Dabar | Tikslas | Kas pašalinama / kodėl dalis paspaudimų lieka |
|---|---:|---:|---|
| Konkreti byla → RF matavimas | 4 techniniai pasirinkimai: Apsaugota peržiūra → Modulių būsena → Stogo matavimas ir R4 → RF UAT | 1 | Bylos `Kitas veiksmas` tiesiogiai atveria `Atverti/Tęsti matavimą`, išlaiko bylos ID/būseną ir turi vieno veiksmo grįžimą. |
| Today eilė → atlikti aiškų bylos veiksmą | 3–5 | 1–2 | Pašalinamas tarpinis „atidaryti modulį / rasti panelį“; eilutė + inline arba review veiksmas. |
| Nauja užklausa → paprašyti trūkstamos informacijos | 4–6 | 2–3 | Eilėje iš karto rodoma trūkstama sąlyga, parengtas tekstas ir recipient review. |
| Bylos klausimas → parengti ir išsiųsti atsakymą | 4–6 | 2–3 | Unified conversation inspector; tekstą vis tiek privaloma peržiūrėti prieš siuntimą. |
| Adresas → patvirtintas RF rezultatas | daug atskirų legacy/preview veiksmų; One Card tikslas 4 | 4 sąmoningi veiksmai | Išsaugomas RF plano kelias: rasti, pasirinkti pastatą, apskaičiuoti, įkelti į pasiūlymą; anotavimo gestai neskaičiuojami. |
| Patvirtintas RF snapshot → pasiūlymo juodraštis | **N/A:** exact-hash Production tilto nėra | 1 | Viena idempotentiška komanda sukuria measurement ir quote draft; nesiunčia klientui. |
| Pasiūlymo juodraštis → patvirtintas ir išsiųstas paketas | 2–4 | 1–2 | Vienas review/commit su gavėju, turiniu, manifestu ir būsena; siuntimo sauga nemažinama iki aklo quick action. |
| Priimtas pasiūlymas → counter-sign → work order | 4–6 | 2–3 | Guided lifecycle pasiūlo sekantį veiksmą; teisinis parašas ir darbo sukūrimas lieka atskiri audit events. |
| Nepriskirtas darbas → darbuotojas + laikas | 3–5 | 1–2 | Dispatch drawer vienu commit patvirtina žmogų ir slotą, bet rodo konfliktus/pajėgumą. |
| Darbuotojas: priskirta → vykstu → atvykau → pradėjau → baigiau → dokumentuota | 5 perėjimai + įrodymai | 5 perėjimai + įrodymai | Tai vertingi, laiką ir atsakomybę fiksuojantys paspaudimai; tikslas yra aiškumas ir offline patikimumas, ne dirbtinis mažinimas. |
| Completion → sąskaita + garantija + uždarymas | 4–7 | 2–4 | Readiness gate ir guided next action; atskiri finansiniai/teisiniai artefaktai neišnyksta. |
| SEO tema → juodraštis → review → schedule/publish | 5–7 | 3–4 | Viena pipeline darbo erdvė; žmogaus review ir publish/schedule lieka atskiri vartai. |
| Bylą archyvuoti | 3–4 | 2–3 | Centralizuota lifecycle zona; blocker/reason/confirm lieka, nes tai ne „frikcija be vertės“. |

Sėkmės metrikos po rollout:

- median ir P90 deliberate clicks pagal kelionę;
- time-to-next-action ir eilės laukimo trukmė;
- backtrack, atšaukto modalo ir klaidingo statuso korekcijų dažnis;
- komandų failure/retry/duplicate suppression;
- stale/conflict bei offline pending trukmė;
- accessibility completion klaviatūra ir task success user testuose.

## 7. Rolėmis grįstos desktop ir mobile darbo eigos

### Dabarties ir tikslo atskyrimas

Šiandien saugos modelis turi tik `admin` ir `worker`. Toliau pateiktos rolės yra
**UX profiliai iš capability bundles**, kurių negalima realizuoti vien paslepiant
mygtukus. Kol serverio autorizacija nepatvirtinta, naujas profilis negali gauti
Production veiksmo.

| Profilis | Numatytas startas | Desktop prioritetas | Mobile prioritetas | Pagrindinės capability |
|---|---|---|---|---|
| Savininkas / administratorius | Today + platform alerts | visos eilės, verslo stop, release/terms, komanda | kritinių išimčių peržiūra ir patvirtinimas | policy override tik audituojamai, users, release, configuration |
| Bylos vadybininkas | Mano Today | bylos sprendimai, klientas, komunikacija, komercinė eiga | triage, skambutis/žinutė, mažos rizikos veiksmai | case edit, communication draft/send pagal vartus, workflow commands |
| Komercijos peržiūrėtojas | Pasiūlymai peržiūrai | RF provenance, kainodara, quote/contract review and commit | approve/reject komentaras; sudėtingas redagavimas desktop | measurement review, pricing/quote approval, contract review |
| Dispečeris | Nepriskirti ir šiandienos darbai | grafikas, priskyrimas, pajėgumas, konfliktai | perplanavimas ir incidentų triage | assign, schedule, reschedule, handoff |
| Lauko darbuotojas | Mano šiandienos darbai | supervisor read-only arba įrodymų peržiūra | vienas vizitas, vienas žingsnis, nuotraukos, checklist, offline/sync | tik priskirto darbo leidžiami perėjimai ir evidence upload |
| Finansai | Sąskaitos ir completion queue | amount basis, official export, payment, warranty | peržiūra/acknowledgement; ne pilna apskaita | invoice approve/export/status, warranty issue pagal vartus |
| SEO redaktorius / peržiūrėtojas | Turinio eilė | temos, redaktorius + preview, QA, kalendorius, performance | triage, approve/reject, schedule | generate, edit, review, schedule/publish pagal atskirtas teises |
| Operacijų administratorius | Incidentai | jobs, invariants, integrations, audit/correlation, runbooks | incident acknowledgement ir saugus retry | job inspect/retry/cancel, invariant scan, health |
| Auditorius | Išsaugomas read-only rodinys | versijos, istorija, export | tik skaitymas | read-only audit/document provenance |

### Veiksmų rodymo taisyklė

1. Pirma filtruojama pagal serverio capability, tada pagal esamą būseną ir
   transition prielaidas.
2. Neleistinas ir neaktualus veiksmas slepiamas.
3. Rolei leistinas, bet dabar blokuotas **tikėtinas kitas veiksmas** rodomas
   disabled su priežastimi, owner ir deep link į pataisymą.
4. Override niekada nėra įprastas CTA. Jis turi atskirą capability, privalomą
   reason, review/commit ir audit event.
5. Mobile nereiškia mažesnių teisių savaime; ribas nustato capability ir
   kontekstas. Tačiau didelės rizikos/sudėtingas redagavimas gali aiškiai
   reikalauti desktop dėl patikimos peržiūros.

### Lauko darbuotojo išimčių eiga

Happy path papildomas matomais veiksmais:

- `Negaliu tęsti` → pasirinkti blocker/saugos/scope kategoriją, įrodymą ir
  atsakingą;
- `Perduoti / reikia pagalbos` → dispečerio eilė ir savininkas;
- `Perplanuoti` → reason ir siūlomas laikas, be tylaus statuso perrašymo;
- `Klaidinga būsena` → request correction, o ne istorijos trynimas;
- `Offline` → lokali užšifruota eilė, pending žyma prie kiekvieno veiksmo,
  saugus retry ir aiškus conflict resolution;
- `Upload nepavyko` → failas/draft lieka lokaliai, matomas bandymų skaičius ir
  nereikalaujama iš naujo pildyti visos formos.

## 8. Fazuotas įgyvendinimo planas

Jokia fazė savaime nesuteikia leidimo Production. Kiekvienai fazei reikia
atskiro feature gate, atsekamo release reference, demonstracijos ir savininko
acceptance. Esamas modulio fallback į legacy išlaikomas iki parity ir UAT.

### F0 – baseline, sutartys ir sprendimų vartai

**Tikslas:** užfiksuoti tikrą būklę prieš UI keitimus.

**Darbai**

- maršrutų, kolekcijų, API komandų, rolių ir audit events machine-readable
  inventorius;
- visų `CaseNextActionKind`, WorkOrder, quote, contract, message, document ir SEO
  perėjimų matrica;
- Production duomenų read-only parity ataskaita V2 vs Next adapteriams;
- kritinių kelionių instrumentuotas paspaudimų/laiko baseline;
- target IA, terminų žodynas, capability matrix ir ADR dėl URL namespace;
- komponentų screenshot baseline 1440, 1024, 768 ir 375 px;
- RF discoverability baseline užfiksuoti realaus operatoriaus 4 techninių
  pasirinkimų kelią ir time-to-RF be instrukcijos;
- ADR dėl audit history projekcijos, Customer/Property projekcijų ir galimos
  vėlesnės kanoninės migracijos;
- priklausomybių atkūrimas patvirtintoje izoliuotoje aplinkoje ir pilnas esamų
  testų baseline.

**Priklausomybės:** nėra.
**Vartai:** inventorius turi nurodyti kiekvienos mutacijos owner, authorization,
idempotency, audit ir fallback; neatsakyti klausimai blokuoja atitinkamą modulį,
ne viso plano dokumentavimą.

### F1 – bendras foundation ir shell

**Tikslas:** viena vizualinė ir sąveikos sistema be domeno logikos perrašymo.

**Darbai**

- suvienodinti `admin-next` tokenus kaip bendrą semantinę temą;
- pastatyti `AppShell`, responsive nav, global search contract, overlay/focus ir
  feedback komponentus;
- įgyvendinti bendrus status, owner, due, blocker, version, sync komponentus;
- `ReviewAndCommit`, `UnsavedChangesGuard`, loading/empty/error/offline būsenos;
- Storybook ar lygiavertis izoliuotas katalogas ir automatiniai a11y/visual
  testai;
- rollout registry išplėsti pagal modulį, išlaikant `legacy_only` mutacijas.

**Priklausomybės:** F0 žodynas ir IA.
**Vartai:** WCAG AA tokenų matrica, keyboard/focus testai, nėra hardcodintų
spalvų naujuose domeno komponentuose, legacy funkcija nepašalinta.

### F2 – viena Today eilė ir bylos One Card

**Tikslas:** pagrindinis operatorius dirba pagal vieną kito veiksmo modelį.

**Darbai**

- konsoliduoti Admin V2 resolverį ir Admin Next Today adapterį į vieną
  kanoninį presentation contract;
- sukurti explainable prioritization, owner/SLA/blocker ir saved views;
- WorkQueue master–detail su tiesioginiu inline arba review veiksmu;
- skaidyti bylos monolitą į loader/read-model ir domeno workbench ribas;
- vienas `NextActionCard`, stabilus process bar ir kontekstiniai tabs;
- iš konkrečios bylos tiesioginis `Atverti/Tęsti matavimą` deep link su
  išlaikytu case/RF kontekstu ir `Grįžti į bylą`;
- audit-events pagrįsta timeline su privacy-safe diff;
- migraciniai adapteriai laisvo teksto nextAction/blocker laukams.

**Priklausomybės:** F1; F0 transition/capability matrica.
**Vartai:** visi realūs `CaseNextActionKind` turi presentation ir testą; kiekviena
aktyvi byla rodo vieną vykdomą veiksmą arba konkretų blocker; Today demo
konstantų nelieka canonical režime. Operatorius be techninio URL ar instrukcijos
iš bylos pasiekia teisingą RF matavimą vienu pasirinkimu ir vienu pasirinkimu
grįžta į tą pačią bylos vietą.

### F3 – RF, komercija, dokumentai ir komunikacija

**Tikslas:** vientisa, nekintama grandinė nuo patvirtinto matavimo iki pristatyto
dokumentų paketo.

**Darbai**

- atskirai su RF owner užbaigti ir patvirtinti Phase E exact-hash komandą;
- RF snapshot → immutable RoofMeasurement → quote draft tiltas;
- visuose RF load/calculate/add-to-offer žingsniuose lokalizuotas, konkrečiai
  pavadintas loading/progress, retry ir grįžimo/koregavimo kelias;
- quote/contract/change/invoice/warranty `VersionedArtifact` ir bendras compare;
- server-side paginuojamas dokumentų registras su RF evidence;
- `DocumentManifest`, current/old banner ir package preflight;
- vienas communication thread, recipient/content preview, delivery events ir
  recovery;
- `window.confirm` pakeisti risk-specific review/commit svarbiuose keliuose.

**Priklausomybės:** F2 state/action/history; RF One Card Phase E owner approval;
esami measurement ir quote engine invariantai.
**Vartai:** joks patvirtintas artefaktas neperrašomas; RF kilmė atsekama
snapshot→measurement→quote→package; pakartotas command nedubliuoja; add-to-offer
nesiunčia klientui.

### F4 – darbų planavimas ir field mobile

**Tikslas:** tas pats serverinis lifecycle dispečeriui ir darbuotojui, įskaitant
išimtis.

**Darbai**

- DispatchWorkspace su nepriskirtų eile, grafiku, capability/pajėgumu ir
  conflict detection;
- bendras VisitState presentation contract virš esamų WorkOrder perėjimų;
- MobileTaskRunner su required evidence ir vienu būsenos CTA;
- PWA/offline duomenų apimties ir saugojimo threat model;
- pending command queue, upload retry, conflict resolution, reconnect ir
  supervisor handoff;
- „negaliu tęsti“, saugos, scope change, cancellation ir reschedule pirmos
  klasės keliai.

**Priklausomybės:** F1 komponentai, F2 blocker/history, serveriniai WorkOrder
guard'ai.
**Vartai:** offline niekada nerodo false success; kiekvienas perėjimas turi
timestamp/actor/source/audit; nepatvirtintas scope change blokuoja tęsimą taip
pat UI ir API.

### F5 – SEO studija

**Tikslas:** sujungti temą, generavimą, žmogaus review, planavimą ir rezultatą.

**Darbai**

- turinio pipeline ir išsaugomi rodiniai pagal statusą/due/owner;
- topic backlog/import, generation jobs ir klaidų recovery custom admin;
- editor + preview + sources/license + quality gate viename workbench;
- kalendorius ir schedule/publish review;
- Search Console/lead performance ir content-audit rekomendacijos prie
  publikuoto įrašo;
- SEO editor/reviewer capability atskyrimas.

**Priklausomybės:** F1; F2 bendri queue/history modeliai. Gali vykti lygiagrečiai
su F3/F4, jei nekeičiami bendri kontraktai.
**Vartai:** negalima publikuoti apeinant esamus quality/reviewer/time vartus;
cron/API/UI naudoja tą pačią transition politiką.

### F6 – operacijos, archyvas, komanda ir esybių projekcijos

**Tikslas:** atskirti kasdienes operacijas nuo konfigūracijos ir sąžiningai
parodyti klientų/objektų modelį.

**Darbai**

- OperationsConsole darbams, integracijoms, invariantams, retry/cancel ir
  release health;
- archyvo/šiukšlinės/retention istorija, blokatoriai ir atkūrimo paaiškinimas;
- capability bundles, employee capacity ir auditoriaus read-only profilis;
- `Customer` ir `Property` read-model projekcijos su aiškia canonical-source
  žyma;
- atskiras ADR ir migracijos prototipas dėl tikrų Customer/Property esybių,
  dedup, multi-property ir backfill. Kanoninė migracija nėra automatinė šios
  fazės dalis.

**Priklausomybės:** F0 duomenų ADR, F1 shell, F2 history/roles.
**Vartai:** retry yra autorizuotas ir idempotentiškas; archyvo/purge retention
neapeinama; UI nesukuria klaidingo „vienas klientas“ identiteto iš nepatikimos
deduplikacijos.

### F7 – hardening, UAT ir laipsniškas rollout

**Tikslas:** įrodyti funkcinį parity ir saugiai pakeisti legacy paviršius.

**Darbai**

- visos kritinės grandinės E2E happy path ir exception scenarijai;
- visual regression 1440/1024/768/375, Windows/browser matrica;
- klaviatūros, screen reader, contrast, zoom 200/400 %, reduced motion ir touch
  testai;
- apkrovos testai Today, global search, document registry ir timeline;
- canonical vs legacy shadow-read parity ir migracijos duomenų ataskaita;
- pilotinės rolės UAT, runbook, monitoring, rollback/fallback repeticija;
- rollout po vieną modulį: internal preview → owner UAT → ribotas pilotas →
  explicit Production GO → stebėjimas → legacy read-only → vėlesnis pašalinimo
  sprendimas.

**Priklausomybės:** atitinkamos F2–F6 fazės.
**Vartai:** nulis P0/P1 defektų, pasirašyti acceptance scenarijai, parity,
performance ir a11y biudžetai, patikrintas fallback. Be atskiro GO – jokių
Production mutacijų ar redirect.

### Testų strategija pagal sluoksnį

| Sluoksnis | Būtini testai |
|---|---|
| Būsenų/taisyklių branduolys | transition lentelės, exhaustive action mapping, prioritetų property testai, blocker derivation, timezone/SLA ribos |
| Komandos | authorization, CAS/stale revision, idempotency, hash mismatch, duplicate webhook, partial failure, audit/correlation |
| Read model/adapteriai | canonical vs fixture/legacy parity, missing/null/old data, locale, PII redaction |
| Komponentai | visos loading/empty/error/blocked/disabled/success būsenos, focus, dialog semantics, keyboard, mobile |
| Integracija | snapshot→measurement→quote; quote→package→delivery; contract→work; completion→invoice/warranty; audit projection |
| E2E | inquiry→measurement→offer; offer→contract→work; worker→documentation→completion; question/recovery; SEO; archive; operational retry |
| Visual/a11y | keturi viewportai, dark contrast, 200/400 % zoom, no overflow, axe + manual screen-reader critical paths |
| Atsparumas | offline/reconnect/conflict, double click, stale tab, failed upload/email/webhook, retry po proceso restart |

Repo jau turi daug unit/integration testų, bet rasti tik du Playwright scenarijų
failai ir nėra pilnų kritinių verslo grandinių. Todėl vien esamo testų skaičiaus
nepakanka rollout sprendimui.

### Fazavimo rizikos ir mažinimas

| Rizika | Poveikis | Mažinimas / vartas |
|---|---|---|
| Trečias UI shell vietoje konsolidacijos | nuolatinis drift ir dviguba priežiūra | vienas bendras shell; adapter-first; jokio `admin-v3` klono |
| Preview fixtures slepia duomenų spragas | demo veikia, Production ne | canonical parity, fixtures tik aiškiai pažymėtam demo, fail-closed gate |
| State taisyklės lieka išbarstytos | UI ir API leidžia skirtingus veiksmus | viena transition matrica ir serveriniai command handleriai |
| Stored ir derived nextAction išsiskiria | klaidinga eilė/CTA | typed resolver – truth; tekstas tik pastaba; migraciniai invariantai |
| Audit diff atskleidžia PII | privatumo incidentas | allowlist/redaction history projection, hashes lieka vientisumui |
| Role UI imituoja saugumą | neautorizuota mutacija | backend capability prieš UI rollout; deny testai kiekvienai komandai |
| Customer/Property big-bang migracija | dedup ir istorijos sugadinimas | pradžioje read projections, atskiras ADR/backfill/rollback |
| RF ir komercijos kontraktai išsiskiria | pasenęs ar neteisingas pasiūlymas | exact ID/version/hash, owner-owned Phase E, contract tests |
| Kelių įrašų dalinė RF komanda | measurement be quote arba dublikatai | DB transaction arba command ledger + resumable/compensating job |
| Mobile offline saugo jautrius duomenis | saugos ir sync konfliktai | threat model, minimali šifruota apimtis, expiry, remote revoke, explicit conflict |
| Dokumentų registras neplečiamas | lėti/neišsamūs rezultatai | server-side query/pagination, bendras artifact index arba patikrinta projekcija |
| Didelis case refactor | regresijos ir užsitęsęs rollout | vertical slices, contract tests, per-module fallback, legacy parity |

### Galutiniai priėmimo kriterijai

Planą galima laikyti įgyvendintu tik kai:

1. yra vienas custom admin shell ir vienas žodynas; techninis Payload admin lieka
   aiškiai atskirtas;
2. bet kuri aktyvi byla pirmame ekrane rodo vieną vykdomą veiksmą arba konkretų
   blocker su owner ir pašalinimo keliu;
3. Today apima visus realius bylos veiksmus, paaiškina reitingą ir canonical
   režime neturi demo konstantų;
4. stage, case state, visit state, priority, risk, blocker ir version nėra
   painiojami nei tekste, nei spalvoje;
5. kiekviena svarbi mutacija tikrinama serveryje, yra autorizuota,
   idempotentiška, CAS saugi ir sukuria koreliuojamą audit event;
6. istorija rodo privatumą saugantį `kas / ką / nuo → į / kada / kodėl /
   rezultatas`, o ne vien entity timestampą;
7. visi patvirtinti/išsiųsti/pasirašyti artefaktai yra nekintami ir turi aiškų
   current/old bei compare modelį;
8. patvirtintas RF snapshot vienu veiksmu sukuria atsekamą measurement ir quote
   draft, bet nieko nesiunčia ir nekeičia ankstesnių versijų;
9. darbuotojo mobile turi pending/offline/conflict/retry ir visus svarbius
   exception kelius; false success nėra;
10. rolės remiasi backend capability, o ne vien paslėptais mygtukais;
11. kritinės grandinės praeina E2E, responsive, a11y, atsparumo ir parity testus;
12. kiekvienas modulis gali saugiai grįžti į legacy iki atskiro Production GO;
13. RF randamas tiesiai iš konkrečios bylos Next Action vienu pasirinkimu;
    diagnostinis modulių būsenos puslapis nėra operatoriaus kelio dalis;
14. kiekviena ilgiau nei 150 ms trunkanti navigacija ar komanda rodo lokalizuotą
    konkretaus veiksmo loading būseną, nepalieka seno ekrano kaip current ir turi
    retry bei grįžimo/koregavimo kelią.

## Patikrinti rinkos principai

Planui perimami sąveikos modeliai, ne svetimas vizualinis dizainas:

- Salesforce – kontekstinis Next Best Action, prioritetu/gebėjimu grįstas darbų
  paskirstymas ir SLA milestones:
  [Next Best Action](https://help.salesforce.com/s/articleView?id=sf.nba_implementation_checklist.htm&language=en_US&type=5),
  [Omni-Channel](https://help.salesforce.com/s/articleView?id=omnichannel_routing.htm&language=en_US),
  [Case milestones](https://help.salesforce.com/s/articleView?id=service.cases_milestones.htm&language=en_US&type=5).
- Dynamics 365 – prioritetizuota work list bei stabilaus work order, substatuso,
  booking statuso ir offline sync atskyrimas:
  [Sales work list](https://learn.microsoft.com/en-us/dynamics365/sales/prioritize-sales-pipeline-through-work-list),
  [Field Service lifecycle](https://learn.microsoft.com/en-us/dynamics365/field-service/work-order-status-booking-status),
  [Offline sync](https://learn.microsoft.com/en-us/dynamics365/field-service/mobile/offline-data-sync).
- ServiceNow – kontekstinis playbook, stage-gate ir vaidmenimis/pajėgumu grįstas
  paskirstymas:
  [Recommended playbooks](https://www.servicenow.com/docs/r/customer-service-management/ra-execute-playbooks.html),
  [Case routing](https://www.servicenow.com/docs/r/customer-service-management/case-routing-and-asign.html).
- HubSpot – bendros task queues, pipeline perėjimo taisyklės ir property history:
  [Task queues](https://knowledge.hubspot.com/tasks/use-task-queues),
  [Pipeline rules](https://knowledge.hubspot.com/object-settings/set-up-pipeline-rules),
  [Property history](https://knowledge.hubspot.com/records/view-record-property-history).
- Procore – nekintama sistemos versija, aiškus senos versijos perspėjimas,
  `from/to` istorija ir offline dokumentų rinkiniai:
  [Versions](https://support.procore.com/products/online/user-guide/project-level/document-management/tutorials/view-documents-in-the-document-management-tool),
  [Change history](https://support.procore.com/products/online/user-guide/project-level/document-management/tutorials/view-change-history-for-documents-in-the-document-mangement-tool),
  [Offline documents](https://support.procore.com/procore-mobile-ios/user-guide/document-management-ios/tutorials/sync-and-download-documents-ios).
- DocuSign – append-only envelope events, pasirašymo įrodymas ir idempotentiški
  integration events:
  [Audit events](https://www.docusign.com/blog/developers/common-api-tasks-parsing-envelopes-audit-events),
  [Transaction evidence](https://www.docusign.com/trust/security/transaction-data-use),
  [Connect events](https://www.docusign.com/blog/developers/connect-20).
- Linear – struktūrinis `blocked by / blocks`, stabilios workflow kategorijos ir
  vienas aiškiai atsakingas žmogus:
  [Issue relations](https://linear.app/docs/issue-relations),
  [Workflow statuses](https://linear.app/docs/configuring-workflows),
  [Assignment](https://linear.app/docs/assigning-issues).

## Sąsaja su esamais planais

- `docs/admin-v2-case-workspace-v3-spec.md` lieka detalesnė bylos
  prezentacijos specifikacija. Šis planas jos nekopijuoja į naują `admin-v3`, o
  įtraukia į F2.
- `docs/implementation/admin-next-roof-fusion-one-card-v2-plan-2026-09-04.md`
  lieka vienintelis RF sąveikos ir Phase E/F saugos owner. Šio plano F3 tik
  aprašo jo nekintamą integracijos ribą į komercinį pipeline.
- Esami `phase-a*`, `phase-e*`, Admin Next foundation ir operaciniai planai yra
  įgyvendinimo istorija bei detalūs įrodymai. Jei jie prieštarauja šiam tiksliniam
  žodynui, prieš kodą reikia ADR, o ne tylaus perrašymo.

## Priedas A – pilnas dabartinės apimties inventorius

Šis priedas užfiksuoja, kokius paviršius ir domenus planas turi apimti. Jis nėra
naujos schemos pasiūlymas.

### Registruotos Payload kolekcijos

Pagal `src/payload.config.ts:162` registruota ši administruojama duomenų apimtis:

| Grupė | Kolekcijos | Tikslinis UI savininkas |
|---|---|---|
| Tapatybė ir organizacija | `Users`, `Projects` | Komanda ir teisės / techninis admin |
| Įėjimas ir bylos | `Leads`, `Messages`, `CustomerContractRequests` | Today, Bylos, Komunikacija |
| Matavimas ir kainodara | `RoofMeasurements`, `PriceCalculations`, `Quotes` | Bylos → RF/Matavimas/Komercija |
| Susitarimai | `Contracts`, `ChangeAgreements` | Bylos → Sutartys/Pakeitimai; Dokumentai |
| Darbų vykdymas | `WorkOrders` | Darbai, Mobile, Bylos |
| Užbaigimas | `InvoiceRecords`, `OfficialInvoices`, `Warranties` | Bylos → Completion; Dokumentai; Finansų eilė |
| Turinys | `Posts`, `SeoTopics`, `SeoRuns` | SEO studija |
| Valdymas | `AuditEvents`, `OperationalJobs` | Istorija, Operacijos |
| Roof Fusion Preview | `RoofFusionSnapshots`, `RoofFusionCommands`, `RoofFusionWorkbenchDrafts` | RF One Card Preview; vėliau tik patvirtinta F3 riba |

Svarbi riba: nėra atskiros `Customer` ar `Property` kolekcijos. Kliento kontaktas
ir objekto adresas laikomi `Leads`; Admin Next capability registry taip pat juos
deklaruoja kaip `leads` projekcijas. Todėl pirmoji naujo UI versija gali pateikti
„Klientai ir objektai“ read model, bet multi-property, dedup ar cross-case
identiteto negali laikyti patikimu be atskiros duomenų migracijos.

### Admin ir išoriniai paviršiai

| Paviršius | Maršrutai | Pastaba |
|---|---|---|
| Custom Admin V2 | `/admin-v2`, `/cases`, `/cases/[id]`, `/contract-requests`, `/offers`, `/contracts`, `/work`, `/documents`, `/archive`, `/blog`, `/blog/[id]`, `/employees`, `/settings`, `/next-preview` po `/admin-v2` | Pagrindinė realaus darbo patirtis ir mutacijos |
| Admin Next Preview | `/admin-next-preview/today`, `/cases/[caseId]`, `/cases/[caseId]/measurements/[measurementId]`, `/cases/[caseId]/documents/preflight`, `/roof-fusion/uat` | Feature-gated; registruoti moduliai `adapter_ready`, mutacijos `legacy_only` |
| Payload techninis admin | `/admin/[[...segments]]` | Techninis backoffice ir dalis funkcijų, kurių nėra V2; ne tikslinė operatoriaus patirtis |
| Darbuotojas | `/user`, `/user/arbeid/[id]`, `/user/login` | Priskirtų darbų mobile-first eiga |
| Klientas | `/tilbud/[token]`, `/endring/[token]`, `/kontakt/[token]`, `/henvendelse/[id]` | Išorinės pasiūlymo, pakeitimo, kontakto ir užklausos grandys; admin būsenos turi sutapti su jų įvykiais |

### Serverinių veiksmų apimtis

Admin API sugrupuota pagal atsakomybę:

- bylos: lead veiksmai, lifecycle, nuotraukos, commercial package ir intake;
- matavimai: kandidatas, manual versija, approval, evidence, area override,
  kainos skaičiavimas;
- RF Preview: workbench draft, capture ir height adapteriai;
- komercija: quotes, PDF, sutartys, signatures, contract requests ir pakeitimai;
- komunikacija: draft/approve/send/retry/cancel, information request, manual
  contact recovery ir delivery būsena;
- darbai: WorkOrder sukūrimas, priskyrimas, grafikas, statusai, completion review
  ir worker media;
- užbaigimas: invoice records, official export, warranties ir bylos uždarymas;
- SEO: generate, topics, post transition, performance, draft/publish cron;
- platforma: settings, terms activation, platform health, invariants,
  operational jobs, media/blob;
- išoriniai įvykiai: kliento tokenų veiksmai, webhooks ir periodiniai job handleriai.

Daug administravimo mutacijų realizuota dideliuose route handleriuose. F0 turi
inventorizuoti ne tik URL, bet ir tikrą domeno servisą, authorization, validaciją,
side-effects ir auditą; UI perstatymas neturi kopijuoti logikos į klientinius
komponentus.

### Dabartinė paieška, eilės ir operacijos

- V2 dashboard „attention“ sujungia kelis masyvus ir nukerpa iki 30, bet nėra
  vienos globaliai pagal riziką, SLA ir laukimo laiką surikiuotos eilės
  (`src/lib/admin-v2/dashboard.ts:395`).
- Globaliai atrodanti V2 paieška tikrina lead, quote, contract, WorkOrder,
  invoice, warranty, measurement ir change. Ji neapima messages, posts,
  employees ar contract requests (`src/lib/admin-v2/dashboard.ts:425`).
- Today canonical adapteris keturias V2 eiles grubiai pervadina į keturis
  veiksmus; skirtinga problema gali tapti tuo pačiu „measurement review“.
- Today KPI ir dienos grafiko dalis lieka demo konstantomis net canonical eilėje
  (`src/components/admin-next/admin-next-today.tsx:114`).
- `OperationalJobs` saugo būseną, idempotency, correlation, bandymus ir
  sanitizuotą klaidą, bet custom V2 nerasta job detail/retry/cancel darbo vieta.
- Invariant scan API yra, tačiau jo operacinis rezultatas daugiausia lieka
  techniniame Payload dashboard.

### Dabartinės dokumentų ir istorijos ribos

- Dokumentų loaderis sujungia quote, contract, change, measurement, work media,
  invoice ir warranty, bet RF snapshotų neįtraukia.
- Jis iki 500 įrašų iš kelių kolekcijų krauna be tikros pagination, puslapis
  loaderį kviečia du kartus, o filtravimas vyksta atmintyje. Tai yra performance
  ir pilnumo rizika, ne tik vizualinė problema.
- Measurement dokumentui daugiausia naudojamas map image, ne visas provenance ir
  evidence snapshot.
- Case quote/contract versijų grandinė jau skiria working/effective/historical,
  bet tas pats modelis netaikomas visiems artefaktams.
- `AuditEvents` yra immutable ir turi actor/action/entity/correlation/field
  names/hash, tačiau bylos timeline daugiausia rekonstruojama iš entity
  timestampų; Admin Next adapteryje aktorius gali būti hardcodintas kaip
  „Takfornyelse CRM“. Todėl pilno tikro istorijos UI šiuo metu nėra.

### Dabartinės mobile ribos

Esamas darbuotojo portalas leidžia priskirto darbo būsenas, precheck, HMS/scope,
before/after nuotraukas, completion ir retry. Tačiau nerasta PWA/service worker,
background sync ar offline komandų eilės. Lokalus completion draft nėra tas pats,
kas patikimas offline veiksmų modelis. Ypač rizikingi scenarijai:

- ryšys dingsta po statuso submit;
- nuotrauka įkeliama dalinai;
- tas pats darbas pakeičiamas dispečerio ir darbuotojo;
- operatorius mato success, nors serveris komandos negavo;
- pakartotas bandymas sukuria dublikatą arba neteisingą laiką.

### Dabartinė SEO riba

Post būsenos ir kokybės vartai apima draft, AI QA, žmogaus review, approval,
reject, schedule ir publish. V2 turi sąrašą, editorių ir review panelį, tačiau
topic import/performance įrankių dalis yra tik Payload dashboard. V2 nėra temų
backlog, datų/statusų paieškos, pagination, turinio kalendoriaus ar vienos
performance darbo vietos.

### Testų baseline

Statinis failų inventorius rado maždaug 320 test/spec failų. Apytiksliai:

| Sritis | Failai |
|---|---:|
| Admin V2 komponentai | 17 |
| Admin Next komponentai | 14 |
| `lib/admin-v2` | 22 |
| `lib/admin-next` | 12 |
| Roof Fusion | 26 |
| Work orders | 8 |
| Blog/SEO | 17 |
| Admin API | 18 |
| Worker API | 3 |
| Migracijos | 22 |
| Playwright E2E | 2 |

Tai failų, ne scenarijų ar coverage skaičius. Esami E2E daugiausia tikrina smoke,
autentikaciją, bazinę admin/worker prieigą ir responsive higieną. Nerasta pilnų
E2E grandinių:

- inquiry → measurement/evidence → pricing → offer;
- offer acceptance → contract/signature → WorkOrder;
- worker precheck → work → documentation → invoice/warranty;
- customer question/cancellation recovery;
- document version/history;
- SEO review/publish;
- archive/restore/purge;
- operational failure/retry.

Šio audito metu testai nebuvo realiai paleisti dėl worktree trūkstamų
priklausomybių; todėl visi skaičiai ir būsena F0 turi būti pakartotinai patikrinti
izoliuotoje, atkuriamoje aplinkoje.

### Aiškiai nerastos galimybės

| Galimybė | Audito rezultatas |
|---|---|
| Kanoninės Customer ir Property esybės | nerasta |
| Production approved RF snapshot → offer komanda | nerasta; sąmoningai gated |
| Pilna audit-event paremta `from/to` bylos istorija | nerasta |
| Atskiras communication inbox | nerasta |
| Admin Next Production mutacijos | nerasta; registry nurodo `legacy_only` |
| Patikimas worker offline/PWA/background sync | nerasta |
| Custom Admin operational-job detail/retry/cancel | nerasta |
| Pilnos kritinės verslo grandinės E2E | nerasta |

## Sprendimai, kuriems reikia savininko patvirtinimo

Rekomenduojami defaultai po šio plano peržiūros:

1. **Shell strategija:** evoliucionuoti esamą custom admin per modulio rollout,
   ne kurti trečią aplikaciją.
2. **URL:** F0 palikti dabartinį namespace ir priimti ADR tik po Payload `/admin`
   konflikto bei redirect analizės.
3. **Klientai/objektai:** pirmiausia saugios read-model projekcijos; kanoninė
   schema – atskiras duomenų migracijos sprendimas.
4. **Rolės:** capability bundles ir serverinis enforcement prieš role-specific
   Production UI.
5. **Audit diff:** allowlist/redacted history projection, ne raw snapshotai.
6. **RF:** `snapshot ID + revision + schema + exact hash` yra vienintelis
   leidžiamas komercinio tilto šaltinis; add-to-offer kuria draft ir nesiunčia.
7. **Mobile offline:** nepradėti PWA kaip vien vizualinės funkcijos; pirmiausia
   threat model, duomenų apimtis ir konfliktų semantika.

## Įgyvendinimo autorizacijos būsena

2026-09-04 savininkas davė aiškų `GO` pradėti. Pagal patvirtintą fazavimą tai
autorizuoja tik **F0 baseline, ADR, testų atkūrimą izoliuotoje aplinkoje ir
įgyvendinimo backlogą**. Vis dar neleidžiama:

- pradėti F1–F7 aplikacijos implementacijos;
- vykdyti duomenų ar Payload schemos migracijų;
- keisti Production konfigūracijos, duomenų, el. laiškų, kainodaros ar routes;
- įjungti Admin Next mutacijas;
- užbaigti RF Phase E/F ar sujungti RF su pasiūlymais;
- deployinti ar keisti release vartus.

F0 darbo rezultatai registruojami atskiruose `docs/implementation/admin-unified-f0-*`
artefaktuose. Perėjimui į F1 reikės aiškaus F0 vartų rezultato ir savininko
sprendimo; šis `GO` nėra Production `GO`.
