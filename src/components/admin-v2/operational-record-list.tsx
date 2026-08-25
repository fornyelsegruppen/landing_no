import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { statusLabel } from "@/lib/admin-v2/labels";
import type { OperationalListItem } from "@/lib/admin-v2/operational-lists";
import { panelDateLocale, type PanelLocale } from "@/lib/panel-i18n";

export function OperationalRecordList({ empty, items, locale, open }: { empty: string; items: OperationalListItem[]; locale: PanelLocale; open: string }) {
  const formatter = new Intl.DateTimeFormat(panelDateLocale(locale), { dateStyle: "medium", timeStyle: "short" });
  if (!items.length) return <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-muted-foreground">{empty}</div>;
  return <div className="grid gap-3">{items.map((item) => <Link className="group grid gap-3 rounded-3xl border border-white/10 bg-background-elevated/75 p-5 transition hover:border-accent/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" href={item.href} key={item.id}><span className="min-w-0"><span className="text-xs font-bold uppercase tracking-wider text-accent">{item.reference}</span><strong className="mt-1 block truncate text-lg">{item.customer}</strong>{item.detail ? <span className="mt-1 block truncate text-sm text-muted-foreground">{item.detail}</span> : null}<span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{item.status ? <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-1 font-bold uppercase tracking-wider text-accent">{statusLabel(locale, item.status)}</span> : null}{item.updatedAt ? formatter.format(new Date(item.updatedAt)) : null}</span></span><span className="inline-flex items-center gap-2 font-bold text-accent">{open}<ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-1"/></span></Link>)}</div>;
}
