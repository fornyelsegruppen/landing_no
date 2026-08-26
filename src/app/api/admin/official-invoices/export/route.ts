import JSZip from "jszip";
import { NextResponse } from "next/server";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { readPrivateMediaContent } from "@/lib/private-media-content";
import { userIsAdmin } from "@/payload/access/roles";

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return null;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "faktura";
}

export async function GET(request: Request) {
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const month = new URL(request.url).searchParams.get("month") || "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Choose a month in YYYY-MM format" }, { status: 400 });
  const [year, monthNumber] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, monthNumber - 1, 1));
  const to = new Date(Date.UTC(year, monthNumber, 1));
  const result = await payload.find({ collection: "official-invoices", depth: 0, limit: 1000, pagination: false, sort: "issuedAt", overrideAccess: true, where: { and: [
    { extractionStatus: { equals: "confirmed" } },
    { issuedAt: { greater_than_equal: from.toISOString() } },
    { issuedAt: { less_than: to.toISOString() } },
  ] } });
  const zip = new JSZip();
  const rows = [["Fakturanummer", "Fakturadato", "Forfallsdato", "Status", "Ekskl. mva. NOK", "Mva. NOK", "Totalt NOK", "Betalt dato", "Betalt NOK", "Bankreferanse", "Dokument"]];
  for (const invoice of result.docs) {
    const mediaId = relationId(invoice.originalDocument);
    if (!mediaId) continue;
    const media = await payload.findByID({ collection: "private-media", id: mediaId, depth: 0, overrideAccess: true });
    const file = await readPrivateMediaContent(media);
    const filename = `${safeFilename(invoice.invoiceNumber || invoice.reference)}.pdf`;
    zip.file(`fakturaer/${filename}`, file.data);
    rows.push([
      invoice.invoiceNumber || invoice.reference,
      invoice.issuedAt?.slice(0, 10) || "",
      invoice.dueAt?.slice(0, 10) || "",
      invoice.status,
      ((invoice.subtotalExVatOre || 0) / 100).toFixed(2),
      ((invoice.vatOre || 0) / 100).toFixed(2),
      ((invoice.totalIncVatOre || 0) / 100).toFixed(2),
      invoice.paidAt?.slice(0, 10) || "",
      typeof invoice.paidAmountOre === "number" ? (invoice.paidAmountOre / 100).toFixed(2) : "",
      invoice.bankReference || "",
      filename,
    ]);
  }
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  zip.file(`fakturaoversikt-${month}.csv`, csv);
  zip.file("LES-MEG.txt", "Eksport fra Takfornyelse Control Center. Originale Fiken-PDF-er ligger i mappen fakturaer. CSV-beløp er oppgitt i NOK. Kontroller alltid mot Fiken og bank før bokføring.");
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await recordAuditEvent(createPayloadAuditWriter(payload), { actorId: user.id, action: "official-invoice.month-exported", entityType: "official-invoice-export", entityId: month, correlationId: correlationIdFromHeaders(request.headers), metadata: { count: result.docs.length, month } });
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="takfornyelse-fakturaer-${month}.zip"`, "Cache-Control": "private, no-store" } });
}
