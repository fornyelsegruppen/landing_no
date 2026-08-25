import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

const schema=z.object({displayName:z.string().trim().min(2).max(120),email:z.string().email().max(200),phone:z.string().trim().max(40).optional(),password:z.string().min(10).max(200),interfaceLanguage:z.enum(["nb","lt","en"])});
export async function POST(request:Request){const correlationId=correlationIdFromHeaders(request.headers);const payload=await getPayload();const{user}=await payload.auth({headers:request.headers});if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});if(!userIsAdmin(user))return NextResponse.json({error:"Forbidden"},{status:403});const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid employee details"},{status:400});try{const employee=await payload.create({collection:"users",overrideAccess:true,data:{...parsed.data,phone:parsed.data.phone||null,role:"worker",active:true}});await recordAuditEvent(createPayloadAuditWriter(payload),{action:"employee.create",actorId:user.id,changedFields:["displayName","email","phone","interfaceLanguage","role","active"],correlationId,entityId:employee.id,entityType:"user"});return NextResponse.json({ok:true,id:employee.id});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Employee creation failed"},{status:409});}}
