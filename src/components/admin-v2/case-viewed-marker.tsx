"use client";

import { useEffect } from "react";

export function CaseViewedMarker({ leadId, reviewed }: { leadId: number; reviewed: boolean }) {
  useEffect(() => {
    if (reviewed) return;
    void fetch(`/api/admin/leads/${leadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_reviewed" }),
      keepalive: true,
    }).catch(() => undefined);
  }, [leadId, reviewed]);
  return null;
}
