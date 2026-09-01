import { describe, expect, it } from "vitest";
import {
  adminNextTodayTasks,
  filterAdminNextTodayTasks,
  parseAdminNextTodayView,
} from "./today-fixture";

describe("Admin Next Today fixture", () => {
  it("accepts only known saved views", () => {
    expect(parseAdminNextTodayView("overdue")).toBe("overdue");
    expect(parseAdminNextTodayView("mine")).toBe("mine");
    expect(parseAdminNextTodayView("waiting")).toBe("waiting");
    expect(parseAdminNextTodayView("../../admin")).toBe("all");
    expect(parseAdminNextTodayView(["mine"])).toBe("all");
  });

  it("filters deterministic tasks without mutating the fixture", () => {
    expect(filterAdminNextTodayTasks(adminNextTodayTasks, "overdue")).toHaveLength(1);
    expect(filterAdminNextTodayTasks(adminNextTodayTasks, "mine")).toHaveLength(3);
    expect(filterAdminNextTodayTasks(adminNextTodayTasks, "waiting")).toHaveLength(1);
    expect(filterAdminNextTodayTasks(adminNextTodayTasks, "all")).toHaveLength(4);
    expect(adminNextTodayTasks).toHaveLength(4);
  });

  it("keeps every fixture action routed to a safe current workspace", () => {
    expect(
      adminNextTodayTasks.every(({ customer, href }) =>
        customer.startsWith("Demo · ") && href.startsWith("/admin-v2"),
      ),
    ).toBe(true);
  });
});
