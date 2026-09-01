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
      previewHref:
        "/admin-next-preview/cases/TF-1042/measurements/R4-2026-1042",
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
  measurementReview: {
    reference: "R4-2026-1042",
    state: "review_required",
    areaSquareMeters: 186.4,
    confidencePercent: 82,
    planeCount: 7,
    provenance: {
      evidenceId: "EVD-R4-1042-01",
      source: "Deterministic Preview fixture · R4 aerial evidence",
      capturedAt: "2026-09-01 08:37",
      modelVersion: "R4 preview schema v1",
      checksum: "sha256:demo-1042-r4",
    },
    planes: [
      { id: "P1", areaSquareMeters: 42.8, pitchDegrees: 22, state: "verified" },
      { id: "P2", areaSquareMeters: 38.6, pitchDegrees: 24, state: "verified" },
      { id: "P3", areaSquareMeters: 31.2, pitchDegrees: 22, state: "review" },
      { id: "P4", areaSquareMeters: 28.4, pitchDegrees: 24, state: "verified" },
      { id: "P5", areaSquareMeters: 18.7, pitchDegrees: 17, state: "verified" },
      { id: "P6", areaSquareMeters: 15.9, pitchDegrees: 17, state: "review" },
      { id: "P7", areaSquareMeters: 10.8, pitchDegrees: 12, state: "verified" },
    ],
    reviewEdges: [
      {
        id: "E-04",
        between: "P2 ↔ P3",
        reason: "Kraigo pabaigos taškas nesutampa su nuotraukos kontūru",
        varianceMeters: 0.42,
      },
      {
        id: "E-11",
        between: "P5 ↔ P6",
        reason: "Kraštą dalinai uždengia kamino šešėlis",
        varianceMeters: 0.31,
      },
    ],
    nextAction:
      "Palyginti E-04 ir E-11 kraštus su objekto nuotraukomis, tada patvirtinti arba pataisyti geometriją veikiančiame matavimo sraute.",
    fallbackHref: "/admin-v2/cases",
  },
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
