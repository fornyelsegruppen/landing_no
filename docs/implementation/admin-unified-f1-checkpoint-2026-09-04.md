# Takfornyelse unified admin — F1 checkpoint

**Data:** 2026-09-04
**Branch:** `codex/unified-admin-f0`
**Būsena:** `FUNCTIONAL LOCAL GREEN / VISUAL REMEDIATION ACTIVE / BRANCH CI PENDING`
**Production:** `NO-GO`; nepakeista

## Rezultatas

F1 sukūrė vieną bendrą operatoriaus shell ir bendrus sąveikos kontraktus.
`/admin-v2` ir perkelti `/admin-next-preview` moduliai naudoja tą patį
`AdminNextShell`; trečia aplikacija ar naujas namespace nesukurti. Legacy domeno
komandos, jų autorizacija, CAS, idempotency ir duomenys nepakeisti.

| Darbas | Rezultatas |
|---|---|
| `UA-F1-001` | Semantiniai `--an-*` tokenai turi atskiras action, danger, success ir info reikšmes, reduced-motion bei forced-colors kontraktą. Naujo raw HEX skolos neleidžia CI lint vartas. |
| `UA-F1-002` | Vienas responsive shell, skip link, penki pirminiai darbų keliai, administravimo grupė ir aiškiai atskirtas Payload techninis admin. Klaidingas Preview `Bylos → Šiandien` ryšys pašalintas. |
| `UA-F1-003` | `Ctrl/Cmd+K` paieška naudoja autentifikuotą `/api/admin/search`, grupuoja leidžiamus rezultatus ir išlaiko `returnTo`. Dabartiniame dviejų rolių modelyje endpoint prieinamas tik aktyviam admin. |
| `UA-F1-004` | Tipizuoti `StatusBadge`, `OwnerChip`, `DueIndicator`, `BlockerSummary`, `VersionBadge` ir `SyncState`; blocker nenaudoja action gintaro. |
| `UA-F1-005` | Vienas Radix pagrįstas overlay su focus trap/return, inert/scroll-lock, Esc/outside/Back politika, dirty guard ir nested overlay draudimu. |
| `UA-F1-006` | Bendras async regionas turi tikslaus veiksmo pavadinimą, 150 ms ribą, pending/success/error/offline, correlation ID ir tik saugiam retry rodomą veiksmą. |
| `UA-F1-007` | `ReviewAndCommit` rodo automatinį preflight, kas pasikeis, kas nebus daroma, būseną po veiksmo ir idempotency; ritualinis checkbox netaikomas rutininiam veiksmui. |
| `UA-F1-008` | Rollout žodynas `legacy_only → shadow_read → preview → canonical`, fail-closed fixture ir izoliuotas komponentų katalogas. Visi domeno moduliai lieka `preview`, ne `canonical`. |

## Patikros

| Patikra | Rezultatas |
|---|---|
| TypeScript | PASS |
| Lint + semantic token gate | PASS; tik ankstesnis vienas `<img>` warning |
| Admin Next testai | 30 failų / 113 testų PASS |
| Pilni unit/API testai | 301 failas / 1410 testų PASS |
| Migracijos | 22 failai / 42 testai PASS |
| Vietinis Playwright | 9 vieši / anoniminės saugos scenarijai PASS; 2 autentifikuoti scenarijai palikti branch CI synthetic paskyroms |
| Next produkcinis buildas | PASS; 79 statiniai puslapiai, naujas `/api/admin/search` ir Preview katalogo route |
| Vizualinė patikra | 1440 ir 375 px Today bei komponentų katalogas telpa, bet nepriklausomas auditas atvėrė privalomas 768/1024 patikras, mobile Case etapų persidengimą ir kontrasto pataisą. Vizualinis vartas dar neuždarytas. |

Vietinis buildas naudojo izoliuotą SQLite fallback turiniui ir x64 Node dėl
dokumentuoto Windows ARM64 `libsql` paketo apribojimo. Branch CI pakartos buildą
su švariu `npm ci`, Ubuntu ir PostgreSQL.

## Vizualiniai įrodymai

Žr. [F1 evidence README](evidence/admin-unified-f1/README.md). Vaizdai sukurti
iš tikro šios šakos Next.js renderio, ne iš generinio maketo. Fixture maršrutai
Production aplinkoje visada grąžina `404`.

## Kitas vartas

1. Commitinti ir pushinti F1 funkcinį pagrindą į branch.
2. Uždaryti nepriklausomo vizualinio audito P0 pataisas ir 375/768/1024/1440 evidence.
3. Gauti žalią pilną Ubuntu/PostgreSQL CI, tada uždaryti F1 vartą ir integruoti F2
   kanoninį `CaseNextActionPresentation`, Today prioritetą bei bylos One Card.
   Production lieka nepaliesta.
