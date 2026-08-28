# Takfornyelse — naktinio saugaus vykdymo ataskaita 2026-08-29

**Vykdymo būsena:** techninės patikros vykdomos; push ir Preview dar neatlikti

**Pradinis kandidatas:** `29e51a76f9edfe132ab503bc7b6266cbfd76b822`

**Darbo šaka:** `codex/master-platform-implementation`

**Patvirtinta apimtis:** lokalios saugios pataisos, testai, dokumentacija,
lokalūs commit, GitHub push į darbo šaką ir Preview tik po žalių patikrų

**Draudžiama apimtis:** Production, klientų komunikacija, DB duomenys,
secrets, env, webhook, cron, kainos, sutartys ir išorinės paskyros

## 1. Baseline ir release sauga

| Įrodymas                              | Reikšmė                                    | Būsena     |
| ------------------------------------- | ------------------------------------------ | ---------- |
| Nakties pradžios SHA                  | `29e51a76f9edfe132ab503bc7b6266cbfd76b822` | PASS       |
| GitHub Quality                        | Run `33206300849`, exact pradinis SHA      | PASS       |
| Pradinis Preview                      | `dpl_4B2m6UdCxxcboBX8fSZthdRTXNPd`         | READY      |
| Staging alias                         | exact pradinis SHA `29e51a7`               | PASS       |
| Production deployment                 | `dpl_CvS7U3tgY16XmLss8aAciiKtZzK5`         | NEPAKEISTA |
| Production SHA                        | `c5ecf4bae7cbd166b4579b265c7964744574050a` | NEPAKEISTA |
| Preview / Production 5xx audito lange | `0 / 0`                                    | PASS       |

Išsamus manifestas, aliasų grandinė, rollback kortelė ir tik pavadinimų/scope
env inventorius yra
`docs/operations/overnight-release-safety-evidence-2026-08-29.md`.

### Darbo medžio apsauga

Anksčiau egzistavę `.agents/`, `.tmp-playwright-*`, `tmp/`,
`scripts/prod8-2-*` ir `skills-lock.json` nėra šios nakties pakeitimai. Jie
neliečiami ir nebus įtraukti į commit. Failai bus stage'inami tik tiksliu
sąrašu; `git add .` nenaudojamas.

## 2. Fazių registras

| Fazė                                   | Būsena                   | Rezultatas / įrodymas                                                                                    |
| -------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| N-0 Baseline freeze                    | PASS                     | SHA, CI, Preview ir Production manifestas užfiksuoti                                                     |
| N-1 Būsenų ir vieno veiksmo auditas    | PASS                     | `source_changed` palieka tik vieną saugų recovery CTA; tiksliniai testai žali                            |
| N-2 Neigiami scenarijai ir concurrency | ATTENTION                | message/job idempotency ir CAS testai žali; lieka dokumentuota negriežta concurrent AI kvotos riba       |
| N-3 DI faktų šaltiniai ir sauga        | PASS                     | pilnas fingerprint, quote pagrįstas impregnavimo teiginys, kontroliuojamas later-addition ir regressions |
| N-4 Responsive, a11y, lokalizacija     | AUDIT PASS               | P1/P2 spragos užfiksuotos V3 specifikacijoje; platus UI perrašymas sąmoningai nepradėtas                 |
| N-5 Case Workspace V3 specifikacija    | PASS                     | parengta fazinė implementavimo specifikacija su PASS/rollback kriterijais                                |
| N-6 Release saugos įrodymai            | ATTENTION / OWNER ACTION | pradinis RC saugus; stale automatinis branch alias ir upstream Vercel authorization pažymėti             |
| N-7 Pilna techninė patikra             | LOCAL PASS / CI LAUKIA   | galutinis unit, migrations, typecheck, lint, Prettier ir diff paketas PASS                               |
| N-8 Rytinis perdavimas                 | VYKDOMA                  | ataskaita ir owner UAT ruošiami galutiniam Preview SHA                                                   |

## 3. Kodo pakeitimai

1. `polish_reply` prieš Gemini kvietimą tiksliai rezervuoja vieną
   `ai.customer-reply.request` su source message ir purpose.
2. Atsakymo faktų fingerprint apima realiai naudojamus lead, measurement,
   quote, contract, work-order, kainos, sąlygų ir paslaugų laukus.
3. Sudėtinis impregnavimo klausimas tikrinamas dviem nepriklausomomis dalimis:
   ar paslauga įtraukta ir koks kontroliuojamas vėlesnio pridėjimo kelias.
4. Įtraukimo teiginys lyginamas su pasirinkto pasiūlymo paslauga; klaidingas
   „įtraukta“ arba „neįtraukta“ teiginys atmetamas.
5. Atpažįstamos natūralios norvegiškos formos `impregneringen` ir tęstinis
   įvardis `den`.
6. Pasikeitus faktų šaltiniui pasenusio juodraščio save/polish/send veiksmai
   paslepiami; lieka vienas regenerate recovery ir saugus discard.
7. Concurrent viešo klausimo job insert po unique konflikto perskaito vieną
   laimėjusį job; testas tikrina tikslų idempotency key ir originalios klaidos
   grąžinimą, kai laimėtojo nėra.

Detalus auditas:
`docs/operations/overnight-question-reply-audit-2026-08-29.md`.

## 4. Radiniai pagal svarbą

### P0

Nerasta.

### P1 — pataisyta

- polish Gemini kvietimas nebuvo tiksliai apskaitomas;
- fingerprint neapėmė dalies atsakymui naudojamų faktų;
- sudėtinis impregnavimo klausimas galėjo būti laikomas atsakytu per anksti;
- Takvask-only pasiūlymui buvo galima klaidingai teigti, kad impregnavimas
  įtrauktas;
- nekontroliuojama frazė „galima pridėti vėliau“ galėjo praeiti be atskiro
  susitarimo ar naujo pasiūlymo;
- concurrent operational-job unique insert galėjo grąžinti klaidą vietoje
  vieno patvaraus laimėtojo.

### Likusi apribota rizika

Du administratoriai, vienu metu pirmą kartą tiesiogiai paleidę
`prepare_question_reply`, gali abu pasiekti Gemini prieš DB unique message
insert. Dvigubas aktyvus juodraštis neatsiras, tačiau galimas vienas papildomas
apskaitytas AI kvietimas. Griežtam sprendimui reikia patvaraus generation claim
ar atominio quota bucket DB dizaino; DB/schema keitimas nakties apimtyje
draudžiamas. Rizika pažymėta `ATTENTION`, nepaslėpta kaip PASS.

### UX P1/P2

Vieno primary-state resolverio, vienintelio klausimo editoriaus, exact timeline
anchor, ilgos istorijos klausimo loaderio, deterministinio fokuso, `role=alert`,
warning tokeno, proceso etapų ir oficialaus logotipo darbai aprašyti
`docs/admin-v2-case-workspace-v3-spec.md`. Jie neįgyvendinti kaip rizikingas
platus naktinis perrašymas.

## 5. Techninių patikrų rezultatai

| Patikra                                      | Rezultatas                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tikslinis klausimų paketas prieš peer review | 8 failai / 103 testai PASS                                                                                                                         |
| Papildomi saugos regresiniai testai          | 2 failai / 39 testai PASS                                                                                                                          |
| Pilnas unit/API paketas                      | 182 failai / 712 testų PASS                                                                                                                        |
| Migracijų paketas                            | 21 failas / 39 testų PASS                                                                                                                          |
| TypeScript                                   | PASS                                                                                                                                               |
| ESLint                                       | PASS                                                                                                                                               |
| `git diff --check`                           | PASS                                                                                                                                               |
| Prettier                                     | PASS                                                                                                                                               |
| Build                                        | bus vykdomas izoliuotame GitHub Linux Quality gate; vietinis `npm run build` sąmoningai nevykdomas, nes skriptas pirmiausia paleidžia DB migraciją |

Po galutinių dokumentacijos ir peer-review pataisų visas vietinis unit,
migration, typecheck, lint, Prettier ir diff paketas pakartotas ir praėjo. Push
leidžiamas; Preview vertinamas tik po exact SHA žalio GitHub Quality gate.

## 6. Rytinis owner UAT

Tik galutiniame exact Preview SHA:

1. atidaryti sintetinę klausimo bylą;
2. klausimas:
   `Er impregneringen inkludert i dette tilbudet, og kan den legges til senere?`;
3. įrodyti, kad Takvask-only pasiūlymui klaidingas „įtraukta“ tekstas
   atmetamas;
4. įrodyti, kad „kan legges til senere“ be reviduoto/separataus pasiūlymo ar
   atskiro susitarimo atmetamas;
5. sugeneruoti saugų juodraštį, atšaukti ir sukurti iš naujo; matyti vieną
   editorių ir vieną recovery CTA;
6. savininko valdomame sintetiniame scenarijuje patvirtinti atsakymą;
7. patikrinti tikrą Resend `delivered` ir kad signavimas lieka blokuotas iki
   pristatymo, o po jo atblokuojamas tik jei nėra kito neatsakyto klausimo.

## 7. Owner action / STOP prieš Production

- patikrinti naujo exact SHA Preview ir jo aliasą;
- realiai patvirtinti Resend delivery webhook bei Gemini kvotų būseną;
- patvirtinti fresh Production backup/restore, DB ir privataus Blob įrodymus;
- išspręsti arba sąmoningai priimti upstream PR Vercel authorization check;
- patvirtinti likusią apribotą concurrent AI kvotos riziką arba suplanuoti
  atominį quota/generation claim darbą;
- atlikti aukščiau aprašytą owner UAT.

Be šių veiksmų ši naktinė ataskaita nėra Production GO.

## 8. Sąmoningai neatlikta

- Production nebuvo diegiama, promote'inama, rollbackinama ar kitaip keičiama.
- Nebuvo siunčiami laiškai, SMS, pasiūlymai, sutartys ar klientų nuorodos.
- Nebuvo kuriama, archyvuojama ar keičiama jokia shared DB byla.
- Nebuvo keičiami DB duomenys, migracijos, secrets, env, webhook, cron, DNS,
  billing, kainos, sutartys ar išorinės paskyros.
- Nebuvo replay'inami webhook, paleidžiami cron/job ar naudojama gyva providerio
  kvota.
