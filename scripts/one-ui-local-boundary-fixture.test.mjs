import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("./one-ui-local-boundary-fixture.mjs", import.meta.url));

describe("one-ui local boundary fixture guard", () => {
  it("prints a bounded, PII-free manifest without opening a database", () => {
    const output = execFileSync(process.execPath, [script, "manifest"], { encoding: "utf8" });
    const value = JSON.parse(output);
    expect(value.target).toMatchObject({
      database: "seo_automation_browser_20260912",
      host: "127.0.0.1",
      port: 55432,
      browserBaseUrl: "http://127.0.0.1:3217",
    });
    expect(value.boundedCounts).toMatchObject({
      leads: 325,
      selectiveFilterLeads: 26,
      messagesOnAnchorLead: 126,
      ownerVersions: 126,
      measurements: 126,
      quotes: 126,
      contracts: 126,
      workOrders: 126,
      invoiceRecords: 126,
      warranties: 126,
      officialInvoices: 126,
      contractRequests: 126,
      privateMediaDecoys: 501,
    });
    expect(value.ownerTypes).toEqual([
      "roof-measurement",
      "quote",
      "contract",
      "work-order",
      "invoice-record",
      "warranty",
    ]);
    expect(value.boundaryAssertions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("actual private_media source rows"),
        expect.stringContaining("local3217 has no roof_measurements.version"),
      ]),
    );
    expect(output).not.toMatch(/@(?!(example\.invalid))/i);
  });

  it("fails before connecting when the explicit actor is absent", () => {
    let error;
    try {
      execFileSync(process.execPath, [script, "seed"], {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
        },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error?.status).toBe(1);
    expect(`${error?.stderr ?? ""}`).toContain("ONE_UI_BOUNDARY_FIXTURE_ACTOR");
  });
});
