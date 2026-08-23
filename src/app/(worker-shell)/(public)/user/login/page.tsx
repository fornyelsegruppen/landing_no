import { redirect } from "next/navigation";
import { WorkerLoginForm } from "@/components/worker/login-form";
import { getInternalUser } from "@/lib/auth/internal-session";

export const dynamic = "force-dynamic";

export default async function WorkerLoginPage() {
  if (await getInternalUser()) redirect("/user");

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-background-elevated p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
          Takfornyelse
        </p>
        <h1 className="mt-2 text-3xl font-bold">Ansattportal</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Logg inn med din personlige ansattkonto. Del aldri passordet med andre.
        </p>
        <WorkerLoginForm />
      </section>
    </main>
  );
}
