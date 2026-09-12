import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";
import { blogAutomationStatus } from "@/lib/blog/automation-status";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await blogAutomationStatus(payload), {
    headers: { "Cache-Control": "no-store" },
  });
}
