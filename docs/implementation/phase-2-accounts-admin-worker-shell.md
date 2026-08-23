# Fase 2 – kontoer, admin og worker-skall

**Status:** Fullført

**Dato:** 23. august 2026

**Branch:** `codex/master-platform-implementation`

## 1. Resultat

Applikasjonen har nå to eksplisitte interne kontotyper og to separate interne flater:

- `admin` bruker Payload på `/admin`;
- `worker` bruker den mobiltilpassede portalen på `/user`.

Ukjent eller historisk rolle gir aldri administratorrettigheter. Den offentlige siden og produksjonsmiljøet er ikke endret.

## 2. Konto- og sessionsikkerhet

- `users.role` er standardisert til `admin | worker`;
- `active` må være eksplisitt `true` for all intern tilgang;
- gamle `editor`-kontoer migreres til **inaktive workers** og deres sessionsrader slettes;
- innlogging av en inaktiv konto avvises i `beforeLogin`;
- deaktivering tømmer Payload-sessions umiddelbart;
- den første brukeren blir alltid administrator;
- senere nye kontoer blir worker som standard;
- administrator må velge eksplisitt dersom en senere konto skal være admin;
- den siste aktive administratoren kan ikke deaktiveres eller nedgraderes;
- maks fem mislykkede innloggingsforsøk og åtte timers tokenlevetid er konfigurert.

## 3. Autorisasjon

Alle eksisterende innholdsaccess-funksjoner som tidligere tillot `editor`, er nå admin-only. Worker avvises dermed fra:

- Payload-admin;
- henvendelser og offentlig innholdsredigering;
- preview;
- private systemcollections og admin-API-er;
- endring av ansatte og arbeid.

`work-orders.read` returnerer en server-side Payload-filterregel på `assignedWorker = req.user.id`. Det betyr at samme regel gjelder ved direkte REST-kall, ikke bare i grensesnittet. Oppdragssiden bruker i tillegg samme filter og svarer med identisk 404 både når objektet mangler og når det tilhører en annen worker.

## 4. `/admin`

Payload-navigasjonen er forenklet i følgende områder:

- Oversikt;
- Henvendelser;
- Arbeid;
- Blogg;
- Ansatte;
- Innstillinger.

Ny oversikt viser:

- nye henvendelser;
- tilbud til godkjenning (tom kø frem til tilbudsfasen);
- kontrakter til signering (tom kø frem til kontraktsfasen);
- aktive oppdrag;
- automatiseringsjobber som krever oppmerksomhet;
- oppdrag som mangler tildeling.

Ansatte opprettes og deaktiveres i `Ansatte`. Deaktivering er en reversibel handling og sletter ikke brukeren eller historikken.

## 5. `/user`

Det mobil-første skallet inneholder:

- egen norsk innloggingsside;
- generisk feiltekst som ikke røper om e-post eller konto finnes;
- personlig toppfelt og utlogging;
- bunnnavigasjon med safe-area-støtte;
- `Mine oppdrag i dag`;
- `Kommende oppdrag`;
- `Oppdrag som må ferdigstilles`;
- sikker oppdragsdetalj på `/user/arbeid/[id]`.

Det minimale `work-orders`-skallet har referanse, eventuell leadrelasjon, tildelt worker, planlagt tidspunkt, status og arbeidsbeskrivelse. Worker kan foreløpig bare lese egne oppdrag. Startknapper, prisendring og utførelsesstatus er bevisst ikke aktivert før arbeidsordrefasen implementerer før-kontroll og forretningsregler.

## 6. Migrasjon

To additive migrasjoner er opprettet:

1. konto-/rolleendring og minimal `work_orders`-collection;
2. sikker database-default til `worker` for senere kontoer.

SQL-testen kjører mot isolert PostgreSQL-kompatibelt miljø og kontrollerer at:

- aktiv admin forblir aktiv admin;
- legacy editor blir inaktiv worker;
- editorens session slettes;
- ny DB-konto får worker-default;
- work order kan tildeles en worker;
- rollback mapper worker tilbake til historisk editor før enum gjenopprettes.

## 7. Verifikasjon

| Kontroll | Resultat |
|---|---|
| `npm run generate:types` | Bestått |
| `npm run generate:importmap` | Bestått; adminoversikt registrert |
| `npm run typecheck` | Bestått |
| `npm run lint` | Bestått |
| `npm test` | Bestått; 30 testfiler / 94 tester |
| Fase-2 SQL up/down | Bestått i isolert PostgreSQL-miljø |
| Produksjonsbuild med Postgres-adapter | Bestått; `/admin`, `/user`, `/user/login` og `/user/arbeid/[id]` bygget |
| Mobil visuell test | Bestått ved 390 × 844 px |
| Uautorisert `/user` | Bestått; redirect til `/user/login` |
| Generisk loginfeil | Bestått; ingen kontoeksistens lekkes |
| Utlogging | Payload logout-kall og redirect testet automatisk |
| `git diff --check` | Bestått |

Full happy-path-innlogging med ekte konto og production-like database gjentas i stagingpilot. Ingen ekte passord eller kundedata ble brukt i lokal visuell test.

## 8. Gate 2

**BESTÅTT.** Rolleparseren er deny-by-default, worker kan ikke åpne admin eller andre workers objekter, inaktiv konto mister tilgang, den mobile portalen bygger og er visuelt kontrollert, og alle nye collections har eksplisitte access-regler.

Neste fase er bloggfundament og offentlig norsk artikkelmal. AI-publisering forblir avslått.
