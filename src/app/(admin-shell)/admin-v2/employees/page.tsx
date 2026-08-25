import { EmployeeAdmin } from "@/components/admin-v2/employee-admin";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
export const dynamic="force-dynamic";
export default async function EmployeesPage(){const user=await requireAdminUser();const copy=getAdminV2Copy(user.interfaceLanguage);const result=await (await getPayload()).find({collection:"users",depth:0,limit:200,pagination:false,overrideAccess:true,sort:"displayName",where:{role:{equals:"worker"}}});const employees=result.docs.map(item=>({active:Boolean(item.active),displayName:item.displayName||undefined,email:item.email,id:item.id,interfaceLanguage:item.interfaceLanguage,phone:item.phone||undefined}));return <div className="mx-auto max-w-5xl space-y-6"><header><p className="text-xs font-bold uppercase tracking-[.2em] text-accent">{copy.control}</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">{copy.employeesAdmin.title}</h1><p className="mt-2 text-muted-foreground">{copy.employeesAdmin.intro}</p></header><EmployeeAdmin employees={employees} locale={user.interfaceLanguage}/></div>}
