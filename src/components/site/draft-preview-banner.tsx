export function DraftPreviewBanner({ locale }: { locale: "no" | "en" }) {
  const english = locale === "en";
  return (
    <aside className="bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-black">
      {english
        ? "This is a private draft preview."
        : "Dette er en privat forhåndsvisning av utkast."}{" "}
      <a
        className="underline underline-offset-2"
        href={`/api/exit-preview?locale=${locale}`}
      >
        {english ? "Exit preview" : "Avslutt forhåndsvisning"}
      </a>
    </aside>
  );
}

export function DraftPreviewBoundary({
  enabled,
  locale,
}: {
  enabled: boolean;
  locale: "no" | "en";
}) {
  return enabled ? <DraftPreviewBanner locale={locale} /> : null;
}
