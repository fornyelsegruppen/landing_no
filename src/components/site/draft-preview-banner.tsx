import type { ReactNode } from "react";

export function DraftPreviewBanner({ locale }: { locale: "no" | "en" }) {
  const english = locale === "en";
  return (
    <aside className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-black">
      <span>
        {english
          ? "This is a private draft preview."
          : "Dette er en privat forhåndsvisning av utkast."}
      </span>
      <a
        className="inline-flex min-h-11 max-w-full items-center rounded px-1 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
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
  children,
}: {
  enabled: boolean;
  locale: "no" | "en";
  children?: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  // Both rows stay in normal flow inside one sticky header. The banner can
  // wrap at narrow widths without needing a guessed translated-text height.
  return (
    <div className="sticky top-0 z-50">
      <DraftPreviewBanner locale={locale} />
      {children}
    </div>
  );
}
