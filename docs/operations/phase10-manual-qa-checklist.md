# Samlet manuell QA-sjekkliste

Denne listen kjøres i staging i fase 11. Automatiske kontroller erstatter ikke punktene under.

- [ ] offentlig skjema på norsk og engelsk: tastatur, mobil, feil, samtykke, bilder og takk-side;
- [ ] 320, 375, 768 og 1440 px uten horisontal scroll eller skjult CTA;
- [ ] synlig fokus, riktige labels, logisk headingrekkefølge og meningsfull alt-tekst;
- [ ] `/admin`: innlogging, dashboard, blogg, lead, måling, pris, tilbud, kontrakt, endringsavtale, arbeid og attention-kø;
- [ ] `/user`: kun egne oppdrag, mobilbilder, statusrekkefølge, HMS-stopp, lavere pris, endringsstopp og dokumentasjon;
- [ ] tilbud, PDF, signering og endringsavtale med utløpt, tilbakekalt og feil token;
- [ ] e-post til testmottaker: mottak, tilbud, kontrakt, plan, 48 timer, samme dag, endring og ferdigmelding uten duplikat;
- [ ] privat media avvises uten riktig relasjon/bruker;
- [ ] bloggpreview, godkjenning, planlegging, publisering, sitemap, canonical, schema og CTA-attribusjon;
- [ ] Search Console-resultat eller dokumentert `configuration_required` fallback;
- [ ] Core Web Vitals/Lighthouse på forside, artikkel, tilbud og `/user` med realistiske bilder;
- [ ] backup/restore-runbook gjennomført på isolert databasekopi;
- [ ] norsk kundetekst, pris, vilkår, personvern og leverandøroversikt godkjent av ansvarlige.

Dato, tester, nettleser/mobil, utfører, avvik og godkjenner skal føres i stagingrapporten.
