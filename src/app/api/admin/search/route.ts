import { NextResponse } from "next/server";
import { normalizeAdminSearchTerm, searchAdminRecords } from "@/lib/admin-v2/dashboard";
import { userIsAdmin } from "@/payload/access/roles";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const query = normalizeAdminSearchTerm(new URL(request.url).searchParams.get("q"));
  if (query.length < 2) return NextResponse.json({ query, results: [] });

  try {
    const results = await searchAdminRecords(payload, query);
    return NextResponse.json({ query, results });
  } catch {
    return NextResponse.json(
      { error: "Search temporarily unavailable", query },
      { status: 503 },
    );
  }
}
