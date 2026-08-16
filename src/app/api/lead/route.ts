import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { getPayload } from "@/lib/payload";
import { siteConfig } from "@/lib/site";
import { makeLeadPhotoToken } from "@/lib/lead-photo-token";
import {
  buildLeadEmailHtml,
  buildLeadEmailSubject,
  buildLeadEmailText,
} from "@/lib/lead-email";
import { buildLeadPdf, leadPdfFilename } from "@/lib/lead-pdf";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { captureException } from "@/lib/monitoring";

const inquiryTypes = [
  "takvask",
  "impregnering",
  "takmaling",
  "nytt_tak",
  "usikker",
] as const;

const leadSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(5).max(40),
  postal: z.string().min(3).max(12),
  type: z.enum(inquiryTypes),
  locale: z.enum(["no", "en"]),
  email: z.string().email().max(200).optional(),
  address: z.string().max(200).optional(),
  roofSize: z
    .string()
    .max(20)
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const n = Number(v);
        return Number.isFinite(n) && n >= 1 && n <= 2000;
      },
      { message: "Invalid roof size" },
    ),
  message: z.string().max(5000).optional(),
  photoUrls: z.array(z.string().url()).max(15).optional(),
  turnstileToken: z.string().max(2048).optional(),
  consent: z.literal(true),
  consentText: z.string().min(10).max(1000),
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
  utmContent: z.string().max(255).optional(),
  utmTerm: z.string().max(255).optional(),
  gclid: z.string().max(255).optional(),
  fbclid: z.string().max(255).optional(),
  landingPage: z.string().max(500).optional(),
  referrer: z.string().max(255).optional(),
});

function parsePhotoUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (v): v is string => typeof v === "string" && v.length > 0,
        );
      }
    } catch {
      return value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function honeypotFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Fake success so bots cannot tell they were rejected. */
function silentOk() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);

    const limited = await rateLimit("lead", ip, { limit: 8, windowSec: 60 });
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const contentType = request.headers.get("content-type") || "";
    let raw: Record<string, unknown> = {};
    let honeypotHit = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      honeypotHit =
        honeypotFilled(form.get("website")) ||
        honeypotFilled(form.get("company_url_hp"));
      raw = {
        name: form.get("name"),
        phone: form.get("phone"),
        postal: form.get("postal"),
        type: form.get("type"),
        locale: form.get("locale"),
        email: form.get("email") || undefined,
        address: form.get("address") || undefined,
        roofSize: form.get("roofSize") || undefined,
        message: form.get("message") || undefined,
        photoUrls: parsePhotoUrls(form.get("photoUrls")),
        turnstileToken: form.get("turnstileToken") || undefined,
      };
    } else {
      const body = await request.json();
      const { website, company_url_hp, ...safeBody } = body as Record<
        string,
        unknown
      >;
      honeypotHit = honeypotFilled(website) || honeypotFilled(company_url_hp);
      raw = {
        ...safeBody,
        photoUrls: parsePhotoUrls(safeBody.photoUrls),
      };
    }

    if (honeypotHit) {
      return silentOk();
    }

    const turnstile = await verifyTurnstile(
      typeof raw.turnstileToken === "string" ? raw.turnstileToken : undefined,
      ip,
    );
    if (!turnstile.ok) {
      return NextResponse.json({ error: "Captcha failed" }, { status: 400 });
    }

    const parsed = leadSchema.safeParse({
      ...raw,
      email: raw.email || undefined,
      address: raw.address || undefined,
      roofSize: raw.roofSize || undefined,
      message: raw.message || undefined,
      photoUrls: parsePhotoUrls(raw.photoUrls),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      phone,
      type,
      locale,
      message,
      email,
      address,
      roofSize,
      photoUrls = [],
      consentText,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      fbclid,
      landingPage,
      referrer,
      ...rest
    } = parsed.data;

    const approxSqm = roofSize ? Number(roofSize) : undefined;

    const payload = await getPayload();
    const created = await payload.create({
      collection: "leads",
      data: {
        name: rest.name,
        postal: rest.postal,
        phone,
        inquiryType: type,
        language: locale,
        message: message || "",
        ...(email ? { email } : {}),
        ...(address ? { address } : {}),
        ...(approxSqm && Number.isFinite(approxSqm) ? { approxSqm } : {}),
        ...(photoUrls.length ? { photoUrls: photoUrls.join("\n") } : {}),
        consentAt: new Date().toISOString(),
        consentText,
        ...(utmSource ? { utmSource } : {}),
        ...(utmMedium ? { utmMedium } : {}),
        ...(utmCampaign ? { utmCampaign } : {}),
        ...(utmContent ? { utmContent } : {}),
        ...(utmTerm ? { utmTerm } : {}),
        ...(gclid ? { gclid } : {}),
        ...(fbclid ? { fbclid } : {}),
        ...(landingPage ? { landingPage } : {}),
        ...(referrer ? { referrer } : {}),
        status: "new",
      },
      overrideAccess: true,
    });

    const photoToken = makeLeadPhotoToken(created.id);
    const emailPayload = {
      id: created.id,
      token: photoToken,
      name: rest.name,
      phone,
      postal: rest.postal,
      type,
      locale,
      email,
      address,
      approxSqm:
        approxSqm && Number.isFinite(approxSqm) ? approxSqm : undefined,
      message,
      photoUrls,
    };

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        let attachments:
          | { filename: string; content: Buffer; contentType: string }[]
          | undefined;
        try {
          const pdfBytes = await buildLeadPdf(emailPayload);
          attachments = [
            {
              filename: leadPdfFilename(emailPayload),
              content: Buffer.from(pdfBytes),
              contentType: "application/pdf",
            },
          ];
        } catch (pdfErr) {
          captureException(pdfErr, {
            route: "POST /api/lead",
            operation: "build-pdf",
          });
        }

        await resend.emails.send({
          from: process.env.LEAD_FROM_EMAIL || "leads@takfornyelse.as",
          to: process.env.LEAD_TO_EMAIL || siteConfig.email,
          ...(email ? { replyTo: email } : {}),
          subject: buildLeadEmailSubject(emailPayload),
          text: buildLeadEmailText(emailPayload),
          html: buildLeadEmailHtml(emailPayload),
          ...(attachments ? { attachments } : {}),
        });
      } catch (err) {
        captureException(err, {
          route: "POST /api/lead",
          operation: "send-email",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      id: created.id,
      photoToken,
    });
  } catch (err) {
    captureException(err, { route: "POST /api/lead" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
