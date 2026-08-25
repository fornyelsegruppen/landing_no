import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BlogEditor } from "@/components/admin-v2/blog-editor";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { statusLabel } from "@/lib/admin-v2/labels";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";

export default async function BlogArticleAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const post = await (await getPayload()).findByID({ collection: "posts", id: Number(id), depth: 1, draft: true, overrideAccess: true }).catch(() => null);
  if (!post) notFound();
  const image = post.heroImage && typeof post.heroImage === "object" ? post.heroImage : null;
  const preview = `/api/preview?locale=no&path=${encodeURIComponent(`/no/blogg/${post.slug}`)}`;

  return <div className="mx-auto max-w-5xl space-y-6">
    <Link className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-accent" href="/admin-v2/blog"><ArrowLeft className="size-4" />{copy.blogAdmin.back}</Link>
    <header className="rounded-3xl border border-white/10 bg-background-elevated/75 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-accent">{statusLabel(user.interfaceLanguage, post.editorialStatus)}</span><h1 className="mt-4 text-2xl font-bold sm:text-4xl">{post.titleNo}</h1><p className="mt-2 text-muted-foreground">/{post.slug}</p></div><a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 font-bold hover:border-accent/50" href={preview} target="_blank">{copy.blogAdmin.preview}<ExternalLink className="size-4" /></a></div>
      {image?.url ? <Image alt={post.imageAlt || post.titleNo} className="mt-6 aspect-[16/7] w-full rounded-2xl object-cover" height={700} src={image.url} unoptimized width={1600} /> : null}
    </header>
    <BlogEditor contentNo={post.contentNo} excerptNo={post.excerptNo || undefined} id={post.id} locale={user.interfaceLanguage} primaryKeyword={post.primaryKeyword || undefined} reviewerName={post.reviewerName || user.displayName || user.email} seoDescriptionNo={post.seoDescriptionNo || undefined} seoTitleNo={post.seoTitleNo || undefined} status={post.editorialStatus} titleNo={post.titleNo} />
    <details className="rounded-2xl border border-white/10 p-4 text-sm text-muted-foreground"><summary className="cursor-pointer font-bold">{copy.blogAdmin.technical}</summary><Link className="mt-3 inline-flex items-center gap-2 text-accent" href={`/admin/collections/posts/${post.id}`}>{copy.blogAdmin.technical}<ExternalLink className="size-4" /></Link></details>
  </div>;
}
