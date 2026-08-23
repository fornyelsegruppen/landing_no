# Fase 3 – bloggfundament og offentlig artikkelmal

**Status:** Fullført

**Dato:** 23. august 2026

**Branch:** `codex/master-platform-implementation`

## 1. Resultat

CMS og det offentlige nettstedet er klare for kontrollert norsk SEO-innhold. AI er fortsatt ikke koblet til publisering. En administrator kan opprette, kontrollere, forhåndsvise, planlegge og publisere artikler, mens offentlige sider bare viser publiserte språkversjoner som faktisk finnes.

## 2. Redaksjonell modell

- `seo-topics` lagrer kandidattema, søkeintensjon, søkeord, tjeneste, sted, datakilde, topic score, overlap score og beslutningsgrunnlag;
- `seo-runs` lagrer ikke-sensitive spor for kjøringer, modeller, prompt-/kunnskapsversjon, QA-resultat og sanitert feilstatus;
- `posts` har nå redaksjonell status, planlegging, primære og sekundære søkeord, tjeneste/sted, kilder, forfatter, faglig kontrollør, kontrolldato, QA-score, relaterte artikler/tjenester, FAQ og CTA-variant;
- norsk tittel og innhold er obligatorisk, mens engelsk er valgfritt;
- publisering blokkeres uten forfatter, kontrollør, kontrolldato og godkjent redaksjonell status;
- AI kan senere opprette utkast, men ingen AI-rute kan publisere direkte.

## 3. Offentlig artikkelmal og SEO

- sikker Markdown støtter overskrifter, avsnitt, fet tekst, lister, sitater og lenker uten rå HTML;
- `javascript:` og `data:`-lenker avvises;
- interne lenker får riktig språkprefix;
- canonical, Open Graph, Twitter card, `BlogPosting`, `WebPage`, breadcrumbs og valgfri `FAQPage` er implementert;
- forfatter, faglig kontrollør, kontrolldato og kilder vises synlig;
- relaterte artikler og tjenester vises bare når relasjonen kan løses sikkert;
- norsk artikkel får ikke falsk engelsk URL, `hreflang` eller sitemap-rad;
- engelsk URL opprettes først når både engelsk tittel og innhold finnes;
- draft preview er adminbeskyttet, peker bare til samme locale og får `noindex, nofollow`;
- publiserte språkversjoner legges i sitemap med gjensidige alternativer.

## 4. Konverteringsmåling

Artikkel-CTA sender egne Google- og Meta-events. Når en kunde går fra en artikkel til kontaktskjemaet, lagres siste gyldige artikkelsti i 30 minutter. Feltet `contentSourcePath` vises i henvendelsens adminvisning uten å overskrive opprinnelig UTM-, GCLID- eller Meta-attribusjon.

Både klienten og lead-API-et tillater bare interne stier på formen `/no/blogg/slug` eller `/en/blogg/slug`; forfalskede eksterne verdier avvises.

## 5. Migrasjon

Migrasjon `20260823_150443_phase3_blog_foundation`:

- oppretter SEO topic/run-tabeller og post-relasjoner;
- utvider live- og versjonstabellene for artikler;
- legger til artikkelattribusjon på henvendelser;
- har korrigert rollback-rekkefølge for kryssrelasjoner;
- er kjørt både `up` og `down` mot isolert PostgreSQL-kompatibelt miljø.

Rollback-testen bekrefter at eksisterende `posts`, `services`, `leads` og versjonstabeller beholdes.

## 6. Verifikasjon

| Kontroll | Resultat |
|---|---|
| `npm run generate:types` | Bestått |
| `npm run generate:importmap` | Bestått |
| `npm run typecheck` | Bestått |
| `npm run lint` | Bestått uten warnings |
| `npm test` | Bestått; 36 testfiler / 111 tester |
| Fase-3 SQL up/down | Bestått i isolert PostgreSQL-miljø |
| Produksjonsbuild med Postgres-adapter | Bestått; artikkelruten og alle offentlige/admin-ruter bygget |
| Manuell artikkelflyt | Bestått automatisk: norsk draft → preview → redaksjonell publisering → CTA → attribuert lead |
| Mobil bloggindeks | Bestått ved 390 × 844 px |
| Mobil artikkelmal | Bestått ved 390 × 844 og 390 × 1600 px med forfatter, kontrollør, Markdown, FAQ, kilder og CTA |
| `git diff --check` | Kjøres før commit |

Den visuelle artikkeltesten brukte et lokalt, tydelig merket testinnlegg fordi produksjonsdata ikke skal kopieres inn i utviklingsmiljøet. Testinnlegget og den midlertidige fallback-koden ble fjernet etter kontrollen. Ekte CMS-dataflyt gjentas etter migrasjon i staging.

## 7. Gate 3

**BESTÅTT.** Norsk-only innhold fungerer, draft lekker ikke offentlig, språk-URL-er og sitemap er sannferdige, artikkelmalen er mobilkontrollert, og CTA/leadattribusjon er testet uten å påvirke eksisterende annonseattribusjon.

Neste fase er den AI-assisterte innholdsmotoren. Den skal bare opprette kontrollerbare utkast og kan aldri publisere uten eksplisitt administratorgodkjenning.
