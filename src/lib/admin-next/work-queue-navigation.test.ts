import { describe, expect, it } from "vitest";
import {
  adminNextPreviewCaseWorkspaceHref,
  adminNextPreviewWorkQueueEntry,
  safeAdminNextWorkQueueReturnTo,
} from "./work-queue-navigation";

describe("Admin Next Work Queue navigation", () => {
  it("preserves allowlisted filters, selection and detail focus", () => {
    const returnTo =
      "/admin-next-preview/work?view=today&queue=mine&stage=commercial&action=prepare_package&ownerId=user%3A7&cursor=wq1_abcdefghijklmnop&limit=10&selected=case%3A13#work-queue-detail";

    expect(safeAdminNextWorkQueueReturnTo(returnTo, "TF-13")).toBe(returnTo);
    const href = adminNextPreviewCaseWorkspaceHref({
      caseReference: "TF-13",
      returnTo,
    });
    const url = new URL(href, "https://preview.invalid");
    expect(url.pathname).toBe("/admin-next-preview/cases/TF-13");
    expect(url.searchParams.get("returnTo")).toBe(returnTo);
  });

  it("canonicalizes the verified ONE UI entry path", () => {
    expect(safeAdminNextWorkQueueReturnTo(adminNextPreviewWorkQueueEntry)).toBe(
      adminNextPreviewWorkQueueEntry,
    );
  });

  it.each([
    ["external origin", "https://evil.example/admin-next-preview/work"],
    ["absolute URL", "https://admin.invalid/admin-next-preview/work"],
    ["relative path", "admin-next-preview/work"],
    ["protocol-relative", "//evil.example/admin-next-preview/work"],
    ["wrong surface", "/admin-v2?view=today&queue=all&limit=25"],
    [
      "unknown query key",
      "/admin-next-preview/work?view=today&queue=all&limit=25&redirect=https%3A%2F%2Fevil.example",
    ],
    [
      "duplicate query value",
      "/admin-next-preview/work?view=today&queue=all&queue=mine&limit=25",
    ],
    [
      "cross-case selection",
      "/admin-next-preview/work?view=today&queue=all&limit=25&selected=case%3A14#work-queue-detail",
    ],
    [
      "unapproved focus",
      "/admin-next-preview/work?view=today&queue=all&limit=25&selected=case%3A13#customer-record",
    ],
  ])("rejects %s", (_label, value) => {
    expect(safeAdminNextWorkQueueReturnTo(value, "TF-13")).toBeNull();
  });

  it("fails closed when constructing a workspace link from an unsafe return path", () => {
    expect(() =>
      adminNextPreviewCaseWorkspaceHref({
        caseReference: "TF-13",
        returnTo: "https://evil.example/steal",
      }),
    ).toThrow("return path is not allowed");
  });
});
