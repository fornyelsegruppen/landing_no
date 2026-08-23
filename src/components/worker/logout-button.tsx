"use client";

import { useState } from "react";
import { performLogout } from "@/lib/auth/logout";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await performLogout(fetch, (path) => window.location.assign(path)).catch(
      () => undefined,
    );
  }

  return (
    <button
      className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:border-accent hover:text-white disabled:opacity-60"
      disabled={pending}
      onClick={logout}
      type="button"
    >
      {pending ? "Logger ut …" : "Logg ut"}
    </button>
  );
}
