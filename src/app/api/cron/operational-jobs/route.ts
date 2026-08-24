import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import { processOperationalJobs } from "@/lib/jobs/operational-job-processor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await getPayload();
    const result = await processOperationalJobs(payload, { rescueStale: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    captureException(error, { route: "GET /api/cron/operational-jobs" });
    return NextResponse.json({ error: "Operational job processing failed" }, { status: 500 });
  }
}
