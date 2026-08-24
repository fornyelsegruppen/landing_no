import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { createQuoteDraft } from "@/lib/quotes/payload-quote-engine";
import { userIsAdmin } from "@/payload/access/roles";

const schema = z.object({ calculationId: z.number().int().positive() });

export async function POST(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid calculation" }, { status: 400 });
  try {
    const result = await createQuoteDraft(payload, parsed.data.calculationId);
    return NextResponse.json({ quoteId: result.quote.id, contractId: result.contract.id }, { status: 201 });
  } catch (error) {
    console.error("Quote draft creation failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Quote creation failed" }, { status: 409 });
  }
}
