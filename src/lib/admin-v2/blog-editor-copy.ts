import type { PanelLocale } from "@/lib/panel-i18n";

type BlogEditorCopy = {
  unsaved: string;
  saveFirst: string;
  discard: string;
  discardConfirm: string;
  discarded: string;
  serverUpdated: string;
  saving: string;
  recheckingQuality: string;
  recheckQuality: string;
  findingStock: string;
  regenerating: string;
  approving: string;
  scheduling: string;
  publishing: string;
  rejecting: string;
  saved: string;
  recheckedQuality: string;
  stockUpdated: string;
  regenerated: string;
  approved: string;
  scheduled: string;
  published: string;
  rejected: string;
  noAlternative: string;
  qualityBlocked: string;
  providerUnavailable: string;
  conflict: string;
  actionFailed: string;
  qualityFindings: string;
  runReference: string;
  correlationReference: string;
  regenerationInstructions: string;
  regenerationInstructionsHint: string;
  regenerationConfirm: string;
  scheduleNeedsApproval: string;
  scheduleNeedsFutureDate: string;
  scheduleInvalidTime: string;
  scheduleNonexistentTime: string;
  scheduleAmbiguousTime: string;
  scheduleSaved: string;
  scheduleUnsavedPlan: string;
  schedulerPaused: string;
  schedulerPlanOnly: string;
  publishLocked: string;
  refreshPending: string;
  refreshDelayed: string;
  reloadLatest: string;
};

export const blogEditorCopies: Record<PanelLocale, BlogEditorCopy> = {
  nb: {
    unsaved: "Du har ulagrede endringer i artikkelteksten.",
    saveFirst: "Lagre endringene før du velger en annen arbeidsflyt.",
    discard: "Forkast endringer",
    discardConfirm:
      "Du har ulagrede artikkelendringer. Forlate siden og forkaste dem?",
    discarded: "Ulagrede endringer er forkastet.",
    serverUpdated:
      "Artikkelen ble oppdatert på serveren. Kontroller de nyeste opplysningene før du fortsetter.",
    saving: "Lagrer endringer …",
    recheckingQuality: "Kjører kvalitetskontrollen på nytt …",
    recheckQuality: "Kjør kvalitetskontrollen på nytt",
    findingStock: "Finner et stockbilde …",
    regenerating: "Lager et nytt AI-utkast …",
    approving: "Registrerer faglig godkjenning …",
    scheduling: "Kontrollerer planleggingen …",
    publishing: "Publiserer artikkelen …",
    rejecting: "Avviser utkastet …",
    saved: "Endringene er lagret og må kontrolleres på nytt.",
    recheckedQuality:
      "Kvalitetskontrollen er kjørt på nytt. Kontroller resultatet før godkjenning.",
    stockUpdated:
      "Stockbilde-handlingen er fullført. Kontroller bilde, kilde og kontrollstatus.",
    regenerated: "Nytt AI-utkast er klart for kontroll.",
    approved: "Faglig godkjenning er registrert.",
    scheduled: "Artikkelen er planlagt.",
    published: "Artikkelen er publisert.",
    rejected: "Utkastet er avvist.",
    noAlternative:
      "Ingen annen egnet stock-variant ble funnet. Endre søket og prøv igjen.",
    qualityBlocked:
      "Utkastet ble ikke lagret fordi kvalitetskontrollen stoppet det.",
    providerUnavailable:
      "Bilde- eller AI-tjenesten er midlertidig utilgjengelig. Prøv senere.",
    conflict:
      "Artikkelen ble endret et annet sted. Last inn siden på nytt før du fortsetter.",
    actionFailed: "Handlingen kunne ikke fullføres.",
    qualityFindings: "Kvalitetsfunn",
    runReference: "Åpne AI-kjøring",
    correlationReference: "Referanse for støtte",
    regenerationInstructions: "Hva skal forbedres? (valgfritt)",
    regenerationInstructionsHint:
      "Beskriv kort hva som må rettes. Dette erstatter ikke faglig kontroll.",
    regenerationConfirm:
      "Et nytt AI-utkast erstatter det nåværende upubliserte utkastet og nullstiller kontroll og planlegging. Fortsette?",
    scheduleNeedsApproval: "Planlegging åpnes etter faglig godkjenning.",
    scheduleNeedsFutureDate: "Velg et fremtidig tidspunkt før planlegging.",
    scheduleInvalidTime: "Oppgi et gyldig Oslo-tidspunkt før planlegging.",
    scheduleNonexistentTime:
      "Det valgte Oslo-tidspunktet finnes ikke på grunn av sommertid. Velg et annet tidspunkt.",
    scheduleAmbiguousTime:
      "Det valgte Oslo-tidspunktet forekommer to ganger ved overgang til vintertid. Velg et annet entydig tidspunkt.",
    scheduleSaved: "Lagret plan: {time} (Europe/Oslo).",
    scheduleUnsavedPlan: "Det valgte tidspunktet er ikke lagret ennå.",
    schedulerPaused:
      "Planlegging er pauset av funksjonsinnstillingen. Ingen kjøring er bekreftet.",
    schedulerPlanOnly:
      "Planlegging registrerer bare en plan; godkjenning og en aktiv kjører kreves før publisering.",
    publishLocked: "Publisering er låst til alle kontrollkrav er oppfylt.",
    refreshPending: "Henter de nyeste artikkelopplysningene …",
    refreshDelayed:
      "De nyeste opplysningene kom ikke tilbake ennå. Last inn siden på nytt før du fortsetter.",
    reloadLatest: "Last inn siste versjon",
  },
  lt: {
    unsaved: "Turite neišsaugotų straipsnio pakeitimų.",
    saveFirst: "Prieš pasirinkdami kitą veiksmą, išsaugokite pakeitimus.",
    discard: "Atsisakyti pakeitimų",
    discardConfirm:
      "Turite neišsaugotų straipsnio pakeitimų. Išeiti iš puslapio ir jų atsisakyti?",
    discarded: "Neišsaugoti pakeitimai atmesti.",
    serverUpdated:
      "Straipsnis serveryje atnaujintas. Prieš tęsdami patikrinkite naujausią informaciją.",
    saving: "Išsaugomi pakeitimai …",
    recheckingQuality: "Kokybės patikra vykdoma iš naujo …",
    recheckQuality: "Atlikti kokybės patikrą iš naujo",
    findingStock: "Ieškoma stock nuotraukos …",
    regenerating: "Kuriamas naujas DI juodraštis …",
    approving: "Registruojamas specialisto patvirtinimas …",
    scheduling: "Tikrinamas planavimas …",
    publishing: "Publikuojamas straipsnis …",
    rejecting: "Juodraštis atmetamas …",
    saved: "Pakeitimai išsaugoti; juos reikia patikrinti iš naujo.",
    recheckedQuality:
      "Kokybės patikra atlikta iš naujo. Prieš patvirtindami patikrinkite rezultatą.",
    stockUpdated:
      "Stock nuotraukos veiksmas atliktas. Patikrinkite nuotrauką, šaltinį ir peržiūros būseną.",
    regenerated: "Naujas DI juodraštis paruoštas patikrai.",
    approved: "Specialisto patvirtinimas užregistruotas.",
    scheduled: "Straipsnis suplanuotas.",
    published: "Straipsnis publikuotas.",
    rejected: "Juodraštis atmestas.",
    noAlternative:
      "Kitos tinkamos stock nuotraukos nerasta. Pakeiskite paiešką ir bandykite dar kartą.",
    qualityBlocked: "Juodraštis neišsaugotas, nes jį sustabdė kokybės patikra.",
    providerUnavailable:
      "Nuotraukų arba DI paslauga laikinai nepasiekiama. Bandykite vėliau.",
    conflict: "Straipsnis pakeistas kitur. Prieš tęsdami perkraukite puslapį.",
    actionFailed: "Veiksmo nepavyko užbaigti.",
    qualityFindings: "Kokybės pastabos",
    runReference: "Atidaryti DI bandymą",
    correlationReference: "Pagalbos nuoroda",
    regenerationInstructions: "Ką reikia pagerinti? (nebūtina)",
    regenerationInstructionsHint:
      "Trumpai aprašykite, ką reikia pataisyti. Tai nepakeičia specialisto patikros.",
    regenerationConfirm:
      "Naujas DI juodraštis pakeis dabartinį neviešą juodraštį ir iš naujo nustatys peržiūrą bei planavimą. Tęsti?",
    scheduleNeedsApproval:
      "Planavimas bus galimas po specialisto patvirtinimo.",
    scheduleNeedsFutureDate: "Prieš planuodami pasirinkite būsimą laiką.",
    scheduleInvalidTime: "Prieš planuodami įveskite tinkamą Oslo laiką.",
    scheduleNonexistentTime:
      "Pasirinktas Oslo laikas neegzistuoja dėl vasaros laiko. Pasirinkite kitą laiką.",
    scheduleAmbiguousTime:
      "Pasirinktas Oslo laikas pereinant į žiemos laiką pasikartoja du kartus. Pasirinkite kitą, vienareikšmį laiką.",
    scheduleSaved: "Išsaugotas planas: {time} (Europe/Oslo).",
    scheduleUnsavedPlan: "Pasirinktas laikas dar neišsaugotas.",
    schedulerPaused:
      "Planavimas sustabdytas funkcijos nustatymu. Vykdytojo būsena nepatvirtinta.",
    schedulerPlanOnly:
      "Planavimas tik įrašo planą; prieš publikavimą būtinas patvirtinimas ir aktyvus vykdytojas.",
    publishLocked:
      "Publikavimas užrakintas, kol neįvykdyti visi patikros reikalavimai.",
    refreshPending: "Įkeliama naujausia straipsnio informacija …",
    refreshDelayed:
      "Naujausia informacija dar negrįžo. Prieš tęsdami iš naujo įkelkite puslapį.",
    reloadLatest: "Įkelti naujausią versiją",
  },
  en: {
    unsaved: "You have unsaved article changes.",
    saveFirst: "Save your changes before choosing another workflow action.",
    discard: "Discard changes",
    discardConfirm:
      "You have unsaved article changes. Leave this page and discard them?",
    discarded: "Unsaved changes were discarded.",
    serverUpdated:
      "The article changed on the server. Check the latest details before continuing.",
    saving: "Saving changes …",
    recheckingQuality: "Running the quality check again …",
    recheckQuality: "Run the quality check again",
    findingStock: "Finding a stock image …",
    regenerating: "Creating a new AI draft …",
    approving: "Recording expert approval …",
    scheduling: "Checking the schedule …",
    publishing: "Publishing the article …",
    rejecting: "Rejecting the draft …",
    saved: "Changes were saved and need review again.",
    recheckedQuality:
      "The quality check ran again. Review the result before approval.",
    stockUpdated:
      "The stock-image action completed. Check the image, source, and review status.",
    regenerated: "A new AI draft is ready for review.",
    approved: "Expert approval was recorded.",
    scheduled: "The article was scheduled.",
    published: "The article was published.",
    rejected: "The draft was rejected.",
    noAlternative:
      "No different suitable stock image was found. Change the search and try again.",
    qualityBlocked:
      "The draft was not saved because the quality check stopped it.",
    providerUnavailable:
      "The image or AI service is temporarily unavailable. Try again later.",
    conflict:
      "The article changed elsewhere. Reload the page before continuing.",
    actionFailed: "The action could not be completed.",
    qualityFindings: "Quality findings",
    runReference: "Open AI run",
    correlationReference: "Support reference",
    regenerationInstructions: "What should be improved? (optional)",
    regenerationInstructionsHint:
      "Briefly describe what needs correction. This does not replace expert review.",
    regenerationConfirm:
      "A new AI draft replaces the current unpublished draft and resets review and scheduling. Continue?",
    scheduleNeedsApproval: "Scheduling opens after expert approval.",
    scheduleNeedsFutureDate: "Choose a future time before scheduling.",
    scheduleInvalidTime: "Enter a valid Oslo time before scheduling.",
    scheduleNonexistentTime:
      "The selected Oslo time does not exist because of daylight saving time. Choose another time.",
    scheduleAmbiguousTime:
      "The selected Oslo time occurs twice when daylight saving time ends. Choose another unambiguous time.",
    scheduleSaved: "Saved plan: {time} (Europe/Oslo).",
    scheduleUnsavedPlan: "The selected time is not saved yet.",
    schedulerPaused:
      "Scheduling is paused by the feature setting. No executor is confirmed.",
    schedulerPlanOnly:
      "Scheduling records only a plan; approval and an active executor are still required before publication.",
    publishLocked:
      "Publishing stays locked until every review requirement is met.",
    refreshPending: "Loading the latest article details …",
    refreshDelayed:
      "The latest details have not returned yet. Reload the page before continuing.",
    reloadLatest: "Reload latest version",
  },
};
