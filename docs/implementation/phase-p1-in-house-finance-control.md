# Phase P1F — in-house økonomistyring med manuell Fiken-faktura

Dato: 2026-08-26  
Eierbeslutning: bekreftet 2026-08-26  
Status: kjerne implementert lokalt; staging-UAT gjenstår

## Mål

Takfornyelses adminløsning skal være operativt kontrollsenter for forskudd, offisielle fakturakopier, betalinger, påminnelser, dokumentarkiv og regnskapseksport. Fiken brukes manuelt som kilde for offisiell faktura og lovlig fakturanummer. Det bygges ingen Fiken API-integrasjon i denne fasen.

## Kilder til sannhet

- Kundesak og tidslinje: Takfornyelse admin.
- Offisiell faktura, kreditnota og nummer: original PDF fra Fiken.
- Mottatt betaling: administratorens kontrollerte bankregistrering.
- Kontraktspris og forskudd: låst, versjonert pris-/kontraktsnapshot.

## Arbeidsflyt

### Forskudd

1. Standard er `0 %`.
2. Administrator kan angi `0–100 %` før tilbudet sendes.
3. Beløpet beregnes deterministisk av kontraktspris inkl. mva.
4. Etter begge signaturer opprettes en intern betalingsanmodning merket `IKKE MVA-FAKTURA` med forfall etter to kalenderdager.
5. Betaling registreres manuelt etter bankkontroll. Beløp og dato er obligatorisk; bankreferanse er valgfri.
6. Arbeidet er blokkert frem til mottatt forskudd eller begrunnet, auditert admin-unntak.

### Offisiell faktura

1. Ferdig arbeid gir et internt `Fakturagrunnlag`, aldri et betalingskrav.
2. Administrator lager offisiell faktura manuelt i Fiken.
3. Fra riktig kundesak lastes original Fiken-PDF opp.
4. Systemet leser forslag til fakturanummer, fakturadato, forfall og beløp fra PDF-tekst. OCR/AI er bare fallback.
5. Administrator ser PDF-preview og må bekrefte metadata før lagring/utsendelse.
6. Filhash og fakturanummer blokkerer duplikat. Originalen er privat og uforanderlig.
7. Kunden mottar den uendrede Fiken-PDF-en i Takfornyelses merkede e-post etter separat admin-godkjenning.
8. Rettelser skjer med kreditnota og ny faktura, aldri ved å erstatte originalfilen.

### Betaling og påminnelser

- Status: `utstedt → sendt → venter betaling → betalt | forfalt | kreditert`.
- Betaling krever beløp og dato; bankreferanse er valgfri.
- Systemet kan foreslå `forfalt`, men kan ikke sende påminnelse automatisk.
- Før påminnelse må administrator registrere `Bank kontrollert` med dagens tidspunkt.
- Påminnelsen er først en vennlig betalingspåminnelse, ikke automatisk inkassovarsel.
- Idempotency hindrer dobbeltutsendelse.

### Månedseksport

- Administrator velger måned og genererer ZIP + CSV.
- Pakken inneholder originale fakturaer, kreditnotaer, betalingsregister, forskudd, tilbakebetalinger, dokumenthash og saksreferanser.
- Eksport logges i audit trail, men endrer ingen finansstatus.
- Første pilot bruker manuell sikker overføring til bokfører. Egen bokførerrolle vurderes senere.

## Datakrav

- Fiken-fakturanummer, originalfil, filhash, fakturadato, forfallsdato, beløp eks. mva., mva. og total.
- `extractionStatus`: `pending | needs_review | confirmed | failed`.
- `invoiceStatus`: `draft_basis | ready_for_fiken | issued | sent | awaiting_payment | paid | overdue | credited | cancelled`.
- `payment`: beløp, dato, valgfri bankreferanse, registrert av/tidspunkt.
- `bankCheckedAt` og `bankCheckedBy` før påminnelse.
- Tidslinjehendelse for upload, bekreftelse, utsendelse, betaling, forfall, påminnelse, kreditnota og eksport.

## PASS-kriterijai

- Original Fiken-PDF kan lastes opp bare av administrator fra en konkret sak.
- PDF-data blir aldri endelige uten eksplisitt admin-bekreftelse.
- Samme fakturanummer eller filhash kan ikke registreres to ganger.
- Kunden mottar nøyaktig originalfilen som administrator kontrollerte.
- Betaling kan ikke registreres uten beløp og dato; bankreferanse kan stå tom.
- Påminnelse kan ikke sendes uten bankkontroll samme dag og separat admin-godkjenning.
- Alle dokumenter og hendelser er synlige i sak, finansarkiv og tidslinje.
- Månedseksporten er komplett, reproduserbar og auditert.

## Implementeringsstatus 2026-08-26

### Implementert og automatisk testet

- `0 %` forskudd som standard og valgfritt administratorstyrt prosentfelt i kommersiell pakke.
- Deterministisk forskuddsbeløp låst i tilbuds-/kontraktsnapshot og vist i PDF med to kalenderdagers frist.
- Privat import av original Fiken-PDF fra konkret fakturagrunnlag.
- PDF-tekstuttrekk med eksplisitt admin-kontroll; manuelt fallback når felt ikke kan leses sikkert.
- Duplikatvern med originalfilens SHA-256 og unikt Fiken-fakturanummer.
- Uforanderlig original etter bekreftelse og kontrollerte statustransisjoner.
- Separat administratorhandling for utsendelse av original-PDF som vedlegg i merket e-post.
- Bankkontroll, betalingsdato og mottatt beløp; bankreferanse er valgfri.
- Betalingspåminnelse opprettes bare som utkast etter bankkontroll samme Oslo-dato.
- Dokumentarkiv viser offisielle Fiken-fakturaer sammen med resten av kundesaken.
- Månedlig ZIP-eksport med originale PDF-er, semikolonseparert CSV og audit-hendelse.

### Ikke godkjent før staging-UAT

- Visuell kontroll av alle tre adminspråk og mobilvisning.
- Reell Fiken-PDF fra kontrollert testfaktura gjennom upload → review → send → payment.
- E-postvedleggets byte/hash sammenlignes med opplastet original.
- Måneds-ZIP åpnes og avstemmes manuelt mot testdata.
- Forskuddsbetalingsanmodning etter begge signaturer, blokkering av arbeidsstart og avregning mot sluttfaktura må ferdigstilles i egen P2-del før forskudd brukes i pilot.
