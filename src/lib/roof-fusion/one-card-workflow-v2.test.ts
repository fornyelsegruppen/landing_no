import { describe, expect, it } from "vitest";
import {
  ROOF_FUSION_ONE_CARD_INITIAL_STATE_V2,
  reduceRoofFusionOneCardStateV2,
} from "./one-card-workflow-v2";

describe("Roof Fusion One Card v2 workflow", () => {
  it("follows the normal address-to-result path without exposing internal save stages", () => {
    const acquiring = reduceRoofFusionOneCardStateV2(
      ROOF_FUSION_ONE_CARD_INITIAL_STATE_V2,
      { type: "SEARCH", requestId: "search-1" },
    );
    const select = reduceRoofFusionOneCardStateV2(acquiring, {
      type: "CAPTURE_READY",
      requestId: "search-1",
      sourceId: "norge-1",
    });
    const annotate = reduceRoofFusionOneCardStateV2(select, {
      type: "SELECT_BUILDING",
      candidateId: "way/123",
    });
    const calculating = reduceRoofFusionOneCardStateV2(annotate, {
      type: "CALCULATE",
    });
    const result = reduceRoofFusionOneCardStateV2(calculating, {
      type: "CALCULATION_READY",
      resultId: "rf-result-1",
    });

    expect(acquiring.status).toBe("acquiring");
    expect(select.status).toBe("building_select");
    expect(annotate.status).toBe("annotate");
    expect(calculating.status).toBe("calculating");
    expect(result).toMatchObject({
      status: "result",
      candidateId: "way/123",
      resultId: "rf-result-1",
    });
  });

  it("ignores a late capture response from a replaced address request", () => {
    const first = reduceRoofFusionOneCardStateV2(
      ROOF_FUSION_ONE_CARD_INITIAL_STATE_V2,
      { type: "SEARCH", requestId: "search-1" },
    );
    const second = reduceRoofFusionOneCardStateV2(first, {
      type: "SEARCH",
      requestId: "search-2",
    });
    const late = reduceRoofFusionOneCardStateV2(second, {
      type: "CAPTURE_READY",
      requestId: "search-1",
      sourceId: "stale-source",
    });

    expect(late).toEqual(second);
  });

  it("returns blocked calculations to the same preserved annotation context", () => {
    const annotate = {
      status: "annotate" as const,
      requestId: "search-1",
      sourceId: "norge-1",
      candidateId: "way/123",
    };
    const calculating = reduceRoofFusionOneCardStateV2(annotate, {
      type: "CALCULATE",
    });
    const blocked = reduceRoofFusionOneCardStateV2(calculating, {
      type: "CALCULATION_BLOCKED",
      reason: "Trūksta aukščio paviršiaus",
    });
    const retry = reduceRoofFusionOneCardStateV2(blocked, {
      type: "CALCULATE",
    });

    expect(blocked).toMatchObject({
      status: "blocked",
      candidateId: "way/123",
    });
    expect(retry.status).toBe("calculating");
  });

  it("supports changing the building and a separately explicit offer transition", () => {
    const result = {
      status: "result" as const,
      requestId: "search-1",
      sourceId: "norge-1",
      candidateId: "way/123",
      resultId: "result-1",
    };
    const selecting = reduceRoofFusionOneCardStateV2(result, {
      type: "CHANGE_BUILDING",
    });
    const adding = reduceRoofFusionOneCardStateV2(result, {
      type: "ADD_TO_OFFER",
    });
    const added = reduceRoofFusionOneCardStateV2(adding, {
      type: "OFFER_ADDED",
      measurementId: "RF-42",
      offerId: "offer-9",
    });

    expect(selecting.status).toBe("building_select");
    expect(adding.status).toBe("adding_to_offer");
    expect(added).toMatchObject({
      status: "offer_added",
      measurementId: "RF-42",
      offerId: "offer-9",
    });
  });

  it("opens an offered measurement correction as a new revision context", () => {
    const offered = {
      status: "offer_added" as const,
      requestId: "search-1",
      sourceId: "norge-1",
      candidateId: "way/123",
      resultId: "result-r7",
      measurementId: "RF-42-r7",
      offerId: "offer-9",
    };
    const correction = reduceRoofFusionOneCardStateV2(offered, {
      type: "EDIT_MEASUREMENT",
    });
    const calculating = reduceRoofFusionOneCardStateV2(correction, {
      type: "CALCULATE",
    });

    expect(correction).toMatchObject({
      status: "annotate",
      revisesMeasurementId: "RF-42-r7",
    });
    expect(calculating).toMatchObject({
      status: "calculating",
      revisesMeasurementId: "RF-42-r7",
    });
  });
});
