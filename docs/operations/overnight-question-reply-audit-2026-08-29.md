# Klausimų ir DI atsakymų naktinis auditas — 2026-08-29

**Apimtis:** N-1–N-3

**Bazinis HEAD:** `29e51a76f9edfe132ab503bc7b6266cbfd76b822`

**Saugos ribos:** be Production/shared DB, laiškų, deploy, push ir commit.

## Pradinė būsenų matrica

| Būsena                            | Patvarus šaltinis                                         | Admin pagrindinis veiksmas                                      | Recovery                                    | Signavimas                               |
| --------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| Klausimas gautas, atsakymo nėra   | inbound `customer_question`                               | `Lag AI-utkast`; rankinis atsakymas yra antrinis kelias         | AI neprieinamas → rankinis                  | Blokuotas                                |
| AI arba rankinis juodraštis       | tiesiogiai su klausimu susieta outbound žinutė            | vienas `MessageDraftEditor`, pagrindinis CTA `Godkjenn og send` | save / polish / regenerate / cancel         | Blokuotas                                |
| Safety atmestas prieš išsaugojimą | nėra aktyvaus juodraščio                                  | naujas AI juodraštis; rankinis yra antrinis                     | tipizuotas `CUSTOMER_REPLY_SAFETY_REJECTED` | Blokuotas                                |
| Šaltinis/fingerprint pasikeitė    | senas juodraštis lieka nesaugus siųsti                    | privalomas naujas su šaltiniu susietas juodraštis               | `CUSTOMER_REPLY_SOURCE_CHANGED`             | Blokuotas                                |
| Juodraštis atšauktas              | cancelled tiesioginis atsakymas ignoruojamas kaip aktyvus | sukurti iš naujo                                                | CAS saugo nuo lėto perrašymo                | Blokuotas                                |
| Queued / sent                     | patvirtintas tiesioginis atsakymas                        | laukti delivery                                                 | provider retry tik po klaidos               | Blokuotas                                |
| Failed / attention / bounce       | nepavykęs tiesioginis atsakymas                           | retry arba naujas juodraštis pagal klaidos tipą                 | klaidos tekstas + recovery                  | Blokuotas                                |
| Delivered                         | provider patvirtintas tiesioginis atsakymas               | klientas tęsia                                                  | kitas neatsakytas klausimas išlaiko bloką   | Atblokuotas tik jei neliko kitų klausimų |

## Pradinės testų spragos

1. Nėra tiesioginio `polish_reply` route testo, įrodančio vieną kvotos rezervaciją ir vieną audito įrašą kiekvienam Gemini bandymui.
2. Nėra redaktoriaus action-visibility testo po `source_changed`; reikia įrodyti, kad pasenusio juodraščio siuntimas nebelieka klaidinančiu pagrindiniu CTA.
3. Customer source fingerprint testai keičia bendrų sąlygų versiją ir šaltinių tvarką, bet dar neįrodo quote statuso, matavimo, work-order ar kainos lauko pasikeitimo.
4. Viešo klausimo submission idempotency, cancelled recreate, CAS winner, safety retry, sent-vs-delivered ir keli neatsakyti klausimai jau turi deterministinius testus; bus pakartotinai paleisti kaip bazinė regresija.
5. 2 000 simbolių skaitiklis, focus ir `aria-live` daugiausia tikrinami statiniu kodu; tai UX/P2 spraga, ne nustatytas P0/P1.

## Radiniai ir pataisos

1. **P1 — `polish_reply` nebuvo tiksliai apskaitomas.** Route tikrino limitą su `reserve=0`, nekūrė `ai.customer-reply.request` įrašo ir ties kvotos riba leisdavo papildomą Gemini kvietimą. Pataisyta: tiksliai prieš provider kvietimą rezervuojamas vienas bandymas su tiksliu `replyToMessage`, `purpose=customer-reply-polish`; bendras skaitiklis jo nedubliuoja.
2. **P1 — fingerprint neapėmė dalies atsakymui naudojamų faktų.** Deterministiškai atkurta, kad lead paslauga, patvirtinto matavimo plotas, quote būsena, work-order būsena ir patvirtinta vieneto kaina galėjo pasikeisti nekeičiant fingerprint. Pataisyta: snapshot dabar apima šiuos faktus, taip pat quote galiojimą/sumas, contract būseną/signavimą ir paslaugų turinį; masyvai lieka kanoniškai rūšiuojami.
3. **P1 — sudėtinis impregnavimo klausimas buvo laikomas atsakytu per anksti.** Klausimui „ar įtraukta ir ar galima pridėti vėliau?“ vien `ikke inkludert` klaidingai praeidavo. Pataisyta: inclusion ir later-addition/revised-offer atsakymai validuojami atskirai; generation ir polish promptai reikalauja abiejų dalių.
4. **P2 — pasikeitus šaltiniui redaktorius vis dar rodė seno juodraščio save/polish/send CTA.** Pataisyta: `source_changed` būsenoje paliekamas tik naujo juodraščio CTA (ir saugus discard), o safety rejection vis dar leidžia rankinį taisymą.
5. **P1 — vienalaikis viešo klausimo retry galėjo pralaimėti operational-job unique insert ir grąžinti klaidą.** Pataisyta: po konflikto perskaitomas vienintelis laimėjęs `customer.reply.draft` job. Job claim CAS užtikrina vieną jo vykdymą/Gemini generavimą.

### Nepriklausomos peržiūros papildymai

Po pirmojo žalio tikslinio paketo nepriklausoma kodo peržiūra atkūrė dar tris
saugos spragas, kurių pradiniai testai nepagavo:

1. vien tik `Takvask` pasiūlymui tekstas galėjo klaidingai teigti, kad
   impregnavimas įtrauktas;
2. frazė „Impregnering kan legges til senere“ galėjo praeiti be atskiro
   susitarimo ar reviduoto/separataus pasiūlymo;
3. apibrėžtinė forma `impregneringen` ir įvardis `den` klausime apeidavo
   kelių dalių patikrą.

Pataisyta: įtraukimo teiginys dabar lyginamas su nekintamu pasirinkto pasiūlymo
`serviceDescription` (su saugiu `service` fallback), vėlesniam pridėjimui
privalomas kontroliuojamas atskiras susitarimas arba reviduotas/separatus
pasiūlymas, o klausimų atpažinimas apima apibrėžtinę formą ir tęstinį įvardį.
Pridėti regresiniai testai abiem klaidingoms teiginių kryptims, nekontroliuojamam
pridėjimui ir natūraliai norvegiškai klausimo formai.

Operational-job concurrency testas taip pat sustiprintas: jis tikrina tikslų
`idempotencyKey` pakartotinėje užklausoje ir įrodo, kad, neradus tikro
concurrent laimėtojo, grąžinama originali DB klaida.

## Patikros rezultatai

- Vienas CTA / vienas editorius: action-visibility regresijos patvirtina prepare, replacement ir stale-editor būsenas.
- Cancel/recreate: cancelled AI draft pernaudojamas tik po naujos sėkmingos generacijos; senas turinys ir delivery laukai išvalomi; nesėkmė palieka cancelled įrašą nepakeistą; CAS laimėtojas neperrašomas.
- Safety: gyvas kelių dalių kontrolinio matavimo klausimas, maksimalios kainos + rašytinės endringsavtale taisyklė, morfologija, impregnavimo dvi dalys ir ribotas vienas automatinis retry praeina.
- Source/CAS: stale source atmetamas prieš polish, approve ir retry; nauji fingerprint testai apima lead, measurement, quote, work-order ir price; case/message revision CAS testai praeina.
- Idempotency: tas pats `submissionKey` + tekstas deduplikuojamas, tas pats key su kitu tekstu atmetamas, naujas key leidžia teisėtą identišką klausimą, concurrent source/job insert recovery praeina.
- Delivery/signing: queued/sent/failed/bounce lieka blokuoti; tik tiesioginis `delivered` atsakymas nuima bloką, jei neliko kito neatsakyto klausimo.
- AI quota: kiekvienas draft safety bandymas ir polish kvietimas rezervuojamas prieš provider; automatinis retry sustoja prieš antrą provider kvietimą, jei kvota baigėsi.
- Faktų šaltiniai: quote/contract snapshot, aktyvios sąlygos, paslaugos, kainos, matavimas ir work-order yra DB šaltiniai; NOK/øre, mva, nepatvirtintos kainos/plotai, garantijos ir datos saugos testai praeina.
- Pirminis agento tikslinis paketas: **12 testų failų, 130 testų PASS**.
- Po nepriklausomos peržiūros ir papildomų regresijų galutinis pilnas unit/API
  paketas: **182 testų failai, 712 testų PASS**; migracijų paketas: **21 failas,
  39 testai PASS**.
- `eslint` tik pakeistiems failams: PASS. `tsc --noEmit --incremental false`: PASS. `git diff --check`: PASS.

## Likę STOP / OWNER ACTION

1. **STOP — realus customer #17 / Preview UAT:** reikia savininko prisijungimo. Patikrinti vieną realų klausimą, vieną redaktorių, faktinį Resend delivery webhook ir signavimo atblokavimą. Naktį naršyklė ir laiškai nenaudoti.
2. **STOP — Production/shared DB, provider ir kvotos dashboard:** nebuvo skaitomi ar keičiami; realų Gemini/Resend limitą bei webhook konfigūraciją turi patvirtinti savininkas pagal release procedūrą.
3. **Likusi techninė concurrency rizika:** du skirtingi administratoriai gali tuo pačiu metu tiesiogiai paleisti pirmą `prepare_question_reply`; DB unique saugo nuo dviejų aktyvių žinučių, bet abu Gemini bandymai gali būti apskaityti prieš vienam insert pralaimint. Tam reikia atskiro patvaraus generation-claim dizaino; tai sąmoningai nebuvo daroma kaip mažos rizikos naktinė pataisa.
4. **UX/P2:** 2 000/3 000 simbolių skaitiklio ir realaus focus elgesio nėra DOM/browser automatiniame teste; `aria-live` yra kode, bet vizualinis/a11y UAT liko savininkui.
