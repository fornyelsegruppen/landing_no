# Takfornyelse — pokalbio tęstinumo checkpointas 2026-08-29

## 1. Paskirtis

Šis dokumentas yra privalomas atspirties taškas naujai Codex užduočiai po
labai ilgos ankstesnės pokalbio gijos. Tikslas — tęsti tą patį darbą be
pakartotinio interpretavimo, neprarasti patikrų ir nesumaišyti Preview su
Production.

Nauja užduotis prieš bet kokį pakeitimą privalo perskaityti:

1. šį checkpointą;
2. `docs/operations/prod8-owner-uat-checklist-2026-08-28.md`;
3. `docs/operations/overnight-safe-execution-report-2026-08-29.md`;
4. `docs/admin-v2-case-workspace-v3-spec.md`;
5. `docs/operations/thread-resume-verification-prompt-2026-08-29.md`.

## 2. Darbo vieta ir Git ribos

- Repozitorija: `C:\Dev\takfornyelse-master-implementation`
- Dabartinė Git šaka: `codex/master-platform-implementation`
- GitHub PR: `https://github.com/darbasnorvegija4-eng/landing_no/pull/52`
- Bazinis commit prieš šį pataisymą: `0966a52a17f9b192afbe7b77f3d291a11913b755`
- DI terminijos saugos commit: `f75db31` (`fix(ai): block internal wording in customer replies`)
- Checkpoint commit ir dabartinis branch HEAD: `f67d4e50c8644027190bff55c4833265bbd4de3f`
- Darbo šakos remote: `origin` → `https://github.com/fornyelsegruppen/landing_no.git`
- Upstream: `https://github.com/darbasnorvegija4-eng/landing_no.git`

Nekurti naujos Git šakos ir nemerginti PR be atskiro savininko nurodymo.
Naujas Codex pokalbis tęsia tą pačią darbo šaką.

## 3. Leidimų ribos

Galioja savininko patvirtinta saugi apimtis:

- leidžiami lokalūs saugūs kodo pakeitimai, testai, dokumentacija ir commit;
- leidžiamas push tik į dabartinę darbo šaką;
- leidžiamas Vercel Preview deploy tik po žalių patikrų;
- draudžiami Production pakeitimai be naujo aiškaus `Production GO`;
- draudžiama realių klientų komunikacija;
- draudžiami DB duomenų, secrets, env, webhook, cron, kainų, sutarčių,
  išorinių paskyrų ar billing pakeitimai be atskiro aiškaus leidimo;
- sintetinį laišką arba bylos mutaciją Preview aplinkoje atlieka savininkas,
  kai jam pateikiama konkreti nuoroda ir vienas konkretus veiksmas.

## 4. Dabartinis produkto etapas

Dirbama ne su `Case Workspace V3` implementacija, o su prieš ją esančiu
kliento klausimo ir administratoriaus DI atsakymo srauto užbaigimu Preview
aplinkoje.

Dabartinis UAT objektas buvo sintetinė Preview byla `#17`, dokumento versija
`K-17-V1` / pasiūlymas `T-17-V1`. Ji naudojama tik savininko kontroliuojamam
testui. Negalima daryti prielaidos, kad paskutinis matytas juodraštis jau
išsiųstas — prieš bet kokį siuntimą būtina patikrinti aktyvią bylos būseną UI.

Paskutinis rastas trūkumas: DI klientui skirtame juodraštyje atsirado vidinė
techninė frazė `uten kildegrunnlag`. Toks juodraštis klientui netinkamas ir
negali būti siunčiamas.

## 5. Ką tik įgyvendintas siauras pataisymas

Pakeisti tik šie runtime/test failai:

- `src/lib/messages/customer-reply.ts`
- `src/lib/messages/customer-reply.test.ts`

Įgyvendinta:

1. Generavimo promptas nebeskatina frazės `uten kildegrunnlag`.
2. Klientui tinkama logika dabar sako, kad galimas papildymas turi būti
   atskirai suderintas ir įtrauktas į atnaujintą arba atskirą pasiūlymą;
   klientas kviečiamas susisiekti su Takfornyelse.
3. Deterministinis validatorius blokuoja vidinę techninę terminiją ir jos
   variantus, įskaitant:
   - `kildegrunnlag`;
   - `faktakontekst`;
   - `systemkontekst`;
   - `systemprompt`;
   - `JSON-kontekst` ir `JSON kontekst`;
   - `database`;
   - `språkmodell`, `AI-modell` ir `KI-modell`;
   - `det interne systemet` / `et internt system`;
   - `automatisk faktakontroll`.
4. Normalus klientui tinkamas sakinys `Vi har registrert spørsmålet i
systemet vårt.` lieka leidžiamas.
5. Generavimo saugos retry atmeta pirmą netinkamą rezultatą ir vieną kartą
   generuoja iš naujo.
6. Profesionalaus performulavimo (`polish`) rezultatas tikrinamas tuo pačiu
   deterministiniu filtru.
7. Promptų versijos pakeltos:
   - `customer-reply-nb-v5`;
   - `customer-reply-polish-nb-v4`.

## 6. Patikrų įrodymai

Po galutinio regex pataisymo:

- `npx vitest run src/lib/messages/customer-reply.test.ts` — **PASS**, 18/18;
- `npm run typecheck` — **PASS**;
- `npm run lint` — **PASS**;
- `npm run test:ci:unit` — **PASS**, 182 failai / 715 testų;
- `npx prettier --check src/lib/messages/customer-reply.ts src/lib/messages/customer-reply.test.ts` — **PASS**;
- `git diff --check` — **PASS**;
- subagento `question_flow_peer_review` galutinis read-only review — **PASS**.

Subagentas papildomai atkūrė ir patvirtino:

- `systemet vårt` → ALLOW;
- `det interne systemet`, `et internt system`, `JSON konteksten`,
  `JSON-konteksten`, `KI-modellen`, `AI modellen` → BLOCK.

### Vietinis build apribojimas

`npm run build` šiame Windows ARM kompiuteryje sustoja Turbopack CSS žingsnyje,
nes build worker neranda pasirenkamo
`lightningcss.win32-arm64-msvc.node`. Tikslus `1.32.0` native paketas lokaliai
įdiegtas be `package.json` ar lock failo pakeitimų ir veikia tiesiogiai, tačiau
Turbopack worker jo neišsprendžia. Tai platforminis vietinio build apribojimas,
ne testų ar TypeScript klaida. Tikras build vartas yra Linux GitHub/Vercel
Preview. Šio apribojimo nereikia spręsti keičiant produkto dependencies be
atskiro sprendimo.

## 7. Repo higiena

Žemiau esantys untracked failai nėra šio pataisymo dalis. Jų nestage'inti,
netrinti ir nekeisti:

- `.agents/`
- `.tmp-playwright-32899222073/`
- `.tmp-playwright-32900220849/`
- `scripts/prod8-2-case-readonly.ps1`
- `scripts/prod8-2-case-readonly.ts`
- `scripts/prod8-2-create-price-drafts.ps1`
- `scripts/prod8-2-create-price-drafts.ts`
- `scripts/prod8-2-preflight-readonly.ps1`
- `scripts/prod8-2-preflight-readonly.ts`
- `scripts/prod8-2-provider-probe.ts`
- `skills-lock.json`
- `tmp/`

Visada stage'inti tik konkrečiai įvardytus failus. Nenaudoti `git add .`.

## 8. Release būklė checkpointo metu

- Push į `origin/codex/master-platform-implementation` — **PASS**; origin ir
  lokalus HEAD sutampa su `f67d4e5`.
- PR `#52` atviras.
- Vercel check kandidatui `f67d4e5` rodo `Authorization required to deploy`.
  Tai nėra build rezultatas: Linux/Vercel build dar nepradėtas, kol savininkas
  nepatvirtino GitHub/Vercel autorizavimo nuorodos.
- Production nėra šio pataisymo taikinys ir neturi būti keičiama.
- Staging alias naudojamas savininko UAT:
  `https://takfornyelse-staging.vercel.app/admin-v2`.
- Po push būtina patikrinti, kad Preview deployment yra `READY`, jo SHA
  sutampa su darbo šaka ir staging alias rodo tą patį kandidatą.

## 9. Tikslūs sekantys veiksmai

### H-1 — Push ir Linux/Preview vartai

1. Patikrinti, kad origin ir lokalus HEAD tebėra `f67d4e5`.
2. Patikrinti GitHub PR `#52` checkus.
3. Vercel reikalauja savininko autorizavimo; pateikti savininkui tikslų
   autorizavimo linką ir vieną veiksmą.
4. Patvirtinti Linux/Vercel build `READY` bei tikslų deployment SHA.
5. Tik po to laikyti pataisymą paruoštu UAT.

**COMPLETE GOAL:** branch SHA, PR check ir Preview deployment sutampa; Linux
build žalias; Production nepakeista.

### H-2 — Savininko Preview UAT

1. Atidaryti sintetinę bylą `#17` arba naują sintetinę bylą, jei `#17`
   nebetinka būsenai atkurti.
2. Atšaukti netinkamą neišsiųstą juodraštį, jei jis dar aktyvus.
3. Sukurti naują DI juodraštį.
4. Patikrinti, kad:
   - nėra `kildegrunnlag` ar kitos vidinės techninės terminijos;
   - aiškiai atsakyta, ar impregnavimas įtrauktas;
   - aiškiai paaiškinta, kad papildoma paslauga reikalauja atnaujinto ar
     atskiro pasiūlymo;
   - kainos ir maksimalios kainos faktai sutampa su aktyvia versija;
   - kontrolinio matavimo paaiškinimas neapeina maksimalios kainos ir
     rašytinio pakeitimo susitarimo.
5. Savininkas neturi siųsti juodraščio, kol nepateikia jo tekstinės kopijos
   patikrai.

**COMPLETE GOAL:** naujas DI juodraštis yra profesionalus, pilnas, faktinis,
be vidinės kalbos; savininkas aiškiai patvirtina `Preview question draft PASS`.

### H-3 — Klausimo srauto UAT užbaigimas

Po H-2 patikrinti likusius `prod8-owner-uat-checklist` C skyriaus kriterijus:

- vienas klausimas, vienas aktyvus redaktorius ir vienas pagrindinis CTA;
- siuntimas blokuojamas pasikeitus source fingerprint;
- signavimas pristabdytas iki pristatyto atsakymo;
- kliento sėkmės kortelė/fokusas ir 2 000 simbolių skaitiklis;
- delivery failure palieka aiškų recovery kelią;
- tik pristatytas atsakymas atrakina tą pačią dokumento versiją.

**COMPLETE GOAL:** visas klausimo kelias pažymėtas `PASS` arba konkretus
atkuriamas trūkumas turi siaurą pataisą ir regresijos testą.

### H-4 — Production sprendimas

Tik po H-1–H-3 PASS paruošti production pakeitimo manifestą, rollback ir
trumpą rizikos santrauką. Production nekeisti, kol savininkas konkrečiai
neparašo `Production GO` šiam kandidatui.

### H-5 — Tolimesnis planas

Po klausimų srauto Production sprendimo tęsti likusius PROD-8 UAT etapus.
`Case Workspace V3` pradėti tik kaip atskirą fazinį darbą pagal
`docs/admin-v2-case-workspace-v3-spec.md`. V3 kol kas yra specifikacija, ne
užbaigta implementacija.

## 10. Griežtos STOP sąlygos

Sustabdyti tik susijusį veiksmą ir informuoti savininką, jeigu:

- branch, Preview alias arba deployment SHA nesutampa;
- reikia keisti Production, DB, env, secret, webhook ar išorinę paskyrą;
- UAT byloje matomi realaus kliento duomenys;
- DI juodraštis vis dar turi vidinės terminijos arba netikslius komercinius
  faktus;
- testas ar Linux build raudonas;
- veiksmas galėtų išsiųsti laišką be savininko aiškaus patvirtinimo.

Nepriklausomus saugius darbus galima tęsti, tačiau STOP radinys turi būti
užfiksuotas checkpointe arba naujoje fazės ataskaitoje.

## 11. Būsena perduodant

- Siaura DI vidinės kalbos pataisa: **CODE PASS / PEER REVIEW PASS**.
- Lokalūs testai: **PASS**, išskyrus aiškiai dokumentuotą Windows ARM
  Turbopack native modulio build apribojimą.
- GitHub push: **PASS**, HEAD `f67d4e5`.
- Linux CI / galutinis Preview kandidatas: **BLOCKED / OWNER ACTION** —
  autorizuoti Vercel deploy iš PR `#52`, tada sulaukti `READY`.
- Preview savininko UAT naujam DI juodraščiui: **PENDING**.
- Production: **NO CHANGE / NO GO**.
