import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { cronRequestAuthorized } from "@/lib/security/cron-auth";
import { processOperationalJobs } from "@/lib/jobs/operational-job-processor";
import { scanCaseInvariants } from "@/lib/cases/payload-invariant-scanner";
import { automaticCommunicationIsPaused } from "@/lib/platform/operating-mode";
import {
  prod84NoSendUatMode,
  recordProd84NoSendProbe,
  validProd84NoSendProbe,
} from "@/lib/jobs/preview-prod8-4-uat";

export const runtime = "nodejs";
export const maxDuration = 60;

function noStoreResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
    status,
  });
}

export async function GET(request: Request) {
  if (!cronRequestAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const requestUrl = new URL(request.url);
    const hasUatMode = requestUrl.searchParams.has("uat");
    const uatMode = requestUrl.searchParams.get("uat");
    if (hasUatMode) {
      if (process.env.VERCEL_ENV !== "preview") {
        return noStoreResponse({ error: "Not found" }, 404);
      }
      if (uatMode !== prod84NoSendUatMode) {
        return noStoreResponse({ error: "Unknown UAT mode" }, 400);
      }
      if (!automaticCommunicationIsPaused()) {
        return noStoreResponse({ error: "Automation pause required" }, 409);
      }
      const probe = request.headers.get("x-preview-uat-probe");
      if (!validProd84NoSendProbe(probe)) {
        return noStoreResponse({ error: "Invalid UAT probe" }, 400);
      }
      const payload = await getPayload();
      const invariants = await scanCaseInvariants(payload, { persist: false });
      const result = await recordProd84NoSendProbe(payload, probe);
      return noStoreResponse({ ok: true, ...result, invariants });
    }

    const payload = await getPayload();
    const requestedLimit = Number(requestUrl.searchParams.get("limit") || 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50)
      : 10;
    const result = await processOperationalJobs(payload, {
      rescueStale: true,
      limit,
    });
    const invariants = await scanCaseInvariants(payload, { persist: true });
    return NextResponse.json({ ok: true, ...result, invariants });
  } catch (error) {
    captureException(error, { route: "GET /api/cron/operational-jobs" });
    return NextResponse.json(
      { error: "Operational job processing failed" },
      { status: 500 },
    );
  }
}
