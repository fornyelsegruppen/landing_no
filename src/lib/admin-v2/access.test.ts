import { describe, expect, it } from "vitest";
import { adminAccessDecision } from "./access";

describe("admin v2 access", () => {
  it("allows only administrators", () => {
    expect(adminAccessDecision({ role: "admin" })).toBe("allow");
    expect(adminAccessDecision({ role: "worker" })).toBe("worker-portal");
    expect(adminAccessDecision(null)).toBe("login");
  });
});
