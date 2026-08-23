import { timingSafeEqual } from "node:crypto";
import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { getPayload } from "@/lib/payload";
import { captureException } from "@/lib/monitoring";
import { userIsAdmin } from "@/payload/access/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

async function isAuthorized(
  request: Request,
  previewURL: URL,
): Promise<boolean> {
  const configuredSecret = process.env.PREVIEW_SECRET;
  const providedSecret = previewURL.searchParams.get("secret");

  if (
    configuredSecret &&
    providedSecret &&
    secretsMatch(providedSecret, configuredSecret)
  ) {
    return true;
  }

  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  return userIsAdmin(user);
}

export async function GET(request: Request) {
  try {
    const previewURL = new URL(request.url);

    if (!(await isAuthorized(request, previewURL))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locale = previewURL.searchParams.get("locale") === "en" ? "en" : "no";
    const draft = await draftMode();
    draft.enable();

    const response = NextResponse.redirect(new URL(`/${locale}`, previewURL));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    captureException(error, { route: "GET /api/preview" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
