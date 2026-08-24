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
  cookieStore.set("tf_panel_language", parsed.data.language, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/user",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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
