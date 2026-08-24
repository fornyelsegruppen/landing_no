"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

export function AdminLogoutButton({ locale }: { locale: PanelLocale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const copy = getAdminV2Copy(locale);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/users/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      router.replace("/admin/login?redirect=%2Fadmin-v2");
      router.refresh();
    }
  }

  return (
    <button
      className="min-h-10 rounded-xl border border-white/15 px-3 text-sm text-white/80 transition hover:border-accent hover:text-white disabled:opacity-60"
      disabled={pending}
      onClick={() => void logout()}
      type="button"
    >
      {copy.logout}
    </button>
  );
}
