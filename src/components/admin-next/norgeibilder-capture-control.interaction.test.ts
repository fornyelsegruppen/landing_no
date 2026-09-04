// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  norgeIBilderAddressCaptureKey,
  NorgeIBilderCaptureControl,
  resetNorgeIBilderCaptureDedupeForTests,
  type NorgeIBilderCaptureApi,
  type NorgeIBilderCaptureResult,
} from "./norgeibilder-capture-control";

const addressA = {
  id: "KVE:PostalAddress:A",
  label: "Lyngveien 28A, Oslo",
  postalCode: "1182",
  city: "OSLO",
  latitude: 59.91138,
  longitude: 10.7494,
  source: "entur",
};
const addressB = {
  ...addressA,
  id: "KVE:PostalAddress:B",
  label: "Lyngveien 30, Oslo",
  latitude: 59.9118,
};

function resultFor(
  address: typeof addressA,
  mediaId: string,
): NorgeIBilderCaptureResult {
  return {
    address,
    addressLabel: address.label,
    capturedAt: "2026-09-04T09:00:00.000Z",
    imageUrl: `/api/admin/media/${mediaId}`,
    rawContentHash: mediaId.repeat(64).slice(0, 64),
    sourceId: `norge-i-bilder:${mediaId}`,
  };
}

describe("Norge i Bilder capture request identity", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    resetNorgeIBilderCaptureDedupeForTests();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("ignores a stale capture response after the submitted address changes", async () => {
    const resolvers: Array<(result: NorgeIBilderCaptureResult) => void> = [];
    const api = vi.fn<NorgeIBilderCaptureApi>(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const onCaptureResultChange = vi.fn();
    const renderAddress = (address: typeof addressA) =>
      createElement(NorgeIBilderCaptureControl, {
        address,
        api,
        automaticCapture: true,
        captureKey: norgeIBilderAddressCaptureKey(13, address),
        caseReference: "TF-13",
        key: address.id,
        leadId: 13,
        onCaptureResultChange,
      });

    await act(async () => root.render(renderAddress(addressA)));
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    await act(async () => root.render(renderAddress(addressB)));
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolvers[0]!(resultFor(addressA, "91"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      onCaptureResultChange.mock.calls.some(
        ([result]) => result?.sourceId === "norge-i-bilder:91",
      ),
    ).toBe(false);

    await act(async () => {
      resolvers[1]!(resultFor(addressB, "92"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onCaptureResultChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceId: "norge-i-bilder:92" }),
      expect.objectContaining({ phase: "success" }),
    );
  });
});
