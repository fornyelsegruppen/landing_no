import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getInternalUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";

const inputSchema = z.object({
  language: z.enum(["nb", "lt", "en"]),
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid interface language" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const secureCookie = forwardedProtocol
    ? forwardedProtocol === "https"
    : new URL(request.url).protocol === "https:";
  cookieStore.set("tf_panel_language", parsed.data.language, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    // Production is HTTPS, while the production-build browser gate runs over
    // local HTTP. Derive the flag from the request so both environments can
    // persist the operator's language without weakening the deployed cookie.
    secure: secureCookie,
  });

  const user = await getInternalUser();
  if (user) {
    const payload = await getPayload();
    await payload.update({
      collection: "users",
      id: user.id,
      data: { interfaceLanguage: parsed.data.language },
      overrideAccess: true,
    });
  }

  return NextResponse.json({ language: parsed.data.language });
}
