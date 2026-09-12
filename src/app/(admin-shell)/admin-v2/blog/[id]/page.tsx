import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BlogArticleViewLink } from "@/components/admin-v2/blog-article-view-link";
import { BlogEditor } from "@/components/admin-v2/blog-editor";
import { blogHistoryCopy } from "@/lib/admin-v2/blog-history-copy";
import { BlogReviewPanel } from "@/components/admin-v2/blog-review-panel";
import { blogPublishedArticleLabel, getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { blogPublishEligibility } from "@/lib/admin-v2/blog-review";
import { statusLabel } from "@/lib/admin-v2/labels";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import { readFeatureFlags } from "@/lib/platform/features";
import { publicReviewerName, reviewerNameForUser } from "@/lib/blog/reviewer";

export const dynamic = "force-dynamic";

export default async function BlogArticleAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const post = await (
    await getPayload()
  )
    .findByID({
      collection: "posts",
      id: Number(id),
      depth: 1,
      draft: true,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!post) notFound();
  const basePost = await (
    await getPayload()
  ).findByID({
    collection: "posts",
    id: post.id,
    depth: 0,
    draft: false,
    overrideAccess: true,
  });
  const history = blogHistoryCopy[user.interfaceLanguage];
  const image =
    post.heroImage && typeof post.heroImage === "object"
      ? post.heroImage
      : null;
  const qualityChecks =
    post.qualityChecks &&
    typeof post.qualityChecks === "object" &&
    !Array.isArray(post.qualityChecks)
      ? post.qualityChecks
      : null;
  const imageUrl = image?.url || post.stockImage?.imageUrl;
  const reviewInput = {
    aiAssisted: post.aiAssisted === true,
    qualityChecks: qualityChecks
      ? {
          passed:
            "passed" in qualityChecks ? qualityChecks.passed === true : null,
          issues:
            "issues" in qualityChecks && Array.isArray(qualityChecks.issues)
              ? qualityChecks.issues
              : [],
        }
      : null,
    qualityScore:
      typeof post.qualityScore === "number" ? post.qualityScore : null,
    reviewedAt: post.reviewedAt || null,
    reviewerName: publicReviewerName(post.reviewerName),
    reviewFlags: Array.isArray(post.reviewFlags) ? post.reviewFlags : [],
    scheduledAt: post.scheduledAt || null,
    sources: Array.isArray(post.sources) ? post.sources : [],
    status: post.editorialStatus,
    stockImage:
      post.stockImage && typeof post.stockImage === "object"
        ? post.stockImage
        : null,
  };
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        className="text-muted-foreground hover:text-accent inline-flex items-center gap-2 text-sm font-bold"
        href="/admin-v2/blog"
      >
        <ArrowLeft className="size-4" />
        {copy.blogAdmin.back}
      </Link>
      <header className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="border-accent/25 bg-accent/10 text-accent rounded-full border px-2.5 py-1 text-xs font-bold tracking-wider uppercase">
              {statusLabel(user.interfaceLanguage, post.editorialStatus)}
            </span>
            <h1 className="mt-4 text-2xl font-bold sm:text-4xl">
              {post.titleNo}
            </h1>
            <p className="text-muted-foreground mt-2">/{post.slug}</p>
          </div>
          <BlogArticleViewLink
            isDraft={post._status === "draft"}
            previewLabel={copy.blogAdmin.preview}
            publishedLabel={blogPublishedArticleLabel(user.interfaceLanguage)}
            slug={post.slug}
          />
        </div>
        {imageUrl ? (
          <Image
            alt={post.imageAlt || post.titleNo}
            className="mt-6 aspect-[16/7] w-full rounded-2xl object-cover"
            height={700}
            src={imageUrl}
            unoptimized
            width={1600}
          />
        ) : null}
      </header>
      <BlogEditor
        hasPublicVersion={basePost._status === "published"}
        contentNo={post.contentNo}
        excerptNo={post.excerptNo || undefined}
        id={post.id}
        locale={user.interfaceLanguage}
        primaryKeyword={post.primaryKeyword || undefined}
        publishEligible={blogPublishEligibility(reviewInput)}
        qualityPassed={qualityChecks?.passed === true}
        qualityScore={
          typeof post.qualityScore === "number" ? post.qualityScore : null
        }
        reviewerName={
          publicReviewerName(post.reviewerName) || reviewerNameForUser(user)
        }
        scheduledAt={post.scheduledAt || null}
        schedulerEnabled={readFeatureFlags().seoScheduler}
        seoDescriptionNo={post.seoDescriptionNo || undefined}
        seoTitleNo={post.seoTitleNo || undefined}
        status={post.editorialStatus}
        titleNo={post.titleNo}
        updatedAt={post.updatedAt}
      />
      <BlogReviewPanel locale={user.interfaceLanguage} {...reviewInput} />
      <section className="rounded-2xl border border-white/10 p-4 text-sm">
        <a
          className="text-accent inline-flex min-h-11 items-center font-bold"
          href={`/admin/collections/posts/${post.id}/versions`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {history.versions}
        </a>
        <p className="text-muted-foreground mt-2">{history.help}</p>
      </section>
      <details className="text-muted-foreground rounded-2xl border border-white/10 p-4 text-sm">
        <summary className="cursor-pointer font-bold">
          {copy.blogAdmin.technical}
        </summary>
        <Link
          className="text-accent mt-3 inline-flex items-center gap-2"
          href={`/admin/collections/posts/${post.id}`}
        >
          {copy.blogAdmin.technical}
          <ExternalLink className="size-4" />
        </Link>
      </details>
    </div>
  );
}
