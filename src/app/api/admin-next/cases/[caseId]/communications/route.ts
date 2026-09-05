import { NextResponse } from "next/server";
import {
  loadAdminNextCaseCommunicationPage,
  parseAdminNextCommunicationCursor,
} from "@/lib/admin-next/case-communication-read";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

type Context = { params: Promise<{ caseId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: privateHeaders },
      );
    }
    if (!userIsAdmin(user)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: privateHeaders },
      );
    }

    const { caseId } = await context.params;
    const match = caseId.match(/^(?:TF-)?(\d+)$/iu);
    if (!match) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: privateHeaders },
      );
    }
    const cursor = new URL(request.url).searchParams.get("cursor");
    if (cursor !== null && !parseAdminNextCommunicationCursor(cursor)) {
      return NextResponse.json(
        { error: "Invalid cursor" },
        { status: 400, headers: privateHeaders },
      );
    }

    const leadId = Number(match[1]);
    try {
      await payload.findByID({
        collection: "leads",
        depth: 0,
        id: leadId,
        overrideAccess: true,
      });
    } catch {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: privateHeaders },
      );
    }

    const page = await loadAdminNextCaseCommunicationPage(
      payload,
      leadId,
      cursor,
    );
    return NextResponse.json(page, { headers: privateHeaders });
  } catch {
    return NextResponse.json(
      { error: "Communication history temporarily unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
