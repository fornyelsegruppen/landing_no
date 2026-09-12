import { revalidatePath } from "next/cache";

/** Call only after the owning database transaction has committed. */
export function invalidatePublicBlog() {
  revalidatePath("/[locale]/blogg/[slug]", "page");
  revalidatePath("/[locale]/blogg", "page");
  revalidatePath("/[locale]", "page");
  revalidatePath("/sitemap.xml");
}
