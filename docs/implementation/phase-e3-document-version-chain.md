# E3 — dokumentų versijų grandinė

**Data:** 2026-08-26  
**Aplinka:** lokali patikra; produkcija nepakeista

## Įgyvendinta

- Bylos viršutinėje darbo zonoje rodoma atskira pasiūlymų ir sutarčių grandinė chronologine tvarka `V1 → V2 → V3`.
- Kiekviena kortelė tekstu pažymi `vykdoma`, `galiojanti` arba `istorinė` ir atskirai rodo dokumento operacinę būseną.
- Matoma pakeičiama versija, paslauga, suma, maksimali suma, sukūrimo, kliento parašo ir įmonės parašo datos.
- Kiekvienos versijos mygtukas atidaro tik tos versijos PDF; istoriniai dokumentai lieka tik skaitymui.
- Dokumento hash ir Payload techninė nuoroda paslėpti po išskleidžiama `Techninė informacija` dalimi.
- LT, NO ir EN sąsajos terminai turi vienodą reikšmę.

## Patikra

- V1 ir V2 dokumentų URL bei hash nesusikeičia: automatinis testas **PASS**.
- V1 galioja, kol V2 laukia parašo: automatinis testas **PASS**.
- Tik abiejų šalių pasirašyta V2 tampa galiojanti: automatinis testas **PASS**.
- Komercinio konteksto ir read-model testai: **39/39 PASS**.
- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.

## Etapo vartai

```text
FUNCTIONAL_RESULT=PASS
TARGET_ACHIEVED=YES
REGRESSION_TESTS=PASS
STAGING_ACCEPTANCE=PENDING_E6_VISUAL_AUDIT
ROLLBACK_READY=YES
E3_LOCAL_GO=YES
```
