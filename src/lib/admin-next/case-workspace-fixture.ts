import type {
  AdminNextCaseWorkspaceAdapter,
  AdminNextCaseWorkspaceView,
} from "@/lib/admin-next/case-workspace-contract";

export const adminNextCaseWorkspaceFixture: AdminNextCaseWorkspaceView = {
  reference: "TF-1042",
  customer: "Demo · Kari Nilsen",
  address: "Testveien 12, 0164 Oslo",
  service: "Takfornyelse",
  status: "attention",
  owner: {
    name: "Marius Hansen",
    team: "Oslo",
  },
  sla: {
    deadline: "09:30",
    remainingMinutes: -38,
    state: "overdue",
  },
  nextAction: {
    title: "Patikrinti R4 matavimą",
    reason:
      "Matavimo patikimumas yra 82 %. Prieš pasiūlymą reikia patvirtinti du stogo kraštus.",
  },
  stages: [
    { id: "inquiry", state: "complete" },
    { id: "measurement", state: "current" },
    { id: "offer", state: "blocked" },
    { id: "contract", state: "upcoming" },
    { id: "work", state: "upcoming" },
  ],
  evidence: [
    {
      id: "R4-2026-1042",
      kind: "measurement",
      state: "review",
      title: "R4 stogo matavimas",
      summary: "7 plokštumos · 2 kraštai pažymėti peržiūrai",
      metric: "186,4 m² · 82 %",
      recordedAt: "08:41",
      fallbackHref: "/admin-v2/cases",
    },
    {
      id: "PHOTOSET-1042-01",
      kind: "photo",
      state: "verified",
      title: "Objekto nuotraukos",
      summary: "12 nuotraukų · adresas ir laikas patvirtinti",
      metric: "12 failų",
      recordedAt: "08:37",
      fallbackHref: "/admin-v2/cases",
    },
    {
      id: "DOC-1042-CONSENT",
      kind: "document",
      state: "verified",
      title: "Kliento sutikimas",
      summary: "Pasirašyta skaitmeniniu būdu",
      metric: "PDF · 214 KB",
      recordedAt: "Vakar 16:52",
      fallbackHref: "/admin-v2/documents",
    },
    {
      id: "MSG-1042-03",
      kind: "communication",
      state: "verified",
      title: "Paskutinis kliento atsakymas",
      summary: "Klientas patvirtino, kad pasiūlymo laukia šiandien",
      recordedAt: "Vakar 17:06",
      fallbackHref: "/admin-v2/cases",
    },
  ],
  timeline: [
    {
      id: "timeline-measurement-ready",
      kind: "measurement",
      title: "R4 matavimas paruoštas peržiūrai",
      summary: "Automatinė patikra pažymėjo du neaiškius kraštus.",
      at: "08:41",
      actor: "Matavimo variklis",
    },
    {
      id: "timeline-owner-assigned",
      kind: "assignment",
      title: "Byla priskirta atsakingam darbuotojui",
      summary: "Atsakomybė ir šiandienos terminas patvirtinti.",
      at: "08:05",
      actor: "Darbo eilė",
    },
    {
      id: "timeline-customer-reply",
      kind: "message",
      title: "Gautas kliento atsakymas",
      summary: "Klientas paprašė pasiūlymą atsiųsti šiandien.",
      at: "Vakar 17:06",
      actor: "Kari Nilsen",
    },
    {
      id: "timeline-case-created",
      kind: "automation",
      title: "Byla sukurta automatiškai",
      summary: "Užklausa patikrinta ir įtraukta į Oslo komandą.",
      at: "Vakar 16:48",
      actor: "Takfornyelse CRM",
    },
  ],
  fallback: {
    caseHref: "/admin-v2/cases",
    documentsHref: "/admin-v2/documents",
    workHref: "/admin-v2/work",
  },
};

export const adminNextFixtureCaseWorkspaceAdapter: AdminNextCaseWorkspaceAdapter = {
  async load(reference) {
    if (reference !== adminNextCaseWorkspaceFixture.reference) {
      return { status: "not_found" };
    }
    return {
      status: "ready",
      source: "fixture",
      value: adminNextCaseWorkspaceFixture,
    };
  },
};
