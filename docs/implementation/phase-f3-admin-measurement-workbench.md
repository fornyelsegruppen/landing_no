# F3 – admin matavimo darbo vieta

**Būsena:** GO  
**Data:** 2026-08-25  
**Staging deployment:** `dpl_5bvqzTLcqv5TtrfFeU6A3sQGGSGy`  
**Staging URL:** `https://takfornyelse-staging.vercel.app`

## Pasiektas rezultatas

- `admin-v2` byloje administratorius koreguoja adresą ir paslaugą, randa Kartverket adresą bei OSM pastatų kontūrus ir pasirenka konkretų pastatą.
- Kandidatai rodomi numeruotame scheminiame žemėlapyje ir kortelėse su tipu, horizontaliu plotu, atstumu bei patikimumu.
- Kampo grupė perskaičiuoja deterministinę ploto peržiūrą; išsaugojus kuriama nauja nekintama matavimo versija ir F2 matavimo įrodymas.
- Kai kontūro naudoti negalima, leidžiamas `manual_no_visual` plotas (10–5000 m²) su privalomu šaltiniu ir pagrindimu.
- Didesnis nei 20 % rankinis nuokrypis server-side atmetamas, kol administratorius jo aiškiai nepatvirtina antrą kartą.
- Adreso, paslaugos, kandidato, kampo ir rankinio ploto veiksmai audituojami; kandidatą serveris prieš išsaugojimą pakartotinai gauna iš šaltinio.
- Optimistic concurrency neleidžia pasenusiam administratoriaus langui tyliai perrašyti naujesnės bylos versijos.
- Kasdieniam scenarijui Payload backoffice nereikalingas.

## Automatinė verifikacija

- `npm run typecheck` – PASS.
- `npm run lint` – PASS, 0 warnings.
- `npm run test:ci:unit` – PASS, 128 failai / 418 testų.
- `npm run test:ci:migrations` – PASS, 16 failų / 28 testai.
- Linux/Vercel production build – PASS.
- Vietinis Windows ARM64 build sukompiliuoja ir praeina TypeScript, bet page-data etape lieka ankstesnis `@libsql/win32-arm64-msvc` optional binary apribojimas; oficialus Linux vartas yra žalias.
- Protected Preview smoke – PASS.

## Autentifikuotas staging priėmimas

Anoniminė sintetinė byla `#10` (`qa.invalid`, ne klientas):

1. Vieša norvegiška forma sėkmingai sukūrė bylą ir automatinį `TM-10-V1` paketą.
2. Adresui `Lyngveien 28A, 1182` rasti 8 pastatų kandidatai; pagrindinis namas pažymėtas `high` ir formulė parodyta prieš išsaugojimą.
3. Administratoriaus patvirtintas kandidatas sukūrė `TM-10-V2`; po pilno perkrovimo liko tiksliai vienas pažymėtas kandidatas ir matavimo įrodymas.
4. Rankinis 200 m² pakeitimas nuo ankstesnio matavimo pirmu bandymu gavo `409` ir parodė >20 % antro patvirtinimo kontrolę; tik pažymėjus patvirtinimą sukurtas `TM-10-V3`.
5. Dviejuose vienu metu atidarytuose tos pačios bylos languose pirmas adreso pakeitimas išsisaugojo, o antras pasenęs langas gavo `CASE_REVISION_CONFLICT`.
6. 375 px mobiliame viewport: `scrollWidth=375`, `clientWidth=375`; visi pagrindiniai matavimo veiksmai pasiekiami.

Sintetinė byla pažymėta aiškiu testiniu vardu ir neturi realaus kliento kontaktų.

## Fazės vartas

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PASS
ROLLBACK_READY=YES
```
