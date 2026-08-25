import Link from "next/link";
import { OperationalRecordList } from "@/components/admin-v2/operational-record-list";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { loadOperationalList } from "@/lib/admin-v2/operational-lists";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function WorkPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminUser(); const copy = getAdminV2Copy(user.interfaceLanguage); const state = first((await searchParams).state) || "all";
  const items = await loadOperationalList(await getPayload(), "work", state);
  const tabs = [["all",copy.operations.all],["unassigned",copy.operations.unassigned],["assigned",copy.operations.scheduling],["active",copy.operations.active],["finished",copy.operations.finished]];
  return <div className="mx-auto max-w-7xl space-y-6"><header><p className="text-xs font-bold uppercase tracking-[.2em] text-accent">{copy.control}</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">{copy.operations.workTitle}</h1><p className="mt-2 text-muted-foreground">{copy.operations.workIntro}</p></header><div className="flex flex-wrap gap-2">{tabs.map(([value,label])=><Link className={`rounded-xl border px-4 py-2 text-sm font-bold ${state===value?"border-accent bg-accent text-accent-foreground":"border-white/10 hover:border-accent/50"}`} href={`/admin-v2/work?state=${value}`} key={value}>{label}</Link>)}</div><OperationalRecordList empty={copy.operations.empty} items={items} locale={user.interfaceLanguage} open={copy.operations.open}/></div>;
}
