import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { buildPlatformHealth } from "@/lib/platform/health";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!userIsAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(buildPlatformHealth(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    captureException(error, { route: "GET /api/admin/platform-health" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
