import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { importSearchSignals, ensureManualBlogTopics } from "@/lib/blog/payload-blog-engine";
import { parseSearchSignalCsv } from "@/lib/blog/search-signal-import";
import { GoogleSearchConsoleProvider } from "@/lib/providers/google-search-console-provider";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";
export const maxDuration = 30;

async function authorizedPayload(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!userIsAdmin(user)) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { payload };
}

export async function POST(request: Request) {
  const authorization = await authorizedPayload(request);
  if ("response" in authorization) return authorization.response;
  const { payload } = authorization;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const source = String(form.get("source") || "");
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
      const result = await importSearchSignals(payload, parseSearchSignalCsv(await file.text(), source));
      return NextResponse.json({ ok: true, source, ...result }, { headers: { "Cache-Control": "no-store" } });
    }

    const body = (await request.json().catch(() => ({}))) as { source?: string };
    if (body.source === "search-console") {
      const provider = new GoogleSearchConsoleProvider();
      if (provider.health().status !== "ready") {
        return NextResponse.json({ error: "Search Console requires configuration" }, { status: 503 });
      }
      const result = await importSearchSignals(payload, await provider.listSignals());
      return NextResponse.json({ ok: true, source: body.source, ...result });
    }
    const created = await ensureManualBlogTopics(payload);
    return NextResponse.json({ ok: true, source: "manual", created });
  } catch (error) {
    captureException(error, { route: "POST /api/admin/blog/topics" });
    const message = error instanceof TypeError ? error.message : "Topic import failed";
    return NextResponse.json({ error: message }, { status: error instanceof TypeError ? 400 : 500 });
  }
}
