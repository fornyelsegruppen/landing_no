export const withdrawalFormCopy = {
  no: {
    eyebrow: "Angrerett",
    title: "Standard angreskjema for tjenesteavtale",
    intro:
      "Fyll ut og send skjemaet bare dersom du ønsker å gå fra avtalen. Du kan også sende en annen tydelig melding til Takfornyelse innen fristen.",
    deadline:
      "Angrefristen er normalt 14 dager fra avtalen ble inngått. Se angrerettinformasjonen du mottok sammen med tilbudet og kontrakten.",
    statusTitle: "Avtalen avsluttes ikke ved å åpne denne siden",
    statusText:
      "Dersom du ennå ikke har signert, er avtalen ikke inngått. Har du signert og ønsker å bruke angreretten, må du fylle ut og sende skjemaet eller sende oss en annen tydelig angremelding.",
    fields: {
      reference: "Tilbuds-/kontraktsreferanse",
      service: "Tjeneste og arbeidssted",
      agreementDate: "Avtalen ble inngått den",
      customerName: "Forbrukerens navn",
      customerAddress: "Forbrukerens adresse",
      date: "Dato",
      signature: "Forbrukerens signatur (bare dersom skjemaet sendes på papir)",
    },
    declaration: "Jeg meddeler herved at jeg ønsker å gå fra avtalen om følgende tjeneste:",
    print: "Skriv ut skjemaet",
    sendTitle: "Slik sender du skjemaet",
    sendText:
      "Send det utfylte skjemaet eller en annen tydelig angremelding til post@takfornyelse.as. Du kan også sende det per post til adressen nedenfor. Det er ikke obligatorisk å bruke dette skjemaet.",
    home: "Forside",
  },
  en: {
    eyebrow: "Right of withdrawal",
    title: "Standard withdrawal form for a service agreement",
    intro:
      "Complete and send this form only if you wish to withdraw from the agreement. You may also send another clear statement to Takfornyelse within the deadline.",
    deadline:
      "The withdrawal period is normally 14 days from the date the agreement was concluded. See the withdrawal information supplied with your quote and contract.",
    statusTitle: "Opening this page does not cancel an agreement",
    statusText:
      "If you have not signed yet, the agreement has not been concluded. If you have signed and wish to exercise the right of withdrawal, complete and send the form or send us another clear withdrawal statement.",
    fields: {
      reference: "Quote/contract reference",
      service: "Service and work address",
      agreementDate: "Agreement concluded on",
      customerName: "Consumer name",
      customerAddress: "Consumer address",
      date: "Date",
      signature: "Consumer signature (only if this form is sent on paper)",
    },
    declaration: "I hereby give notice that I withdraw from the agreement for the following service:",
    print: "Print the form",
    sendTitle: "How to send the form",
    sendText:
      "Send the completed form or another clear withdrawal statement to post@takfornyelse.as. You may also send it by post to the address below. Use of this form is optional.",
    home: "Home",
  },
} as const;
