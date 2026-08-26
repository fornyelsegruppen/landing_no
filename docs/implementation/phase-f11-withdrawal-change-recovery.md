# Phase F11 — Angrerett, endring og kundebevaring

## Mål

Gi kunden én sikker og ryddig kanal for å bruke angreretten eller be om endring/kansellering, uten e-postkaos og uten at systemet tar en automatisk juridisk beslutning. Administrator skal se hele saken, eventuell arbeidsstart skal fryses umiddelbart, og all oppfølging skal følge kundens dokumenterte valg.

## Avgrensning

- `Bruk angreretten` er en tydelig kundemelding, ikke en søknad som systemet kan avvise automatisk.
- `Be om endring eller kansellering` er en separat forespørsel som først endrer avtalen etter skriftlig avklaring.
- Valg av årsak er påkrevd av hensyn til analyse, men `Jeg ønsker ikke å oppgi årsak` er alltid et gyldig valg.
- Én løsningsorientert oppfølging krever et separat, frivillig og som standard avslått samtykke.
- Gemini eller annen AI kan oppsummere og foreslå neste handling, men kan ikke avgjøre angrerett, automatisk kontakte kunden eller klassifisere kundens verdi.

## Implementert flyt

1. Den endelig signerte kontraktens e-post inneholder en ny sikker kundelenke.
2. Kunden velger enten angrerett eller endring/kansellering.
3. Kunden velger strukturert årsak, valgfri kommentar og eventuelt separat kontakt-/tidsvalg.
4. Systemet oppretter et uforanderlig, tidsstemplet `customer-contract-requests`-bevis.
5. Nominell 14-dagersfrist, tidlig oppstart, arbeidsstatus og forskuddsindikacija registreres som administratorinformasjon; meldingen mottas uansett resultat.
6. Eksisterende eller fremtidig arbeidsstart sperres med `CUSTOMER_CANCELLATION_REQUEST`.
7. Kunden får straks en profilert mottaksbekreftelse.
8. Administrator får en umiddelbar neste handling i kundesaken og i den separate visningen `Angre- og endringsmeldinger`.
9. Administrator kontrollerer avtale, frist, utført arbeid og betaling, og velger deretter: avslutt, fortsett, lag alternativ, planlegg én tillatt oppfølging eller avslutt uten videre salgsoppfølging.
10. Kundens endelige avklaring opprettes som et administratorstyrt utkast; et rettslig eller økonomisk resultat sendes aldri ukontrollert.

## Susigrąžinimo indikatorius

- Grønn: kunden har uttrykkelig tillatt én oppfølging.
- Gul: administrator må vurdere saken; ingen automatisk salgsoppfølging.
- Rød: kunden har uttrykkelig bedt om å ikke bli kontaktet om alternativer.

Spalva yra darbo prioritetas, o ne kliento vertės ar teisių vertinimas.

## Baigimo kriterijai

- [x] Abu kliento veiksmai aiškiai atskirti.
- [x] Årsakslisten bevarer et gyldig valg om å ikke oppgi årsak.
- [x] Oppfølgingssamtykke er separat og ikke forhåndsvalgt.
- [x] Oppføringen lagrer kundens innsending, tidspunkt og avtale-/arbeidskontekst uforanderlig.
- [x] Arbeid og ny arbeidsopprettelse blokkeres til administrator har besluttet saken.
- [x] Kunden mottar automatisk mottaksbekreftelse.
- [x] Administrator har separat liste, sakskort og kontrollerte resultater.
- [x] Handlinger auditeres, og kundemeldingen blandes ikke med administratorens beslutning.
- [x] Migrasjons-, enhets- og regresjonstester finnes.
- [ ] Staging UAT: angrerett uten årsaksopplysning eller kontaktønske.
- [ ] Staging UAT: endringsforespørsel med samtykke til én oppfølging og valgt dato.

## Produkcijos vartai

Funkcija gali būti keliama į produkciją tik kai abu UAT scenarijai patvirtinti, gavimo el. laiškai gauti, darbo blokavimas ir administratoriaus sprendimo juodraščiai patikrinti, o staging migracija įvykdyta be klaidų.
