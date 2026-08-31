import type { CaseWorkspacePhotoCopy } from "@/lib/admin-v2/case-workspace-i18n";

export function AdminLeadPhotoGallery({
  copy,
  leadId,
  photoCount,
}: {
  copy: CaseWorkspacePhotoCopy;
  leadId: number;
  photoCount: number;
}) {
  const safeCount = Math.min(Math.max(Math.trunc(photoCount), 0), 15);

  return (
    <section
      aria-labelledby="customer-photo-heading"
      className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold" id="customer-photo-heading">
            {copy.title}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {copy.description}
          </p>
        </div>
        <span className="border-accent/35 bg-accent-soft text-accent inline-flex min-w-8 items-center justify-center rounded-full border px-2.5 py-1 text-sm font-bold">
          {safeCount}
        </span>
      </div>
      {safeCount ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: safeCount }, (_, index) => {
            const href = `/api/admin/leads/${leadId}/photo?index=${index}`;
            const number = index + 1;
            return (
              <a
                aria-label={`${copy.open} ${number}`}
                className="hover:border-accent/60 focus-visible:ring-accent group overflow-hidden rounded-xl border border-white/10 bg-black/30 outline-none focus-visible:ring-2"
                href={href}
                key={href}
                rel="noreferrer"
                target="_blank"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${copy.image} ${number}`}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  loading="lazy"
                  src={href}
                />
                <span className="flex min-h-10 items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
                  <span>{copy.image}</span>
                  <span className="text-accent">{number}</span>
                </span>
              </a>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">{copy.empty}</p>
      )}
    </section>
  );
}
