const permanent = true;

export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

function redirect(source: string, destination: string): LegacyRedirect {
  return { source, destination, permanent };
}

const norwegianServiceRedirects: LegacyRedirect[] = [
  redirect("/tjenester/takvask", "/no/takvask"),
  redirect("/tjenester/impregnering", "/no/takvask-og-impregnering"),
  redirect("/tjenester/takstein", "/no/nytt-tak"),
  redirect("/tjenester/shingeltak", "/no/nytt-tak"),
  redirect("/tjenester/nytt-tak", "/no/nytt-tak"),
  redirect(
    "/tjenester/fjerning-av-taksno",
    "https://fornyelsegruppen.no/tjenester/fjerning-av-taksno",
  ),
];

const englishServiceRedirects: LegacyRedirect[] = [
  redirect("/en/services/takvask", "/en/takvask"),
  redirect("/en/services/impregnering", "/en/takvask-og-impregnering"),
  redirect("/en/services/takstein", "/en/nytt-tak"),
  redirect("/en/services/shingeltak", "/en/nytt-tak"),
  redirect("/en/services/nytt-tak", "/en/nytt-tak"),
  redirect(
    "/en/services/fjerning-av-taksno",
    "https://fornyelsegruppen.no/en/services/fjerning-av-taksno",
  ),
];

const priorityLocationRedirects: LegacyRedirect[] = [
  redirect("/omrader/oslo/takvask", "/no/takvask-oslo"),
  redirect("/no/omrader/oslo/takvask", "/no/takvask-oslo"),
  redirect("/en/areas/oslo/takvask", "/en/takvask-oslo"),
  redirect("/omrader/baerum/takfornying", "/no/takfornying-baerum"),
  redirect("/no/omrader/baerum/takfornying", "/no/takfornying-baerum"),
  redirect("/en/areas/baerum/takfornying", "/en/takfornying-baerum"),
  redirect("/omrader/drammen/takmaling", "/no/takmaling-drammen"),
  redirect("/no/omrader/drammen/takmaling", "/no/takmaling-drammen"),
  redirect("/en/areas/drammen/takmaling", "/en/takmaling-drammen"),
  redirect(
    "/omrader/lillestrom/takvask",
    "/no/takvask-og-impregnering-lillestrom",
  ),
  redirect(
    "/omrader/lillestrom/impregnering",
    "/no/takvask-og-impregnering-lillestrom",
  ),
  redirect(
    "/no/omrader/lillestrom/takvask",
    "/no/takvask-og-impregnering-lillestrom",
  ),
  redirect(
    "/no/omrader/lillestrom/impregnering",
    "/no/takvask-og-impregnering-lillestrom",
  ),
  redirect(
    "/en/areas/lillestrom/takvask",
    "/en/takvask-og-impregnering-lillestrom",
  ),
  redirect(
    "/en/areas/lillestrom/impregnering",
    "/en/takvask-og-impregnering-lillestrom",
  ),
  redirect("/omrader/oslo", "/no/takvask-oslo"),
  redirect("/no/omrader/oslo", "/no/takvask-oslo"),
  redirect("/en/areas/oslo", "/en/takvask-oslo"),
  redirect("/omrader/baerum", "/no/takfornying-baerum"),
  redirect("/no/omrader/baerum", "/no/takfornying-baerum"),
  redirect("/en/areas/baerum", "/en/takfornying-baerum"),
  redirect("/omrader/drammen", "/no/takmaling-drammen"),
  redirect("/no/omrader/drammen", "/no/takmaling-drammen"),
  redirect("/en/areas/drammen", "/en/takmaling-drammen"),
  redirect("/omrader/lillestrom", "/no/takvask-og-impregnering-lillestrom"),
  redirect("/no/omrader/lillestrom", "/no/takvask-og-impregnering-lillestrom"),
  redirect("/en/areas/lillestrom", "/en/takvask-og-impregnering-lillestrom"),
  redirect("/omrader/viken", "/no/takfornying-viken"),
  redirect("/no/omrader/viken", "/no/takfornying-viken"),
  redirect("/en/areas/viken", "/en/takfornying-viken"),
];

const genericLocationServiceRedirects: LegacyRedirect[] = [
  redirect("/omrader/:location/takvask", "/no/takvask"),
  redirect("/no/omrader/:location/takvask", "/no/takvask"),
  redirect("/en/areas/:location/takvask", "/en/takvask"),
  redirect("/omrader/:location/impregnering", "/no/takvask-og-impregnering"),
  redirect("/no/omrader/:location/impregnering", "/no/takvask-og-impregnering"),
  redirect("/en/areas/:location/impregnering", "/en/takvask-og-impregnering"),
  redirect("/omrader/:location/takstein", "/no/nytt-tak"),
  redirect("/no/omrader/:location/takstein", "/no/nytt-tak"),
  redirect("/en/areas/:location/takstein", "/en/nytt-tak"),
  redirect("/omrader/:location/shingeltak", "/no/nytt-tak"),
  redirect("/no/omrader/:location/shingeltak", "/no/nytt-tak"),
  redirect("/en/areas/:location/shingeltak", "/en/nytt-tak"),
  redirect("/omrader/:location/nytt-tak", "/no/nytt-tak"),
  redirect("/no/omrader/:location/nytt-tak", "/no/nytt-tak"),
  redirect("/en/areas/:location/nytt-tak", "/en/nytt-tak"),
  redirect(
    "/omrader/:location/fjerning-av-taksno",
    "https://fornyelsegruppen.no/tjenester/fjerning-av-taksno",
  ),
  redirect(
    "/no/omrader/:location/fjerning-av-taksno",
    "https://fornyelsegruppen.no/tjenester/fjerning-av-taksno",
  ),
  redirect(
    "/en/areas/:location/fjerning-av-taksno",
    "https://fornyelsegruppen.no/en/services/fjerning-av-taksno",
  ),
];

const legacySectionRedirects: LegacyRedirect[] = [
  redirect("/tjenester", "/no#tjenester"),
  redirect("/omrader", "/no#tjenester"),
  redirect("/tilbud", "/no#kontakt"),
  redirect("/kontakt", "/no#kontakt"),
  redirect("/om-oss", "/no#om-oss"),
  redirect("/pakker", "/no#pakker"),
  redirect("/kalkulator", "/no#kalkulator"),
  redirect("/personvern", "/no/personvern"),
  redirect("/en/services", "/en#tjenester"),
  redirect("/en/areas", "/en#tjenester"),
  redirect("/en/quote", "/en#kontakt"),
  redirect("/en/contact", "/en#kontakt"),
  redirect("/en/about", "/en#om-oss"),
  redirect("/en/packages", "/en#pakker"),
  redirect("/en/calculator", "/en#kalkulator"),
  redirect("/en/privacy", "/en/personvern"),
];

export const legacyRedirects: LegacyRedirect[] = [
  ...priorityLocationRedirects,
  ...norwegianServiceRedirects,
  ...englishServiceRedirects,
  ...genericLocationServiceRedirects,
  ...legacySectionRedirects,
];
