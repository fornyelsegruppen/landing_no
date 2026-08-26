# E0 — `admin-v2` bylos ergonomikos baseline

**Data:** 2026-08-26  
**Baseline commit:** `411efa060782eb2e76d33b94a398a3dd1657351e`  
**Branch:** `codex/master-platform-implementation`  
**Staging deployment:** `dpl_8PyBjR8FsuYL9CwVoWXpwFcHsisd`  
**Staging alias:** `https://takfornyelse-staging.vercel.app`  
**Rollback:** grąžinti staging alias į baseline deployment; duomenų migracija E0 metu neatliekama

## Inventorizacija

- Bylos read model: `src/lib/admin-v2/case-read-model.ts`.
- Bylos darbo vieta: `src/app/(admin-shell)/admin-v2/cases/[id]/page.tsx`.
- Bendras kito veiksmo komponentas: `src/components/admin-v2/case-action-panel.tsx`.
- Įmonės parašas: `src/components/admin-v2/company-signature-panel.tsx` ir `/api/admin/contracts/[id]/sign`.
- Dokumentų nuorodos: pasiūlymo PDF, privataus media PDF ir techniniai Payload įrašai.
- Dabartinis puslapis rodo atskiras viršutinę bylos ir `Kitas veiksmas` korteles, o sutarties kortelė yra gerokai žemiau dešinėje.
- Dabartinis read model pasirenka naujausią ne `superseded` pasiūlymą ir sutartį, tačiau neturi atskirų `vykdoma versija`, `galiojanti sutartis` ir versijų grandinės laukų.
- Dabartiniai rizikingi API tikrina objekto būseną ir dokumento hash, bet bendras veiksmo komponentas nesiunčia vieno bylos konteksto kontrakto visiems veiksmams.

## Operacinė būsenų matrica

| Stadija | Vykdoma versija | Galiojanti sutartis | Vienas kitas veiksmas |
|---|---|---|---|
| Nauja užklausa | nėra | nėra | parengti paketą / paprašyti informacijos |
| Pasiūlymo juodraštis | naujausias `T-Vn` | nėra arba ankstesnė pilnai pasirašyta sutartis | patvirtinti konkretų pasiūlymą |
| Pasiūlymas patvirtintas | konkretus `T-Vn` | ankstesnė pilnai pasirašyta sutartis, jei yra | siųsti konkretų pasiūlymą |
| Laukiama kliento | `T-Vn` ir `K-Vn` | ankstesnė pilnai pasirašyta sutartis, jei yra | laukti kliento |
| Klientas pasirašė | `K-Vn` | ankstesnė pilnai pasirašyta sutartis, jei yra | Takfornyelse pasirašo `K-Vn` |
| Abi šalys pasirašė | `K-Vn` | `K-Vn` | kurti arba planuoti darbą pagal `K-Vn` |
| Ruošiama V2 | `T/K-V2` | `K-V1` | veiksmas su V2; V1 lieka galiojanti |
| V2 pilnai pasirašyta | `K-V2` | `K-V2` | kurti/tęsti darbą pagal V2; V1 istorinė |
| Darbas aktyvus | darbo užsakymo sutarties versija | darbo užsakymo sutarties versija | vienas darbo eigos veiksmas |
| Darbas baigtas | galutinis dokumentų paketas | darbo sutarties versija | užbaigimo / sąskaitos / garantijos veiksmas |

## Žinomi baseline trūkumai

1. Viršuje nematomas konkretus pasiūlymo ir sutarties numeris.
2. Slenkant prarandamas bylos ir dokumento kontekstas.
3. CTA tekstas dažnai bendrinis ir neįvardija versijos.
4. V1 ir V2 ryšys matomas tik techniniuose įrašuose arba laiko juostoje.
5. Dokumento peržiūra ir veiksmas išdėstyti skirtingose puslapio vietose.
6. Read model neturi atskiro galiojančios sutarties apibrėžimo.
7. Lygiagrečiai atidaryto seno puslapio veiksmas ne visur turi vienodą stale-context apsaugą.

## E0 vartas

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```

**Sprendimas:** `GO` į E1. E0 nekeičia veikiančio UI, API, DB ar produkcijos.

