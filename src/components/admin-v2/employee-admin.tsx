"use client";

import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

type Employee = {
  id: number;
  displayName?: string;
  email: string;
  phone?: string;
  active: boolean;
  interfaceLanguage: "nb" | "lt" | "en";
};

export function EmployeeAdmin({
  employees,
  locale,
  returnTo,
}: {
  employees: Employee[];
  locale: PanelLocale;
  returnTo?: string;
}) {
  const copy = getAdminV2Copy(locale).employeesAdmin;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  async function responseData(response: Response) {
    return (await response.json().catch(() => ({}))) as {
      code?: string;
      error?: string;
    };
  }

  async function create(formData: FormData) {
    setBusy(true);
    setNotice("");
    const body = Object.fromEntries(formData);
    const response = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await responseData(response);
    setBusy(false);
    if (!response.ok) {
      setNotice(result.error || "Failed");
      return;
    }
    setNotice(copy.saved);
    if (returnTo) router.push(returnTo);
    else router.refresh();
  }

  async function update(employee: Employee, formData: FormData) {
    setBusy(true);
    setNotice("");
    const response = await fetch(`/api/admin/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const result = await responseData(response);
    setBusy(false);
    if (!response.ok) {
      setNotice(
        result.code === "EMPLOYEE_UPDATE_CONFLICT"
          ? copy.updateConflict
          : result.error || copy.updateConflict,
      );
      return;
    }
    setNotice(copy.saved);
    setEditingId(null);
    if (returnTo) router.push(returnTo);
    else router.refresh();
  }

  async function toggle(employee: Employee) {
    setBusy(true);
    const response = await fetch(`/api/admin/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !employee.active }),
    });
    const result = await responseData(response);
    setBusy(false);
    setNotice(response.ok ? copy.saved : result.error || "Failed");
    if (response.ok) router.refresh();
  }

  async function remove(employee: Employee) {
    if (busy || !window.confirm(copy.removeConfirm)) return;
    setBusy(true);
    setNotice("");
    const response = await fetch(`/api/admin/employees/${employee.id}`, {
      method: "DELETE",
    });
    const result = await responseData(response);
    setBusy(false);
    if (!response.ok) {
      setNotice(
        result.code === "EMPLOYEE_HAS_HISTORY"
          ? copy.historyDeleteBlocked
          : result.error || copy.updateConflict,
      );
      return;
    }
    setEditingId(null);
    setNotice(copy.removed);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {returnTo ? (
        <Link
          className="hover:border-accent/50 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 font-bold"
          href={returnTo}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {locale === "lt"
            ? "Grįžti į bylą"
            : locale === "en"
              ? "Return to case"
              : "Tilbake til saken"}
        </Link>
      ) : null}
      {notice ? (
        <p
          className="border-accent/30 bg-accent/10 rounded-2xl border px-4 py-3 text-sm"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <details
        className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5 sm:p-6"
        id="add-employee"
        open={Boolean(returnTo) || employees.length === 0}
      >
        <summary className="text-accent cursor-pointer text-xl font-bold">
          {copy.add}
        </summary>
        <form action={create} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.name}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              name="displayName"
              required
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.email}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.phone}
            </span>
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              name="phone"
              required
              type="tel"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.language}
            </span>
            <select
              className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3"
              defaultValue="nb"
              name="interfaceLanguage"
            >
              <option value="nb">Norsk</option>
              <option value="lt">Lietuvių</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-muted-foreground text-xs font-bold uppercase">
              {copy.password}
            </span>
            <input
              autoComplete="new-password"
              className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3"
              minLength={10}
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="bg-accent text-accent-foreground min-h-12 w-fit rounded-xl px-5 font-bold disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {copy.create}
          </button>
        </form>
      </details>
      {employees.length ? (
        <div className="grid gap-3">
          {employees.map((employee) => (
            <article
              className="bg-background-elevated/75 grid gap-5 rounded-3xl border border-white/10 p-5 sm:p-6"
              key={employee.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${employee.active ? "border-accent/30 text-accent" : "text-muted-foreground border-white/15"}`}
                  >
                    {employee.active ? copy.active : copy.inactive}
                  </span>
                  <strong className="mt-3 block text-lg">
                    {employee.displayName || employee.email}
                  </strong>
                  <p className="text-muted-foreground text-sm">
                    {employee.email}
                    {employee.phone ? ` · ${employee.phone}` : ""} ·{" "}
                    {employee.interfaceLanguage.toUpperCase()}
                  </p>
                  {!employee.phone ? (
                    <p className="mt-2 text-sm font-semibold text-amber-200">
                      {copy.missingPhone}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="hover:border-accent/50 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-60"
                    disabled={busy}
                    onClick={() =>
                      setEditingId((current) =>
                        current === employee.id ? null : employee.id,
                      )
                    }
                    type="button"
                  >
                    {editingId === employee.id ? (
                      <X aria-hidden="true" className="size-4" />
                    ) : (
                      <Pencil aria-hidden="true" className="size-4" />
                    )}
                    {editingId === employee.id ? copy.cancel : copy.edit}
                  </button>
                  <button
                    className="hover:border-accent/50 min-h-11 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-60"
                    disabled={busy}
                    onClick={() => void toggle(employee)}
                    type="button"
                  >
                    {employee.active ? copy.deactivate : copy.activate}
                  </button>
                  <button
                    className="border-danger/40 text-danger hover:bg-danger/10 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-bold disabled:opacity-60"
                    disabled={busy}
                    onClick={() => void remove(employee)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    {copy.remove}
                  </button>
                </div>
              </div>
              {editingId === employee.id ? (
                <form
                  action={(formData) => update(employee, formData)}
                  className="border-accent/25 grid gap-4 rounded-2xl border bg-black/15 p-4 sm:grid-cols-2"
                >
                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground text-xs font-bold uppercase">
                      {copy.name}
                    </span>
                    <input
                      className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3"
                      defaultValue={employee.displayName || ""}
                      name="displayName"
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground text-xs font-bold uppercase">
                      {copy.email}
                    </span>
                    <input
                      className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3"
                      defaultValue={employee.email}
                      name="email"
                      required
                      type="email"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground text-xs font-bold uppercase">
                      {copy.phone}
                    </span>
                    <input
                      className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3"
                      defaultValue={employee.phone || ""}
                      name="phone"
                      required
                      type="tel"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-muted-foreground text-xs font-bold uppercase">
                      {copy.language}
                    </span>
                    <select
                      className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3"
                      defaultValue={employee.interfaceLanguage}
                      name="interfaceLanguage"
                    >
                      <option value="nb">Norsk</option>
                      <option value="lt">Lietuvių</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2">
                    <span className="text-muted-foreground text-xs font-bold uppercase">
                      {copy.newPassword}
                    </span>
                    <input
                      autoComplete="new-password"
                      className="min-h-12 rounded-xl border border-white/10 bg-[#0d1118] px-3"
                      minLength={10}
                      name="password"
                      type="password"
                    />
                    <span className="text-muted-foreground text-xs">
                      {copy.passwordOptional}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      className="bg-accent text-accent-foreground min-h-12 rounded-xl px-5 font-bold disabled:opacity-60"
                      disabled={busy}
                      type="submit"
                    >
                      {copy.save}
                    </button>
                    <button
                      className="min-h-12 rounded-xl border border-white/15 px-5 font-bold"
                      disabled={busy}
                      onClick={() => setEditingId(null)}
                      type="button"
                    >
                      {copy.cancel}
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed border-white/15 p-8 text-center">
          {copy.empty}
        </div>
      )}
    </div>
  );
}
