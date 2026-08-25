import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

const schema=z.object({active:z.boolean()});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const correlationId=correlationIdFromHeaders(request.headers);const payload=await getPayload();const{user}=await payload.auth({headers:request.headers});if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});if(!userIsAdmin(user))return NextResponse.json({error:"Forbidden"},{status:403});const{id}=await params;if(!/^\d+$/.test(id))return NextResponse.json({error:"Invalid employee"},{status:400});const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid employee state"},{status:400});const existing=await payload.findByID({collection:"users",id:Number(id),depth:0,overrideAccess:true});if(existing.role!=="worker")return NextResponse.json({error:"Only employee accounts can be changed here"},{status:409});const updated=await payload.update({collection:"users",id:existing.id,overrideAccess:true,data:{active:parsed.data.active}});await recordAuditEvent(createPayloadAuditWriter(payload),{action:parsed.data.active?"employee.activate":"employee.deactivate",actorId:user.id,before:{active:existing.active},after:{active:updated.active},changedFields:["active"],correlationId,entityId:existing.id,entityType:"user"});return NextResponse.json({ok:true});}
