import { ExternalLink } from "lucide-react";

export function BlogArticleViewLink({
  isDraft,
  previewLabel,
  publishedLabel,
  slug,
}: {
  isDraft: boolean;
  previewLabel: string;
  publishedLabel: string;
  slug: string;
}) {
  const publicPath = `/no/blogg/${slug}`;
  const href = isDraft
    ? `/api/preview?locale=no&path=${encodeURIComponent(publicPath)}`
    : publicPath;

  return (
    <a
      className="hover:border-accent/50 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 font-bold"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {isDraft ? previewLabel : publishedLabel}
      <ExternalLink aria-hidden="true" className="size-4" />
    </a>
  );
}
