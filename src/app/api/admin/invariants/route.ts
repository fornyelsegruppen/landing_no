import { NextResponse } from "next/server";
import { scanCaseInvariants } from "@/lib/cases/payload-invariant-scanner";
import { applySafeCaseReconciliation, previewSafeCaseReconciliation } from "@/lib/cases/case-reconciliation";
import { captureException } from "@/lib/monitoring";
import { getPayload } from "@/lib/payload";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const [result, reconciliationPreview] = await Promise.all([
      scanCaseInvariants(payload, { persist: true }),
      previewSafeCaseReconciliation(payload),
    ]);
    return NextResponse.json({ ok: true, ...result, reconciliationPreview });
  } catch (error) {
    captureException(error, { route: "GET /api/admin/invariants" });
    return NextResponse.json({ error: "Invariant scan failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const result = await applySafeCaseReconciliation(payload, { actorId: user.id });
    const scan = await scanCaseInvariants(payload, { persist: true });
    return NextResponse.json({ ok: true, reconciliation: result, scan });
  } catch (error) {
    captureException(error, { route: "POST /api/admin/invariants" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invariant reconciliation failed" }, { status: 409 });
  }
}
