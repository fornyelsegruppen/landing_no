import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerChange } from "@/components/change-agreements/customer-change";
import { loadCustomerChange } from "@/lib/change-agreements/customer-view";
import { getPayload } from "@/lib/payload";
import "../../globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Endringsavtale | Takfornyelse", robots: { index: false, follow: false } };
export default async function ChangePage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; const view = await loadCustomerChange(await getPayload(), token); if (!view) notFound(); return <html lang="nb"><body className="min-h-screen bg-background"><CustomerChange token={token} initial={{ status: view.status, snapshot: view.snapshot, documentHash: view.documentHash, customerName: view.customerName }} /></body></html>; }
