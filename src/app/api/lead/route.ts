import { after, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import {
  assertPreviewEmailRecipientsAllowed,
  previewEmailSubject,
} from "@/lib/messages/preview-email-recipient-policy";
import { getPayload } from "@/lib/payload";
import { siteConfig } from "@/lib/site";
import { makeLeadPhotoToken } from "@/lib/lead-photo-token";
import {
  buildLeadEmailHtml,
  buildLeadEmailSubject,
  buildLeadEmailText,
} from "@/lib/lead-email";
import { buildLeadPdf, leadPdfFilename } from "@/lib/lead-pdf";
import {
  adminNotificationFallbackLocale,
  parseAdminNotificationRecipients,
  resolveAdminNotificationRecipients,
  type AdminNotificationProfile,
} from "@/lib/lead-admin-notification-recipient";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { captureException, captureOperationalNotice } from "@/lib/monitoring";
import {
  contactMethodSchema,
  optionalPhoneSchema,
} from "@/lib/lead-contact-validation";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import {
  createReceiptMessage,
  deliverMessage,
  enqueueLeadAiJob,
} from "@/lib/messages/message-engine";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { readFeatureFlags } from "@/lib/platform/features";
import { processOperationalJobs } from "@/lib/jobs/operational-job-processor";
import {
  clearedAddressVerification,
  resolveKartverketAddressClaim,
  verifiedAddressFields,
} from "@/lib/leads/address-verification";

const optionalAttributionText = (max: number) =>
  z.string().trim().max(max).optional();

const inquiryTypes = [
  "takvask",
  "takvask_impregnering",
  "impregnering",
  "takmaling",
  "nytt_tak",
  "usikker",
] as const;

const addressSelectionSchema = z
  .object({
    provider: z.literal("kartverket-address-rest-v1"),
    providerAddressId: z.string().trim().min(1).max(300),
    canonicalLabel: z.string().trim().min(4).max(200),
    streetAddress: z.string().trim().min(2).max(200),
    postalCode: z.string().trim().min(3).max(12),
    city: z.string().trim().min(1).max(120),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();

const leadSchema = z
  .object({
    name: z.string().min(2).max(120),
    phone: optionalPhoneSchema,
    postal: z.string().min(3).max(12),
    type: z.enum(inquiryTypes),
    locale: z.enum(["no", "en"]),
    email: z.string().email().max(200).optional(),
    address: z.string().trim().max(200).optional(),
    addressSelection: addressSelectionSchema.optional(),
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
    utmSource: optionalAttributionText(255),
    utmMedium: optionalAttributionText(255),
    utmCampaign: optionalAttributionText(255),
    utmContent: optionalAttributionText(255),
    utmTerm: optionalAttributionText(255),
    gclid: optionalAttributionText(512),
    gbraid: optionalAttributionText(512),
    wbraid: optionalAttributionText(512),
    fbclid: optionalAttributionText(512),
    msclkid: optionalAttributionText(512),
    landingPage: optionalAttributionText(1000),
    contentSourcePath: z
      .string()
      .regex(/^\/(no|en)\/blogg\/[a-z0-9-]+$/)
      .max(500)
      .optional(),
    referrer: optionalAttributionText(1000),
    marketingConsent: z.enum(["granted", "denied", "unknown"]).optional(),
  })
  .refine((data) => contactMethodSchema.safeParse(data).success, {
    message: "Phone or email is required",
    path: ["phone"],
  })
  .superRefine((data, context) => {
    if (!data.addressSelection) return;
    if (data.address?.trim() !== data.addressSelection.streetAddress) {
      context.addIssue({
        code: "custom",
        message: "Selected address does not match the submitted address",
        path: ["addressSelection", "streetAddress"],
      });
    }
    if (data.postal.trim() !== data.addressSelection.postalCode) {
      context.addIssue({
        code: "custom",
        message: "Selected address does not match the submitted postal code",
        path: ["addressSelection", "postalCode"],
      });
    }
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
  const correlationId = correlationIdFromHeaders(request.headers);
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
        phone: form.get("phone") || undefined,
        postal: form.get("postal"),
        type: form.get("type"),
        locale: form.get("locale"),
        email: form.get("email") || undefined,
        address: form.get("address"),
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
      phone: raw.phone || undefined,
      email: raw.email || undefined,
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
      addressSelection,
      roofSize,
      photoUrls = [],
      consentText,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      gbraid,
      wbraid,
      fbclid,
      msclkid,
      landingPage,
      contentSourcePath,
      referrer,
      marketingConsent,
      ...rest
    } = parsed.data;

    const approxSqm = roofSize ? Number(roofSize) : undefined;
    let resolvedAddress = null;
    if (addressSelection) {
      try {
        resolvedAddress = await resolveKartverketAddressClaim(addressSelection);
      } catch (error) {
        captureException(error, {
          route: "POST /api/lead",
          operation: "verify-address-selection",
          correlationId,
        });
      }
    }
    const addressVerification = resolvedAddress
      ? verifiedAddressFields(resolvedAddress, new Date())
      : clearedAddressVerification(
          addressSelection
            ? "verification_failed"
            : address
              ? "manual"
              : "unverified",
        );

    const payload = await getPayload();
    const created = await payload.create({
      collection: "leads",
      draft: false,
      data: {
        name: rest.name,
        postal: rest.postal,
        ...(phone ? { phone } : {}),
        inquiryType: type,
        language: locale,
        message: message || "",
        ...(email ? { email } : {}),
        preferredChannel: email ? "email" : "sms",
        address: resolvedAddress?.streetAddress || address || "Ikke oppgitt",
        ...(resolvedAddress ? { city: resolvedAddress.city } : {}),
        ...addressVerification,
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
        ...(gbraid ? { gbraid } : {}),
        ...(wbraid ? { wbraid } : {}),
        ...(fbclid ? { fbclid } : {}),
        ...(msclkid ? { msclkid } : {}),
        ...(landingPage ? { landingPage } : {}),
        ...(contentSourcePath ? { contentSourcePath } : {}),
        ...(referrer ? { referrer } : {}),
        ...(marketingConsent ? { marketingConsent } : {}),
        status: "new",
        recordState: "active",
        nextActionOwner: "administrator",
        caseRevision: 1,
        addressRevision: 1,
        nextAction: email
          ? "Kontroller henvendelsen og eventuelt svarutkast."
          : "Ring kunden. Automatisk e-postløp er ikke tilgjengelig uten e-postadresse.",
        nextActionAt: new Date(
          email ? Date.now() + 2 * 60 * 60_000 : Date.now(),
        ).toISOString(),
      },
      overrideAccess: true,
    });

    const immediateJobIds: number[] = [];
    try {
      const receipt = await createReceiptMessage(
        payload,
        created.id,
        correlationId,
      );
      if (!receipt.skipped && !receipt.duplicate) {
        const provider = createEmailProvider();
        if (provider.health().status === "ready") {
          await deliverMessage(
            payload,
            provider,
            receipt.message.id,
            correlationId,
            "customer_initiated",
          );
        }
        if (typeof receipt.job?.id === "number")
          immediateJobIds.push(receipt.job.id);
      }
    } catch (error) {
      captureException(error, {
        route: "POST /api/lead",
        operation: "receipt-outbox",
        correlationId,
      });
    }

    if (readFeatureFlags().aiDrafts && email) {
      try {
        const aiJob = await enqueueLeadAiJob(
          payload,
          created.id,
          correlationId,
        );
        if (typeof aiJob?.id === "number") immediateJobIds.push(aiJob.id);
      } catch (error) {
        captureException(error, {
          route: "POST /api/lead",
          operation: "ai-draft-outbox",
          correlationId,
        });
      }
    }

    if (immediateJobIds.length) {
      after(async () => {
        try {
          await processOperationalJobs(payload, {
            jobIds: immediateJobIds,
            limit: immediateJobIds.length,
            rescueStale: false,
          });
        } catch (error) {
          captureException(error, {
            route: "POST /api/lead",
            operation: "immediate-operational-jobs",
            correlationId,
          });
        }
      });
    }

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
      address: resolvedAddress?.label || address,
      approxSqm:
        approxSqm && Number.isFinite(approxSqm) ? approxSqm : undefined,
      message,
      photoUrls,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      gclid,
      gbraid,
      wbraid,
      fbclid,
      msclkid,
      landingPage,
      contentSourcePath,
      referrer,
      marketingConsent,
    };

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const notificationRecipient =
          process.env.LEAD_TO_EMAIL || siteConfig.email;
        assertPreviewEmailRecipientsAllowed({ to: notificationRecipient });
        const configuredRecipients = parseAdminNotificationRecipients(
          notificationRecipient,
        );
        if (!configuredRecipients.length) {
          throw new TypeError(
            "No valid lead notification recipient configured",
          );
        }

        let profiles: AdminNotificationProfile[] = [];
        let profileLookupFailed = false;
        try {
          const matchedProfiles = await payload.find({
            collection: "users",
            depth: 0,
            limit: configuredRecipients.length,
            pagination: false,
            overrideAccess: true,
            select: {
              active: true,
              email: true,
              interfaceLanguage: true,
              role: true,
            },
            where: {
              and: [
                {
                  email: {
                    in: configuredRecipients.map(
                      (recipient) => recipient.email,
                    ),
                  },
                },
                { active: { equals: true } },
                { role: { equals: "admin" } },
              ],
            },
          });
          profiles = matchedProfiles.docs;
        } catch (profileLookupError) {
          profileLookupFailed = true;
          captureException(profileLookupError, {
            route: "POST /api/lead",
            operation: "resolve-admin-notification-language",
          });
        }

        const recipients = resolveAdminNotificationRecipients({
          configuredRecipients: notificationRecipient,
          fallbackLocale: adminNotificationFallbackLocale(),
          profiles,
        });
        const fallbackRecipients = recipients.filter(
          (recipient) => recipient.localeSource === "fallback",
        );
        if (fallbackRecipients.length) {
          captureOperationalNotice("admin_notification_language_fallback", {
            count: fallbackRecipients.length,
            fallbackLocale: adminNotificationFallbackLocale(),
            reason: profileLookupFailed
              ? "profile_lookup_failed"
              : "matching_active_admin_profile_missing_or_invalid",
            route: "POST /api/lead",
          });
        }

        for (const recipient of recipients) {
          try {
            let attachments:
              | { filename: string; content: Buffer; contentType: string }[]
              | undefined;
            try {
              const pdfBytes = await buildLeadPdf(
                emailPayload,
                recipient.locale,
              );
              attachments = [
                {
                  filename: leadPdfFilename(emailPayload, recipient.locale),
                  content: Buffer.from(pdfBytes),
                  contentType: "application/pdf",
                },
              ];
            } catch (pdfErr) {
              captureException(pdfErr, {
                route: "POST /api/lead",
                operation: "build-admin-notification-pdf",
              });
            }

            assertPreviewEmailRecipientsAllowed({ to: recipient.to });
            await resend.emails.send({
              from: process.env.LEAD_FROM_EMAIL || "leads@takfornyelse.as",
              to: recipient.to,
              ...(email ? { replyTo: email } : {}),
              subject: previewEmailSubject(
                buildLeadEmailSubject(emailPayload, recipient.locale),
              ),
              text: buildLeadEmailText(emailPayload, recipient.locale),
              html: buildLeadEmailHtml(emailPayload, recipient.locale),
              ...(attachments ? { attachments } : {}),
            });
          } catch (recipientError) {
            captureException(recipientError, {
              route: "POST /api/lead",
              operation: "send-admin-notification-email",
            });
          }
        }
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
