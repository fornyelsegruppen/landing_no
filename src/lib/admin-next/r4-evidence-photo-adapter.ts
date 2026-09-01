import type { AdminNextR4MeasurementView } from "@/lib/admin-next/r4-read-adapter";
import type { PanelLocale } from "@/lib/panel-i18n";

const copy = {
  nb: {
    label: "Kundebilde",
    source: "Sendt inn av kunden",
  },
  lt: {
    label: "Kliento nuotrauka",
    source: "Pateikė klientas",
  },
  en: {
    label: "Customer photo",
    source: "Submitted by the customer",
  },
} as const;

export function appendAdminNextR4LeadPhotoEvidence(input: {
  measurement: AdminNextR4MeasurementView;
  leadId: number;
  photoCount: number;
  capturedAt: string;
  locale: PanelLocale;
}): AdminNextR4MeasurementView {
  const count = Math.min(Math.max(Math.trunc(input.photoCount), 0), 4);
  if (!count) return input.measurement;

  const t = copy[input.locale];
  const photos = Array.from({ length: count }, (_, index) => ({
    id: `lead-${input.leadId}-photo-${index}`,
    label: `${t.label} ${index + 1}`,
    source: t.source,
    capturedAt: input.capturedAt,
    previewHref: `/api/admin/leads/${input.leadId}/photo?index=${index}`,
  }));

  return {
    ...input.measurement,
    photos: [...photos, ...input.measurement.photos],
  };
}
