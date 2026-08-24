import { describe, expect, it } from "vitest";
import { prepareEditorialPost } from "@/lib/blog/editorial-policy";
import { articleLeadMetrics } from "@/lib/blog/article-attribution";
import { recommendContentAudit } from "@/lib/blog/content-audit";
import { captureLeadAttribution } from "@/lib/lead-attribution";
import { contactMethodSchema } from "@/lib/lead-contact-validation";
import { prepareMeasurement } from "@/lib/measurements/proposal";
import { calculatePrice } from "@/lib/measurements/pricing";
import { assertContractTransition, assertQuoteTransition } from "@/lib/quotes/workflow";
import { assessPrecheck } from "@/lib/work-orders/precheck";
import { assertWorkOrderTransition, type WorkOrderStatus } from "@/lib/work-orders/workflow";

const METERS_PER_DEGREE = 111_319.49079327358;

function roofRectangle(width: number, height: number) {
  const latitude = 60;
  const latitudeDelta = height / METERS_PER_DEGREE;
  const longitudeDelta = width / (METERS_PER_DEGREE * Math.cos(latitude * Math.PI / 180));
  return [
    { latitude, longitude: 10 },
    { latitude, longitude: 10 + longitudeDelta },
    { latitude: latitude + latitudeDelta, longitude: 10 + longitudeDelta },
    { latitude: latitude + latitudeDelta, longitude: 10 },
  ];
}

describe("anonymized internal staging journey", () => {
  it("covers blog attribution, lead, measurement, price, contract and documented work", () => {
    const article = prepareEditorialPost(null, {
      _status: "published",
      editorialStatus: "approved",
      titleNo: "Slik vurderes et tak før vask",
      contentNo: "Faglig kontroll og trygg adkomst kommer alltid først.",
      authorName: "Takfornyelse",
      reviewerName: "Faglig ansvarlig",
      reviewedAt: "2026-08-23T08:00:00.000Z",
    }, new Date("2026-08-23T09:00:00.000Z"));
    expect(article.editorialStatus).toBe("published");

    const attribution = captureLeadAttribution(
      "https://www.takfornyelse.as/no?utm_source=google",
      "https://www.google.no/",
      "/no/blogg/slik-vurderes-et-tak",
    );
    expect(contactMethodSchema.safeParse({ email: "pilot@example.invalid" }).success).toBe(true);
    expect(attribution.contentSourcePath).toBe("/no/blogg/slik-vurderes-et-tak");

    const measurement = prepareMeasurement({
      proposal: {
        buildingIdentifier: "ANONYMIZED-PILOT-1",
        confidence: "high",
        confidenceReasoning: "Tydelige bygnings- og takkanter i lisensiert testgrunnlag.",
        roofPlanes: [{ id: "main", polygon: roofRectangle(12, 10), angleMinDegrees: 27, angleMaxDegrees: 32 }],
      },
      addressResolved: true,
      sourceAuthorized: true,
      hasApprovedPriceRule: true,
    });
    expect(measurement.status).toBe("draft");
    expect(measurement.calculation).not.toBeNull();

    const quantityTenths = measurement.calculation!.actualAreaMaxTenths;
    const rule = { id: "pilot-rule", version: 1, serviceKey: "takvask", unitPriceExVatOre: 13_800, vatBasisPoints: 2_500, minimumExVatOre: 100_000, toleranceBasisPoints: 1_000, status: "approved" as const };
    const price = calculatePrice(quantityTenths, rule);
    expect(price.totalIncVatOre).toBeGreaterThan(0);

    const quotePath = ["draft", "approved", "sent", "viewed", "accepted"] as const;
    for (let index = 1; index < quotePath.length; index += 1) assertQuoteTransition(quotePath[index - 1], quotePath[index]);
    assertContractTransition("draft", "issued");
    assertContractTransition("issued", "signed");

    const precheck = assessPrecheck({
      actualAreaTenths: quantityTenths,
      hmsSafe: true,
      scopeChanged: false,
      contract: {
        estimatedAreaMinTenths: measurement.calculation!.actualAreaMinTenths,
        estimatedAreaMaxTenths: quantityTenths,
        toleranceBasisPoints: price.toleranceBasisPoints,
        originalTotalIncVatOre: price.totalIncVatOre,
        maximumTotalIncVatOre: price.maximumTotalIncVatOre,
      },
      rule,
    });
    expect(precheck.decision).toBe("ready");

    const workPath: readonly WorkOrderStatus[] = ["unassigned", "assigned", "scheduled", "on_way", "arrived", "precheck", "ready", "in_progress", "completed", "documented"];
    for (let index = 1; index < workPath.length; index += 1) assertWorkOrderTransition(workPath[index - 1], workPath[index]);

    const leadMetrics = articleLeadMetrics([{ contentSourcePath: attribution.contentSourcePath, status: "converted" }], "slik-vurderes-et-tak");
    expect(leadMetrics).toEqual({ leads: 1, convertedLeads: 1 });
    expect(recommendContentAudit({ publishedAt: article.publishedAt, impressions: 0, clicks: 0, ctrPercent: 0, averagePosition: 0, leads: leadMetrics.leads, convertedLeads: leadMetrics.convertedLeads, now: new Date("2026-08-24T09:00:00.000Z") }).recommendation).toBe("keep");
  });
});
