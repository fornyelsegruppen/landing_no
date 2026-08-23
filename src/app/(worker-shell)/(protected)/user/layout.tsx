import Link from "next/link";
import { LogoutButton } from "@/components/worker/logout-button";
import { requireInternalUser } from "@/lib/auth/internal-session";

export const dynamic = "force-dynamic";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInternalUser();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,rgba(232,163,23,0.13),transparent_60%)]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link className="font-bold tracking-tight" href="/user">
            <span className="text-accent">TF</span> Mine oppdrag
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">
              {user.displayName || user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">{children}</main>
      <nav
        aria-label="Ansattnavigasjon"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
      >
        <div className="mx-auto flex max-w-5xl justify-center">
          <Link
            className="min-h-11 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-accent-foreground"
            href="/user"
          >
            Mine oppdrag
          </Link>
        </div>
      </nav>
    </div>
  );
}
