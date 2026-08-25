"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

export function BlogGenerateButton({ locale }: { locale: PanelLocale }) {
  const copy = getAdminV2Copy(locale).blogAdmin; const router = useRouter(); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState("");
  async function generate(){setBusy(true);setNotice("");try{const response=await fetch("/api/admin/blog/generate",{method:"POST"});const result=await response.json() as {error?:string;postId?:number};if(!response.ok)throw new Error(result.error||"Failed");if(result.postId)router.push(`/admin-v2/blog/${result.postId}`);else{setNotice(copy.actionDone);router.refresh();}}catch(error){setNotice(error instanceof Error?error.message:"Failed");}finally{setBusy(false);}}
  return <div><button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-60" disabled={busy} onClick={()=>void generate()} type="button">{busy?copy.generating:copy.generate}</button>{notice?<p className="mt-2 text-sm text-muted-foreground" role="status">{notice}</p>:null}</div>;
}
