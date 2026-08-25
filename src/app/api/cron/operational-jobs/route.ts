import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import { processOperationalJobs } from "@/lib/jobs/operational-job-processor";
import { scanCaseInvariants } from "@/lib/cases/payload-invariant-scanner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await getPayload();
    const requestUrl = new URL(request.url);
    const requestedLimit = Number(requestUrl.searchParams.get("limit") || 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 10;
    const result = await processOperationalJobs(payload, { rescueStale: true, limit });
    const invariants = await scanCaseInvariants(payload, { persist: true });
    return NextResponse.json({ ok: true, ...result, invariants });
  } catch (error) {
    captureException(error, { route: "GET /api/cron/operational-jobs" });
    return NextResponse.json({ error: "Operational job processing failed" }, { status: 500 });
  }
}
