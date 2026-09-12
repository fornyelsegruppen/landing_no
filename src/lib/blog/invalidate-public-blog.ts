import { revalidatePath } from "next/cache";

/** Call only after the owning database transaction has committed. */
export function invalidatePublicBlog() {
  revalidatePath("/(site)/[locale]/blogg/[slug]", "page");
  revalidatePath("/(site)/[locale]/blogg", "page");
  revalidatePath("/(site)/[locale]", "page");
  revalidatePath("/sitemap.xml");
}
