import { NextResponse } from "next/server";
import { z } from "zod";
import { getPayload } from "@/lib/payload";
import { panelLanguagePreferenceCookie } from "@/lib/panel-language-preference";
import { userIsActive } from "@/payload/access/roles";

const inputSchema = z.object({
  interfaceLanguage: z.enum(["nb", "lt", "en"]),
});

export async function POST(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user || !userIsActive(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }

  await payload.update({
    collection: "users",
    id: user.id,
    overrideAccess: true,
    data: { interfaceLanguage: parsed.data.interfaceLanguage },
  });

  const response = NextResponse.json({ ok: true });
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const secureCookie = forwardedProtocol
    ? forwardedProtocol === "https"
    : new URL(request.url).protocol === "https:";
  response.cookies.set(
    panelLanguagePreferenceCookie,
    parsed.data.interfaceLanguage,
    {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: secureCookie,
    },
  );
  return response;
}
