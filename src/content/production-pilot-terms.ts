export const PRODUCTION_PILOT_TERMS = {
  version: "PRODUCTION-PILOT-V1",
  title: "Håndverkerkontrakt for takarbeid – kontrollert produksjonspilot",
  ownerApprovalReference: "OWNER-APPROVED-CONTROLLED-PILOT-2026-08-26",
  withdrawalFormUrl: "https://www.takfornyelse.as/no/angreskjema",
  contractText: `1. PARTENE OG AVTALEGRUNNLAGET

Tjenesteyter er Fornyelse Gruppen AS, org.nr. 916 693 168 MVA, registrert i Foretaksregisteret, Lyngveien 28, 1182 Oslo, som driver Takfornyelse. Kontakt: post@takfornyelse.as og +47 47 73 58 88.

Kunden, arbeidsstedet, tjenesten, tilbudsreferansen, måleversjonen, prisberegningen og eventuelle vedlegg fremgår av tilbudet. Tilbudet, disse vilkårene, godkjente endringsavtaler og den endelig signerte PDF-en utgjør samlet avtale. Ved motstrid går en senere skriftlig og signert endringsavtale foran den opprinnelige avtalen. Ufravikelige forbrukerrettigheter gjelder alltid.

2. ARBEIDETS OMFANG

Takfornyelse utfører bare tjenestene og leveransene som er uttrykkelig beskrevet i det valgte tilbudet. Arbeidet skal utføres fagmessig og i samsvar med gjeldende sikkerhetskrav. Skjulte skader, råte, konstruksjonsfeil, asbest, elektriske forhold, utskifting av undertak eller andre arbeider som ikke er uttrykkelig angitt, er ikke inkludert.

Dersom Takfornyelse før eller under arbeidet avdekker forhold som gjør den bestilte løsningen uforsvarlig eller lite hensiktsmessig, skal kunden varsles. Berørt arbeid stanses når det er nødvendig for sikkerhet, kvalitet eller avklaring av pris og omfang.

3. TAKMÅLING, FORUTSETNINGER OG PRIS

Tilbudet bygger på den målemetoden, takflaten, vinkelen og de forutsetningene som fremgår av tilbudet. Kart- eller bildebasert måling er et estimat. Takareal, takvinkel, tilkomst og synlig tilstand kontrolleres på stedet før arbeidet starter. Ved manuelt areal uten kartvedlegg fremgår kilde og administrators begrunnelse av tilbudet.

Tilbudet viser pris ekskl. merverdiavgift, merverdiavgift, pris inkl. merverdiavgift, avtalt toleranse og eventuell maksimalpris. Forbrukeren skal aldri betale mer enn avtalt maksimalpris uten en ny skriftlig endringsavtale. Dersom kontrollmålingen gir lavere prisgrunnlag, reduseres prisen etter samme avtalte enhetspris og beregningsregel. Dersom kontrollen viser et større areal eller annet omfang som overstiger avtalt toleranse eller maksimalpris, stanses berørt arbeid til kunden har mottatt og skriftlig akseptert en endringsavtale.

En prisangivelse omfatter merverdiavgift og andre offentlige avgifter med mindre noe annet er uttrykkelig og lovlig opplyst. Der en pris er et prisoverslag og ikke en uttrykkelig avtalt maksimalpris, gjelder håndverkertjenesteloven § 32.

4. TILLEGGSARBEID OG ENDRINGER

Tilleggsarbeid skal som hovedregel beskrives og prises skriftlig før det utføres. Endringsavtalen skal vise årsak, tidligere og nytt omfang, tidligere og ny pris, merverdiavgift og eventuell ny fremdrift. Berørt arbeid kan ikke fortsette før nødvendig godkjenning er registrert. Arbeid som ikke kan utsettes uten fare for vesentlig skade, håndteres i samsvar med håndverkertjenesteloven.

5. OPPSTART, FREMDRIFT OG VÆR

Planlagt dato og ankomstintervall bekreftes skriftlig. Arbeid på tak er vær- og sikkerhetsavhengig. Regn, vind, temperatur, snø, is, manglende sikker tilkomst, skjulte forhold eller andre forhold utenfor Takfornyelses rimelige kontroll kan gjøre det nødvendig å flytte eller stanse arbeidet. Kunden varsles så snart som praktisk mulig og får oppdatert plan. Avtalte og lovbestemte rettigheter ved forsinkelse påvirkes ikke av dette punktet.

6. KUNDENS MEDVIRKNING

Kunden skal gi riktige opplysninger, sørge for avtalt og sikker tilgang til eiendommen, opplyse om kjente svakheter eller farer og flytte eller beskytte gjenstander som på forhånd er avtalt. Kunden skal være tilgjengelig på oppgitt telefon eller e-post ved avklaringer. Takfornyelse er ikke ansvarlig for forsinkelse eller merkostnad som direkte skyldes manglende medvirkning, utover det som følger av ufravikelig lov.

7. KONTROLL PÅ STEDET OG SIKKERHETSSTOPP

Før oppstart dokumenterer medarbeideren synlig tilstand, tilkomst, relevante HMS-forhold og kontrollmåling. Arbeid starter bare når systemet og ansvarlig medarbeider viser at oppdraget er klart. Ved HMS-risiko, uavklart bygg, vesentlig arealavvik, skjult skade eller endret omfang stanses oppstarten og saken sendes til administrator.

8. BETALING, FORSKUDD OG FAKTURA

Standardvalget er ingen forskuddsbetaling. Før tilbudet sendes kan administrator uttrykkelig angi en forskuddsprosent. Tilbudet og kontrakten skal da vise valgt prosent, forskuddsbeløp inklusive merverdiavgift som prisinformasjon, gjenstående kontraktsbeløp og at forskuddet kommer til fradrag i sluttoppgjøret. Kunden skal se samme beløp i webvisning, PDF og signeringsbildet før bestilling.

Forskuddet forfaller to kalenderdager etter at både kunden og Takfornyelse har signert den samme dokumentversjonen. Et avtalt forskudd gir ikke i seg selv rett til å starte før angrefristen er utløpt og begrenser ikke kundens angrerett eller øvrige lovfestede rettigheter. Når forskudd er avtalt, kan arbeidet ikke settes til «klart for oppstart» før betalingen er registrert, med mindre ansvarlig administrator gjør et særskilt, begrunnet og auditert unntak.

Offisiell faktura og regnskapsføring håndteres gjennom Fiken uten API-integrasjon i pilotfasen. Systemet lager ikke og sender ikke en vanlig MVA-faktura for et finansielt forskudd før levering. Etter full signering lager systemet en intern betalingsanmodning for avtalt forskudd, tydelig merket «IKKE MVA-FAKTURA». Administrator registrerer betaling manuelt etter kontroll i banken.

Etter utført arbeid lager systemet et fakturagrunnlag. Administrator oppretter den offisielle fakturaen manuelt i Fiken, laster ned original PDF og laster den opp fra riktig kundesak. Systemet foreslår fakturanummer, datoer og beløp fra PDF-en, men administrator må kontrollere og godkjenne opplysningene før utsendelse. Den uendrede Fiken-PDF-en sendes til kunden og oppbevares i sakens private dokumentarkiv. Endelig faktura viser kontraktspris, merverdiavgift, innbetalt forskudd og restbeløp. Interne PDF-er merket «FAKTURAUTKAST – IKKE BOKFØRT» er ikke betalingskrav. Når forskudd ikke er valgt, faktureres arbeidet etter ferdigstillelse med 14 dagers betalingsfrist. Kunden kan holde tilbake så mye av betalingen som er nødvendig for å sikre et dokumentert krav etter håndverkertjenesteloven.

9. AVBESTILLING, ANGRERETT OG TIDLIG OPPSTART

Forbrukeren kan avbestille oppdraget etter håndverkertjenesteloven §§ 39–40. Takfornyelse kan da kreve betaling for lovlig utført del og dokumentert tap i den utstrekning loven tillater.

Ved fjernsalg har kunden normalt 14 dagers angrerett fra avtaleinngåelsen. Fremgangsmåte og standard angreskjema følger tilbudet og den varige PDF-kopien. Dersom kunden uttrykkelig ber om oppstart før angrefristen er utløpt, kan kunden ved bruk av angreretten måtte betale et forholdsmessig beløp for arbeid som allerede er utført. Angreretten går først tapt når tjenesten er fullt levert, og bare når lovens krav til uttrykkelig forhåndssamtykke og erkjennelse er oppfylt.

Ved gyldig bruk av angreretten tilbakebetales mottatt forskudd uten unødig opphold og senest innen lovens frist, normalt 14 dager fra mottatt angremelding. Bare et lovlig forholdsmessig beløp for arbeid som faktisk er utført etter kundens uttrykkelige anmodning om tidlig oppstart, kan trekkes fra. Tilbakebetaling og eventuell korrigering registreres gjennom Fiken.

10. FORSINKELSE, MANGLER OG REKLAMASJON

Ved forsinkelse eller mangel har kunden de rettighetene som følger av håndverkertjenesteloven, blant annet rett til å holde tilbake betaling, kreve retting, prisavslag, heving eller erstatning når vilkårene er oppfylt. Kunden skal reklamere innen rimelig tid etter at forholdet ble eller burde blitt oppdaget. Ved arbeid på fast eiendom er den absolutte reklamasjonsfristen normalt fem år, uten at dette begrenser en eventuell lengre uttrykkelig garanti.

Reklamasjon sendes skriftlig til post@takfornyelse.as og bør inneholde oppdragsreferanse, beskrivelse og relevante bilder. Takfornyelse skal få rimelig mulighet til å undersøke og rette en mangel.

11. GARANTI OG FERDIGDOKUMENTASJON

Eventuell kommersiell garanti gjelder bare når kunden mottar et eget garantibevis som angir konkret arbeid, startdato, sluttdato, omfang og unntak. Garantien kommer i tillegg til og begrenser ikke kundens rettigheter etter loven. Ferdigdokumentasjonen kan inneholde kontrollert arbeidsomfang, faktisk areal, avvik og før-/etterbilder.

12. ELEKTRONISK SIGNERING OG DOKUMENTKOPI

Kunden godkjenner den viste dokumentversjonen ved å skrive fullt navn, tegne signatur og bekrefte de separate valgene i signeringsbildet. Systemet lagrer dokumenthash, signaturhash, tidspunkt, kontraktsversjon og nødvendige sikkerhetsopplysninger som bevis. Dette er en intern elektronisk signeringsmetode og omtales ikke som kvalifisert eID-signatur. Avtalen blir endelig i systemet når Takfornyelse har kontrollert og medsignert samme uendrede dokumentversjon. Kunden mottar den endelige PDF-kopien på varig medium.

13. PERSONVERN OG KOMMUNIKASJON

Personopplysninger behandles for å håndtere henvendelsen, inngå og oppfylle avtalen, dokumentere arbeidet, fakturere og håndtere rettskrav. Nærmere informasjon fremgår av personvernerklæringen. Operative meldinger om tilbud, avtale, tidspunkt, medarbeider, fremdrift og ferdigstillelse er en del av kundeforholdet og er ikke markedsføring.

14. KLAGER OG TVISTER

Partene skal først forsøke å løse saken skriftlig. Dersom partene ikke blir enige, kan forbrukeren be Forbrukertilsynet om mekling og eventuelt bringe saken videre til Forbrukerklageutvalget når vilkårene er oppfylt. Norsk rett gjelder. Avtalen begrenser ikke forbrukerens rett til å bruke lovlig verneting eller andre ufravikelige klageordninger.`,
  withdrawalInstructions: `Du har normalt rett til å gå fra denne fjernsalgsavtalen uten å oppgi noen grunn innen 14 dager fra dagen avtalen ble inngått. For å bruke angreretten må du før fristens utløp sende en tydelig melding til Fornyelse Gruppen AS / Takfornyelse, Lyngveien 28, 1182 Oslo, post@takfornyelse.as, +47 47 73 58 88. Du kan bruke standard angreskjema, men det er ikke obligatorisk.

Hvis du sender angremeldingen elektronisk gjennom løsningen, skal du få en bekreftelse på varig medium. Det er tilstrekkelig at meldingen er sendt før fristen utløper.

Hvis du uttrykkelig har bedt om at arbeidet skal starte før angrefristen er utløpt og deretter bruker angreretten, kan du måtte betale et forholdsmessig beløp for den delen som allerede er levert frem til du ga beskjed. Angreretten går tapt når tjenesten er fullt levert bare dersom du på forhånd uttrykkelig ba om tidlig oppstart og erkjente at angreretten da ville gå tapt etter full levering.

Angreretten gjelder ved siden av avbestillingsreglene i håndverkertjenesteloven. En forespørsel om endring eller kansellering etter signering behandles manuelt og bekreftes skriftlig av Takfornyelse.`,
} as const;
