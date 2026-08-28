# Case Workspace V3 UX specifikacija

**Būsena:** parengta implementavimui, kodas nekeistas

**Baseline:** `29e51a76f9edfe132ab503bc7b6266cbfd76b822`

**Apimtis:** `/admin-v2/cases/[id]`, susiję `admin-v2` komponentai ir kliento klausimo/pasirašymo tęstinumas

**Kalbos:** administratoriui LT ir EN, esamas NB palaikymas išsaugomas; klientui NB

**Neleidžiama šioje fazėje:** naujas backend, DB schema, mutacijų semantikos keitimas, produkcijos įjungimas

## 1. Tikslas

V3 turi paversti bylą viena operacine darbo vieta, kur administratorius bet kuriame ekrano plotyje iš karto gali atsakyti į keturis klausimus:

1. Kuri tai byla, klientas ir vykdoma dokumento versija?
2. Kokia viena svarbiausia dabartinė būsena arba kliūtis?
3. Koks yra vienas saugus kitas veiksmas?
4. Kur matyti proceso įrodymai, dokumentai ir recovery istorija?

V3 nėra naujas `/admin-v3`, paralelinis CRM ar verslo logikos perrašymas. Tai laipsniškas esamo `admin-v2` presentation sluoksnio pertvarkymas, išsaugant backend saugos ribas, auditą, versijų hash ir idempotentiškumą.

## 2. Nekeičiami saugos invariantai

- Galiojanti ir vykdoma dokumento versija visada lieka atskirtos.
- Pasirašyta istorinė versija nekoreguojama ir netrinama.
- Ekonominiams bei pasirašymo veiksmams serveris lieka galutine sprendimo riba.
- `expectedRevision`, dokumento versija/hash ir žinutės `updatedAt` neprarandami UI refaktoriaus metu.
- `approve_send` išlieka vienas atominis teksto išsaugojimo ir patvirtinimo siųsti veiksmas.
- Dvigubas paspaudimas ar transporto retry negali sukurti antro veiksmo.
- Kliento pasirašymas lieka sustabdytas iki tiesioginio atsakymo į konkretų klausimą provider-confirmed `delivered` būsenos.
- Timeline ir dokumentų nuorodos negali spėti „naujausios“ versijos: jos turi atidaryti tik konkretų įrašą arba snapshot.
- Techniniai ID, hash ir Payload nuorodos pagal nutylėjimą lieka po „Techninė informacija“.

## 3. Dabartinės struktūros auditas

### 3.1 Kas jau tinkama pakartotinai naudoti

- `src/lib/admin-v2/case-read-model.ts` pateikia vieną `AdminCase` modelį, versijų kontekstą ir deterministinį normalios bylos `nextAction`.
- `src/lib/admin-v2/case-commercial-context.ts` atskiria vykdomą ir galiojančią komercinę versiją.
- `src/lib/admin-v2/message-draft-request.ts` užrakina atominį `approve_send` ir revision laukus.
- `src/lib/messages/customer-question-state.ts` teisingai atskiria `queued`, provider-accepted `sent` ir provider-confirmed `delivered`.
- `src/components/admin-v2/customer-question-action-visibility.ts` jau neleidžia vienu metu rodyti įprastų ir recovery AI/manual veiksmų.
- `src/components/quotes/customer-quote.tsx` jau turi per-submission UUID, inline klaidas, fokusą/scroll po rezultato bei pending būsenos patikrą per focus, visibility ir 30 s intervalą.

### 3.2 Prioritetizuotos dabartinio UI spragos

#### P0

Statiniame kode P0 saugos, negrįžtamo duomenų praradimo ar neautorizuoto veiksmo spragų nerasta. P0 išvada galioja tik šiam read-only auditui; ji nėra manual staging UAT pakaitalas.

#### P1

1. **„Kitas veiksmas“ turi daugiau nei vieną matomą tiesos šaltinį.** Bylos puslapis kliento klausimu perrašo `caseData.nextAction` (`page.tsx:327-354`), command bar rodo perrašytą tekstą (`442-454`), o AI skiltis vėl rodo neperrašytą `caseData.nextAction` (`746-752`). Jei vienu metu yra klausimas ir teisinis `CUSTOMER_CANCELLATION_REQUEST` blocker, klausimo UI gali vizualiai nustelbti read-model aukštesnio prioriteto atšaukimo peržiūrą. Priėmimas: vienas pure resolveris grąžina vieną `primaryState`; command bar, pagrindinė darbo sritis ir timeline naudoja tą patį rezultatą.

2. **Aktyvus klausimas neužrakina kitų interaktyvių žinučių editorių.** Bendras next-action panel slepiamas, kai yra unresolved klausimas (`page.tsx:505`), tačiau messages skiltis vis tiek renderina kitus outbound `draft` kaip pilnus `MessageDraftEditor` (`1000-1040`). Administratorius gali matyti kelis siuntimo CTA, nors ekranas deklaruoja vieną pagrindinę kliūtį. Priėmimas: unresolved klausimo metu tik jo tiesioginis reply editorius yra interaktyvus; kiti draft rodomi kaip read-only santraukos su nuoroda į jų vėlesnį darbą.

3. **Timeline tiesioginio klausimo reply nuoroda gali būti neveikianti.** Read-model kiekvienai žinutei kuria `#message-{id}` (`case-read-model.ts:596-604`), bet puslapis pašalina `displayedReply` iš messages sąrašo (`page.tsx:1002`) ir question workbench nesukuria tokio anchor. Priėmimas: kiekvienas vidinis timeline `href` egzistuoja renderintame DOM ir fokusuoja tikslinę antraštę; klausimo bei reply įvykiai veda į vienintelį question workbench.

4. **Admin klausimo aptikimas remiasi iki 100 bendrų žinučių.** Bendras read-model query turi `limit: 100` (`case-read-model.ts:722`), o admin puslapis unresolved klausimą skaičiuoja iš `caseData.messages`. Ilgoje byloje senesnis dar neišspręstas klausimas gali nepatekti į darbo vietą, nors kliento pusė naudoja atskirą neribotą exact-question loaderį. Priėmimas: `AdminCase` gauna pirmos klasės `customerQuestionContext`, apskaičiuotą exact klausimo/direct-reply užklausa, nepriklausomai nuo bendros istorijos limito.

5. **Editorio atvėrimas remiasi trimis refresh ir neturi deterministinio fokuso.** `CustomerQuestionWorkbench.refreshEditor()` kviečia refresh iš karto, po 500 ms ir po 1 500 ms (`customer-question-workbench.tsx:237-241`). Vėlesnis refresh gali pertraukti fokusą ar, pasikeitus `updatedAt`, remountinti pradėtą redaguoti editorių. Priėmimas: vienas refresh po patvirtinto prepare rezultato; pagal grąžintą `messageId` naujas editorius gauna fokusą į antraštę arba pirmą lauką. Jokio timer pagrįsto pakartotinio refresh.

6. **Operacinės klaidos editoriuje nėra semantiškai atskirtos.** `MessageDraftEditor` visą `notice`, įskaitant klaidą, skelbia `role="status"` (`message-draft-editor.tsx:451-458`) ir po stale/safety/source klaidos neperkelia fokuso į recovery paaiškinimą. Priėmimas: klaida yra `role="alert"`, sėkmė/status – viename centriniame `aria-live="polite"`; fokusas perkeliamas tik po vartotojo inicijuoto rezultato, ne per foninį polling.

7. **Warning semantinės spalvos klasės neturi tokeno.** `customer-question-workbench.tsx`, `message-draft-editor.tsx` ir kiti komponentai naudoja `text-warning`, `border-warning`, `bg-warning`, bet `src/app/globals.css:1-43` apibrėžia tik accent, success ir danger. Priėmimas: `warning` tokenas egzistuoja ir išlaiko WCAG kontrastą; būsena visada turi tekstą bei ikoną, todėl spalva nėra vienintelis signalas.

#### P2

1. Dabartinė timeline yra naujausių įvykių feed, o ne proceso modelis (`case-read-model.ts:1220-1346`); joje nematyti nepasiektų etapų, dabartinio etapo ir blockerio šakos.
2. Naujausias jau pristatytas klausimas vis dar renderinamas pagrindinėje next-action zonoje kartu su tikru kitu veiksmu (`page.tsx:469` ir `505`). Delivered įrodymas turi tapti kompaktišku praeito etapo patvirtinimu, o ne antra pagrindine būsena.
3. `Status` badge visuomet naudoja tą patį accent toną (`page.tsx:101-119`), todėl `failed`, `blocked`, `delivered` ir neutrali būsena vizualiai vienodos.
4. Timeline turi hard-coded norvegiškus fallback tekstus, pvz. `Melding`, `Manuell kontakt`, `Takmåling`, `Prisberegning`, `Fiken-faktura` (`case-read-model.ts:1227-1335`). `CaseVersionHistory` turi nelokalizuotus `Sum` ir `Hash` (`case-version-history.tsx:91`, `158`).
5. Klausimo tekstai dubliuoti puslapyje, workbench ir editoriuje, todėl LT/EN/NB reikšmės gali išsiskirti.
6. Mobile ir desktop shell rodo tekstinį `TF`, nors repo turi oficialius `public/brand/takfornyelse-logo.png` ir `takfornyelse-mark.png` (`layout.tsx:21`, `36`).
7. Dabartinė horizontali section nav neįtraukia AI bei changes skilčių, nerodo dabartinio proceso etapo ir telefone reikalauja horizontalaus slinkimo (`page.tsx:607-630`).

## 4. Tikslinė informacijos architektūra

### 4.1 Desktop, nuo 1280 px

```text
┌────────────────────────────────────────────────────────────────────┐
│ Global admin header                                                │
├────────────────────────────────────────────────────────────────────┤
│ Sticky case bar: logo | #16 / customer | working/effective | state│
│                                      [shortcut to primary action]  │
├────────────────────────────────────────────────────────────────────┤
│ Case summary: owner, due, service, working/effective, amounts      │
├───────────────────────────────────────┬────────────────────────────┤
│ PRIMARY WORKBENCH                     │ PROCESS                     │
│ one state, evidence, blocker, one CTA │ stages + exact documents   │
│ or the sole customer-question editor │ exception/recovery branch  │
├───────────────────────────────────────┴────────────────────────────┤
│ Context sections: customer, measurement, commercial, messages...  │
├────────────────────────────────────────────────────────────────────┤
│ Collapsible chronological history / technical information         │
└────────────────────────────────────────────────────────────────────┘
```

- Sticky bar ir primary workbench yra vienas informacinis vienetas, bet tik workbench turi mutacijos CTA.
- Sticky bar CTA yra tik in-page shortcut į `#case-primary-action`; jis pats nesiunčia request ir nėra antras operacinis mygtukas.
- Proceso skiltis desktop gali būti `22–24rem` dešinė kolona ir likti sticky tik tol, kol neuždengia footer/lifecycle turinio.

### 4.2 Tablet, 768–1279 px

- Viena kolona: sticky bar → primary workbench → horizontalus tik proceso etapų pasirinkimas → aktyvaus etapo turinys → istorija.
- Etapo pasirinkimas gali slinkti horizontaliai, tačiau dokumentų kortelės ir formos negali sukelti viso viewport slinkimo.
- Primary CTA lieka matomas be papildomo drawer.

### 4.3 Mobile, 360–375 px

```text
┌──────────────────────────────┐
│ global header + logo/menu    │ 64 px
├──────────────────────────────┤
│ sticky case summary          │ 64–72 px collapsed
│ #16 · K-16-V2 · blocked   ▼  │
├──────────────────────────────┤
│ PRIMARY STATE               │
│ concise evidence/blocker     │
│ [full-width primary CTA]     │
├──────────────────────────────┤
│ vertical process stages      │
│ ● Intake                     │
│ ● Measurement                │
│ ! Reply / recovery           │
│ ○ Signing                    │
├──────────────────────────────┤
│ selected stage/context       │
└──────────────────────────────┘
```

- Horizontal viewport overflow: `0 px` tiek 360, tiek 375 px.
- Išoriniai puslapio tarpai: ne daugiau kaip 16 px; kortelės vidiniai tarpai 16 px.
- Collapsed sticky juosta: 64–72 px. Expanded: ne daugiau kaip `45svh`, su savo vertikaliu scroll ir aiškiu uždarymo mygtuku.
- Sticky pozicija prasideda po global header ir atsižvelgia į `env(safe-area-inset-top)`.
- Primary CTA yra viso pločio ir bent 48 px aukščio; visi kiti touch target bent 44 × 44 px.
- Kliento vardas ir dokumento versija gali trumpėti vizualiai, tačiau visas tekstas turi būti pasiekiamas expanded būsenoje ir accessibility name.
- Question editor laukai yra vienos kolonos; veiksmų tvarka: `Patvirtinti ir išsiųsti`, `Išsaugoti`, AI/recovery veiksmas, `Atšaukti`. Destruktyvus veiksmas vizualiai atskirtas.

## 5. Viena pagrindinė būsena ir CTA

### 5.1 Kanoninis presentation modelis

Siūlomas naujas pure tipas, neturintis fetch ar Payload priklausomybių:

```ts
type CaseWorkspaceTone =
  "critical" | "warning" | "action" | "waiting" | "success" | "neutral";

type CaseWorkspacePrimaryState = {
  key: string;
  tone: CaseWorkspaceTone;
  statusLabelKey: string;
  titleKey: string;
  helpKey?: string;
  targetReference?: string;
  blocker?: { code: string; labelKey: string };
  evidence: Array<{ labelKey: string; value: string; href?: string }>;
  action:
    | { mode: "mutation"; kind: CaseNextAction["kind"]; targetId?: number }
    | { mode: "question"; questionId: number; replyId?: number }
    | { mode: "navigate"; href: string }
    | { mode: "wait" };
};
```

`deriveCaseWorkspacePrimaryState(caseData, customerQuestionContext)` yra vienintelis resolveris. Komponentai negali savarankiškai perrašyti `nextAction` pagal pavienį message ar statusą.

### 5.2 Prioritetų taisyklės

Tikslus prioritetas, nuo aukščiausio:

1. Archyvuota/trashed byla: read-only arba lifecycle recovery; jokių įprastų veiksmų.
2. Teisinė arba operacinė stop būsena, ypač `CUSTOMER_CANCELLATION_REQUEST`.
3. Neišspręstas kliento klausimas, kuris stabdo pasirašymą:
   - `prepare` → AI arba manual pasirinkimas viename workbench;
   - `review` → vienintelis reply editorius;
   - `queued` → laukia transporto;
   - `sent` → provider priėmė, bet pristatymas dar nepatvirtintas;
   - `delivery_failed` → retry arba typed recovery;
   - `delivered` nebėra blocker ir nepakeičia kito proceso CTA.
4. Kita failed/attention komunikacija.
5. Normalus `caseData.nextAction` iš read-model.
6. Laukimo būsena arba `none` be mutacijos CTA.

Jei yra keli blockeriai, pagrindinis rodomas workbench, o kiti pateikiami „Taip pat reikia dėmesio“ sąraše be konkuruojančių pagrindinių CTA.

### 5.3 Vieno CTA taisyklė

- `[data-case-primary-action]` gali egzistuoti tik vieną kartą.
- Sticky juostos nuoroda pažymima `[data-case-primary-shortcut]` ir tik fokusuoja/scrollina primary regioną.
- Sekcijų kortelėse esantys šalutiniai mutavimo veiksmai arba slepiami, arba disabled su tekstu „Pirmiausia užbaikite …“, kai aktyvus aukštesnio prioriteto blocker.
- Waiting ir success būsenos neturi dirbtinio CTA. Jose leidžiami tik dokumento atidarymas, statuso atnaujinimas arba recovery, jei tam yra reali operacinė prasmė.
- CTA tekstas nurodo veiksmą ir tikslą, pvz. `Patvirtinti ir siųsti T-16-V2`, ne bendrą `Tęsti`.

## 6. Vienintelis customer-question workbench ir editorius

### 6.1 Nuosavybė

- `CustomerQuestionWorkbench` yra vienintelis tiesioginio atsakymo į unresolved `customer_question` savininkas.
- Tiesioginis reply negali dar kartą būti renderinamas messages skiltyje.
- Messages skiltis rodo klausimą ir reply kaip istorijos įrašus, bet unresolved būsenoje nuoroda veda į workbench.
- Kiti outbound draft aktyvaus klausimo metu rodomi read-only; jų send/regenerate CTA neaktyvūs iki klausimo blockerio išsprendimo.
- Delivered klausimo kortelė persikelia į proceso/timeline įrodymą ir gali būti trumpai paskelbiama success regione po perėjimo, bet neužima pagrindinės būsenos nuolat.

### 6.2 Workbench būsenos

| Būsena          | Matoma informacija                                         | Galimi veiksmai                                          |
| --------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Prepare         | klausimo tekstas, gauta data, immutable dokumento versijos | vienas pasirinkimų rinkinys: AI arba manual              |
| Review          | tas pats klausimas, šaltiniai, fact warnings, subject/body | atomic send; save; polish/undo; regenerate; discard      |
| Queued          | patvirtinto atsakymo santrauka, queue būsena               | nėra send pakartojimo                                    |
| Sent            | aiškiai „provider priėmė, pristatymas nepatvirtintas“      | statuso stebėjimas, ne retry                             |
| Delivered       | pristatymo laikas/įrodymas                                 | nėra pagrindinio CTA; procesas tęsiamas                  |
| Delivery failed | tikslus atsakymas, saugi lokalizuota priežastis            | retry, jei šaltinis galioja; kitaip regenerate/manual    |
| Safety rejected | paaiškinimas be techninio prompt                           | naujas AI arba manual; įprasti veiksmai paslepiami       |
| Source changed  | konkretus pasikeitęs dokumento kontekstas, jei grąžinamas  | tik naujas AI arba manual pagal naują šaltinį            |
| Stale revision  | paaiškinimas, kad byla/žinutė pakeista                     | vienas refresh ir naujo modelio peržiūra, ne blind retry |

### 6.3 Fokusas ir dirty state

- Prepare sėkmė → vienas `router.refresh()` → fokusuojama `#question-reply-editor-title` arba subject laukas.
- Workbench remount key yra `messageId`; `updatedAt` naudojamas CAS, bet vien serverio background update negali automatiškai sunaikinti dirty teksto.
- Gavus naujus props tam pačiam `messageId`, dirty editorius rodo „Serveryje yra naujesnė versija“ ir siūlo palyginti/atnaujinti; jis tyliai neperrašo laukų.
- Regenerate su dirty state visada reikalauja aiškaus patvirtinimo.
- Polish turi vieno žingsnio undo iki paskutinio prieš-polish teksto.
- Send naudoja tik vieną `approve_send` request su subject, body, `expectedMessageUpdatedAt` ir `expectedCaseRevision`.
- Po sėkmės fokusas pereina į atnaujintos pagrindinės būsenos antraštę; po klaidos – į klaidos/recovery regioną.

## 7. Proceso timeline

V3 atskiria du skirtingus poreikius:

1. **Procesas** – šeši stabilūs etapai, rodantys kur byla yra dabar.
2. **Istorija** – esamas reverse-chronological audit/event feed po išskleidžiama „Visa istorija“ skiltimi.

### 7.1 Etapai

1. Užklausa ir kontaktas.
2. Matavimas.
3. Kaina ir pasiūlymas.
4. Kliento sprendimas ir sutartis.
5. Darbo paskyrimas ir vykdymas.
6. Užbaigimas, sąskaita ir garantija.

Kiekvienas etapas turi `not_started`, `current`, `needs_action`, `blocked` arba `completed`, tekstinę būseną, laiko žymą ir susijusius įrodymus. Kliento klausimas, komunikacijos failure, atšaukimas ir pakeitimo susitarimas rodomi kaip aiškios šakos prie paveikto etapo, o ne kaip septintas normalus etapas.

### 7.2 Paspaudimo taisyklės

- Etapo pavadinimas veda į egzistuojantį section ID ir fokusuoja jo `h2` su `tabIndex={-1}`.
- Dokumento child link atidaro tik exact `pdfHref`/media ID ir accessibility name turi versiją.
- Recovery child link veda į konkretų recovery panel, ne į bendrą messages viršų.
- Dabartinis etapas turi `aria-current="step"`.
- Blokuotas etapas turi tekstą ir ikoną; spalva nėra vienintelis signalas.
- Nepradėtas etapas nėra paspaudžiamas, jei nėra turinio.
- Kiekvienam vidiniam `href` yra automatizuotas DOM target egzistavimo testas.

## 8. Sticky bylos juosta ir branding

### 8.1 Desktop turinys

- Oficialus Takfornyelse wordmark arba mark.
- `Byla #ID` ir pilnas klientas.
- `Vykdoma` dokumento versija bei būsena.
- `Galiojanti` sutartis ir suma.
- Pagrindinės būsenos trumpas tekstas bei shortcut į primary regioną.

### 8.2 Mobile turinys

- Collapsed: mark, `#ID`, vykdoma versija, trumpa pagrindinė būsena, expand mygtukas.
- Expanded: klientas, paslauga, galiojanti sutartis, suma, blocker tekstas ir shortcut.
- Juosta pati neatlieka mutacijos ir nerodo antro confirm dialogo.

### 8.3 Logotipas

- Naudoti esamą `/brand/takfornyelse-logo.png`; kai pilnas wordmark netelpa, `/brand/takfornyelse-mark.png`.
- Išlaikyti aspect ratio. Orientyras: 36–40 px aukštis desktop, 28–32 px mobile.
- Jei šalia nėra matomo „Takfornyelse“ teksto, `alt="Takfornyelse"`; jei tekstas kartojamas, vaizdas dekoratyvus su `alt=""`.
- Logotipas yra nuoroda į `/admin-v2`, su aiškiu focus-visible kontūru.

## 9. Svarbos spalvos

Semantika turi būti centralizuota, o ne komponuojama atskirais Tailwind string kiekviename komponente.

| Tonas    | Paskirtis                                                   | Vizualus principas                                  |
| -------- | ----------------------------------------------------------- | --------------------------------------------------- |
| Critical | cancellation, pavojingas negrįžtamas veiksmas, hard failure | danger raudona + tekstas + ikona                    |
| Warning  | unresolved klausimas, stale/source/safety blocker, overdue  | naujas apibrėžtas warning tokenas + tekstas + ikona |
| Action   | saugus pagrindinis kitas veiksmas                           | Takfornyelse accent auksas                          |
| Waiting  | queued/sent, laukia kliento ar provider                     | neutralus/info tonas, ne success                    |
| Success  | tik patvirtintas completed/delivered/fully signed           | success žalia + patvirtinimo tekstas                |
| Neutral  | istorija, nepradėta, techninė informacija                   | muted/border                                        |

PASS reikalauja WCAG AA kontrasto: normalus tekstas bent 4.5:1, didelis tekstas ir UI komponentų ribos bent 3:1. `queued` ir `sent` negali naudoti success žalios; ji rezervuota patvirtintam rezultatui.

## 10. A11y ir fokusas

- Vienas puslapio `h1`, nuosekli `h2`/`h3` hierarchija.
- Primary region: `<section aria-labelledby="case-primary-title" tabindex="-1">`.
- Sticky juosta: `<aside aria-label="…">`; jos shortcut turi įvardyti tą patį primary action.
- Vienas centralizuotas operacinių rezultatų live regionas. Klaidos `role="alert"`, sėkmė/laukimas `role="status" aria-live="polite"`.
- `aria-busy="true"` taikomas konkrečiai siunčiamam workbench, o mygtukas iškart `disabled` prieš async darbą.
- Background polling nekeičia fokuso ir neskaito visos kortelės iš naujo.
- Vartotojo veiksmo sėkmė/klaida fokusuoja tikslinę antraštę arba feedback regioną.
- Visi in-page anchor taikiniai fokusabilūs programiškai ir turi `scroll-margin-top`, atitinkantį abu sticky headerius.
- Klaviatūros seka atitinka vizualią seką. Jokio teigiamo `tabIndex`.
- Escape uždaro tik V3 valdomą mobile expanded panel; native `details` elgsena neturi būti sugadinta.
- `prefers-reduced-motion` atveju scroll/focus be animuoto judėjimo.
- 200 % zoom privalomas kiekvienai fazei; 400 % zoom – galutiniam accessibility vartui.

## 11. Kalbų ir copy sutartis

### 11.1 Administratorius

- Visi V3 UI key vienoje `case-workspace-i18n` struktūroje su compile-time LT/EN/NB paritetu.
- LT ir EN yra release gate; NB admin išsaugomas ir negali degraduoti į techninius key.
- Datos formatuojamos per esamą `panelDateLocale`, verslo laikas – Europe/Oslo.
- Customer-generated subject/body neverčiami; aplinkinis UI ir statusai verčiami.
- Backend `error` tekstas nerodomas tiesiogiai, jei yra typed `code`; jis mapinamas į lokalizuotą recovery copy. Nežinomas tekstas slepiamas po technine informacija, o vartotojas gauna saugią lokalizuotą žinutę.

Kritinių statusų reikšmės turi išlikti vienodos:

| Reikšmė         | LT                                          | EN                                        |
| --------------- | ------------------------------------------- | ----------------------------------------- |
| prepare         | Reikia parengti atsakymą                    | A reply must be prepared                  |
| review          | Atsakymo juodraštis parengtas               | Reply draft ready                         |
| queued          | Atsakymas laukia siuntimo                   | Reply queued for delivery                 |
| sent            | Išsiųsta – laukiama pristatymo patvirtinimo | Sent – awaiting delivery confirmation     |
| delivered       | Patvirtinta, kad atsakymas pristatytas      | Reply confirmed delivered                 |
| failed          | Pristatyti nepavyko                         | Delivery failed                           |
| source changed  | Šaltiniai pasikeitė – reikia naujo atsakymo | Sources changed – a new reply is required |
| safety rejected | Automatinė patikra atmetė tekstą            | Automated safety check rejected the text  |

### 11.2 Klientas

Kliento pusėje lieka tik aiški NB kalba, ne admin terminai ir ne provider technika:

- `Signering er satt på pause`
- `Vi har mottatt spørsmålet ditt` arba po naujo submit `Spørsmålet er sendt`
- `Vi svarer på e-post etter at Takfornyelse har kontrollert saken. Signering åpnes automatisk her når svaret er levert.`
- Po provider-confirmed delivery: `Svaret er levert` ir `Du kan nå kontrollere dokumentet og fortsette til signering nedenfor.`

Šie tekstai neprivalo būti perkelti į admin i18n. V3 tik išsaugo jų būsenos sutartį ir regresijos testus.

## 12. Komponentų ribos

### 12.1 Siūlomi komponentai

| Komponentas/modulis                      | Atsakomybė                                 | Ko nedaro                              |
| ---------------------------------------- | ------------------------------------------ | -------------------------------------- |
| `case-workspace-view-model.ts`           | pure priority, tone, evidence, stage model | fetch, vertimai, JSX                   |
| `case-workspace-shell.tsx`               | server composition ir sekcijų registry     | mutacijos                              |
| `case-sticky-bar.tsx`                    | responsive kontekstas ir shortcut          | tiesioginis POST                       |
| `case-primary-workbench.tsx`             | vienos primary būsenos išdėstymas          | savarankiškas state derivation         |
| esamas `customer-question-workbench.tsx` | vienintelė question/reply būsena           | bendrų žinučių istorija                |
| esamas `message-draft-editor.tsx`        | vieno draft edit/save/polish/send/cancel   | next-action pasirinkimas               |
| `case-process-timeline.tsx`              | etapų, dokumentų ir recovery navigacija    | audit įvykių kūrimas                   |
| `case-history.tsx`                       | reverse-chronological esama istorija       | proceso prioriteto interpretacija      |
| `case-workspace-feedback.tsx`            | viena live-region ir focus sutartis        | backend klaidų spausdinimas be mapping |

### 12.2 Sekcijų registry

Vienas constant aprašo `customer`, `measurement`, `commercial`, `messages`, `contract`, `work`, `changes`, `documents`, `history`, jų ID ir label key. Nav, timeline ir section komponentai importuoja tą patį registry. Tai panaikina neveikiančius fragmentus ir skirtingus pavadinimus.

## 13. API ir read-model ribos

### 13.1 Pirmas rollout nekeičia API

V3 pernaudoja esamus endpointus ir payload:

- Lead veiksmai: `/api/admin/leads/{id}`.
- Measurement: `/api/admin/measurements/{id}`.
- Quote: `/api/admin/quotes` ir `/api/admin/quotes/{id}`.
- Contract signing ir kiti domeno paneliai lieka savo esamuose komponentuose.
- Dokumentai atidaromi per esamus exact PDF/media URL.

Klausimo srauto request sutartys išlieka:

```text
prepare_question_reply:
  { action, sourceMessageId, expectedRevision }

prepare_manual_question_reply:
  { action, sourceMessageId, expectedRevision }

save_draft:
  { action, messageId, subject, bodyText, expectedMessageUpdatedAt }

approve_send:
  { action, messageId, subject, bodyText,
    expectedMessageUpdatedAt, expectedCaseRevision }

retry_send:
  { action, messageId, expectedRevision }
```

`CASE_REVISION_CONFLICT` ir `MESSAGE_REVISION_CONFLICT` reiškia refresh/review, ne automatic retry. `CUSTOMER_REPLY_SOURCE_CHANGED` ir `CUSTOMER_REPLY_SAFETY_REJECTED` reiškia regenerate/manual recovery, ne delivery retry.

### 13.2 Additive read-model pakeitimas

P1-4 pataisai `AdminCase` turi gauti:

```ts
customerQuestionContext?: {
  question: CaseMessage;
  reply?: CaseMessage;
  stage: CustomerQuestionReplyStage;
  documentReferences: string[];
};
```

Jis apskaičiuojamas iš exact uncapped customer-question/direct-reply query, o ne iš `messages.slice(0, 100)`. Tai additive laukas; esami `messages`, `timeline` ir endpointai nelaužomi. UI neturi atlikti papildomo client fetch pradiniam renderiui.

Timeline V3 pradžioje gali būti išvestas iš esamų `AdminCase` laukų. Jei vėliau prireiks papildomų exact links, leidžiamas tik additive `sectionId`, `documentHref`, `eventKind` ar `recoveryTarget` išplėtimas; jokio statuso semantikos pervadinimo tame pačiame release.

## 14. Implementacijos fazės ir PASS

### V3-0 – baseline ir testuojama specifikacija

**Darbas:** užfiksuoti SHA, dabartinių fragmentų sąrašą, state matricą ir screenshot baseline izoliuotoje staging byloje.

**PASS:**

- Nėra neaprašyto `CaseNextActionKind`.
- Kiekvienas esamas section ID ir vidinis href inventorizuotas.
- Yra rollback commit ir anonimizuotos 360, 375, 768, 1280 px baseline nuotraukos.

**Rollback:** nėra runtime pakeitimo.

### V3-1 – pure workspace view-model

**Darbas:** sukurti vieną priority/tone/stage resolverį, centralizuotą section registry ir i18n key paritetą, nekeisti matomo UI.

**PASS:**

- Cancellation laimi prieš unresolved klausimą.
- Unresolved klausimo šešios būsenos grąžina tik vieną primary modelį.
- Delivered klausimas atlaisvina normalų business action.
- Visi `CaseNextActionKind` turi rezultatą.
- LT/EN/NB key struktūros identiškos.

**Rollback:** pašalinti naujus pure modulius ir jų testus; runtime nepaveiktas.

### V3-2 – sticky bar, branding ir primary workbench

**Darbas:** perjungti header/command bar ir next-action regioną į vieną view-model; įdėti oficialų logotipą; sticky juostoje palikti tik shortcut.

**PASS:**

- DOM yra vienas `data-case-primary-action`.
- Sticky ir workbench rodo tą patį state key, dokumento reference ir blocker.
- 360/375 px nėra horizontal overflow ar uždengto turinio.
- Logo turi teisingą alt/link/focus.
- Old command bar galima grąžinti vienu commit revert.

**Rollback:** revert tik V3-2 presentation commit; V3-1 pure modelis gali likti nenaudojamas.

### V3-3 – vienintelis question workbench/editor

**Darbas:** prijungti pirmos klasės question context, pašalinti timer refresh, sutvarkyti editor focus/dirty sync, kitus draft paversti read-only aktyvaus blockerio metu.

**PASS:**

- AI arba manual pirmu paspaudimu atveria tik vieną editorių.
- Cancel → prepare → naujas editorius veikia pirmu paspaudimu.
- Dirty tekstas neprarandamas nuo foninio refresh.
- Safety/source recovery rodo tik atitinkamus AI/manual veiksmus.
- `approve_send` tebėra vienas atomic request su abiem revision.
- Queued, sent ir delivered turi skirtingą copy ir toną.
- Timeline reply nuoroda turi realų target.

**Rollback:** grąžinti seną question render adapterį; backend bei persisted draft nekeisti.

### V3-4 – proceso timeline ir exact dokumentai

**Darbas:** įdiegti šešių etapų procesą, recovery šakas, section registry navigaciją ir atskirą išskleidžiamą istoriją.

**PASS:**

- Kiekviena vidinė nuoroda egzistuoja ir fokusuoja antraštę.
- Quote/contract/change/invoice/warranty nuorodos atidaro exact versiją.
- Dabartinis etapas turi `aria-current="step"`.
- Nepradėti etapai nėra klaidinamai interaktyvūs.
- Audit istorijos elementai neprarasti.

**Rollback:** grąžinti esamą chronological timeline sekciją; read-model additive laukai saugiai ignoruojami.

### V3-5 – responsive, a11y, spalvos ir copy

**Darbas:** centralizuoti tone stilius bei warning tokeną, užbaigti 360–375 px layout, focus/live-region, reduced-motion ir i18n cleanup.

**PASS:**

- 360, 375, 768, 1280 px ir 200 % zoom – be uždengimo ar viewport overflow.
- 400 % zoom pagrindinis srautas atliekamas viena kolona.
- Keyboard-only: sticky shortcut → primary → timeline → section veikia logiška seka.
- axe/WCAG smoke neturi critical/serious pažeidimų tiksliniame puslapyje.
- Teksto ir UI kontrastas atitinka AA.
- LT/EN admin ir NB customer copy matrica PASS.

**Rollback:** tone/responsive commit atskiras nuo state/API commit; galima grąžinti CSS ir komponentų markup nepakeičiant duomenų.

### V3-6 – staging gate

**Darbas:** autorizuotas, sintetinių bylų manual UAT ir pilna regresija. Produkcija neliečiama iki atskiro GO.

**PASS:**

- Nauja byla → matavimas → pasiūlymas → pasirašymas → darbas.
- Unresolved klausimas sustabdo sign, delivered atblokuoja.
- Sent nėra rodomas kaip delivered.
- Delivery failed, safety rejected, source changed ir stale turi teisingą recovery.
- Cancellation + unresolved question rodo teisinį blocker kaip primary, klausimą – secondary attention.
- Mobile 360/375 ir desktop vizualinis savininko priėmimas.
- `lint`, `typecheck`, focused tests, visas unit suite ir production build PASS.

**Rollback:** revert V3 presentation commitų seriją atvirkštine tvarka; jokio DB rollback, nes schema ir persisted duomenys nekeisti.

## 15. Testų planas

### 15.1 Pure unit testai

- Kiekvienas `CaseNextActionKind` → vienas primary state.
- Priority poros: cancellation + question; question + failed unrelated message; archive + draft; delivered question + normal action.
- Question stages: prepare/review/queued/sent/delivered/failed.
- Recovery mapping: revision conflict, source changed, safety rejected, AI unavailable, unknown.
- Tone mapping: failed/blocked/waiting/success negali susilyginti.
- LT/EN/NB deep-key parity.
- Section registry unikalūs ID ir visi timeline vidiniai targets priklauso registry arba specialiam entity anchor.

### 15.2 Component/integration testai

- Renderintame workspace lygiai vienas primary action ir vienas primary title.
- Sticky shortcut yra link, ne mutation button.
- Unresolved klausimo metu kiti draft neturi send/regenerate controls.
- Prepare response `messageId` → vienas refresh → vienas editor → focus.
- Remount keičiantis message ID; tam pačiam ID dirty tekstas neištrinamas dėl naujo `updatedAt`.
- Regenerate su dirty state reikalauja confirm; cancel nereaktyvuoja seno edited/queued/sent reply.
- Error feedback `role="alert"`, success/wait `role="status"`.
- Timeline direct reply target egzistuoja.
- Delivered question card yra history/process evidence, ne antras primary workbench.
- Exact document link accessibility name turi reference/version.

Jei repo nenorima papildyti DOM testavimo biblioteka, presentation taisykles pirmiausia iškelti į pure helperius ir jų HTML sutartį dengti Playwright. Naują testavimo dependency pridėti tik atskiru patvirtintu sprendimu.

### 15.3 API kontraktų regresija

- Išsaugoti esamus `message-draft-request.test.ts`, `action-result.test.ts`, `case-read-model.test.ts`, customer question engine/route testus.
- Patikrinti, kad UI siunčia `expectedRevision`, exact `sourceMessageId`, `expectedMessageUpdatedAt`, `expectedCaseRevision`.
- Vienas double-click → vienas POST.
- 409 → refresh/review; jokio automatinio mutation retry.
- Prepare/manual/regenerate/cancel ciklai nekeičia provider ir audit count neteisingai.

### 15.4 Responsive ir a11y E2E

- Viewport: 360×800, 375×812, 768×1024, 1280×800, 1440×900.
- `document.documentElement.scrollWidth === clientWidth` 360 ir 375 px.
- Sticky juosta neuždengia primary title, klaidos, editoriaus laukų ar fokusuoto elemento.
- Visi touch target dydžiai ir focus-visible.
- Keyboard-only prepare → edit → confirm send → status.
- Reduced-motion režime nėra smooth scroll priklausomybės.
- Provider-confirmed delivered testas atskirtas nuo provider-accepted sent.

### 15.5 NB kliento regresija

- Submit generuoja UUID vienai submission ir tą patį naudoja transporto retry; naujas tekstas generuoja naują UUID.
- Sėkmė fokusuoja/scrollina pause kortelę.
- Pending paslepia sign formą ir neleidžia duplicate question.
- Focus, visibility ir 30 s status check atblokuoja tik gavus `questionPending: false`.
- Inline klaida turi telefono ir el. pašto recovery.

## 16. Rollout ir rollback disciplina

- Viena fazė – vienas arba keli maži, aiškiai atskiriami commit; jokio big-bang puslapio perrašymo.
- Nekeisti API ir layout tame pačiame commit.
- Read-model pakeitimai tik additive ir su senos UI regresija.
- Iki V3-6 naudoti izoliuotą branch/worktree ir sintetines staging bylas.
- Produkcijos GO reikalauja atskiro savininko sprendimo.
- Rollback niekada neturi trinti message, document, audit ar signature įrašų; tik grąžina presentation commitus.
- Jei fazės PASS nepasiektas, kita fazė nepradedama.

## 17. Galutinis priėmimo apibrėžimas

Case Workspace V3 paruoštas produkcijos sprendimui tik kai:

```text
ONE_PRIMARY_STATE=PASS
ONE_PRIMARY_ACTION=PASS
QUESTION_WORKBENCH_SINGLE_OWNER=PASS
EXACT_DOCUMENT_LINKS=PASS
SENT_VS_DELIVERED=PASS
SIGNING_PAUSE_RESUME=PASS
RESPONSIVE_360_375=PASS
A11Y_FOCUS_LIVE_REGION=PASS
ADMIN_LT_EN=PASS
CUSTOMER_NB=PASS
ROLLBACK_READY=YES
OWNER_APPROVAL=GO
```

## 18. Ryto sprendimai prieš implementaciją

1. Patvirtinti prioritetą: cancellation/legal stop virš unresolved klausimo.
2. Patvirtinti, kad sticky juostos CTA yra tik shortcut, ne antras mutacijos valdiklis.
3. Patvirtinti first-class uncapped `customerQuestionContext` kaip vienintelį additive read-model pakeitimą pirmame V3 pakete.
4. Patvirtinti, kad aktyvaus klausimo metu kiti outbound draft tampa read-only.
5. Patvirtinti oficialaus wordmark/mark naudojimą ir semantinių `warning`/`waiting` tonų pridėjimą.
6. Pasirinkti testavimo kelią: pure helpers + esamas Playwright arba atskirai patvirtinta DOM component testavimo biblioteka.
