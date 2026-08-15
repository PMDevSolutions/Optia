import { describe, it, expect } from "vitest";
import { PLANS, quotaResetLabel } from "@/lib/plans";

describe("plans", () => {
  it("offers a monthly and an annual plan with visible prices", () => {
    const ids = PLANS.map((p) => p.id);
    expect(ids).toEqual(["monthly", "annual"]);
    for (const plan of PLANS) {
      expect(plan.priceId).toBeTruthy();
      expect(plan.amountLabel).toMatch(/^\$\d+$/);
    }
  });

  it("labels the reset as the first of the next month", () => {
    expect(quotaResetLabel(new Date(2026, 7, 15))).toBe(
      new Date(2026, 8, 1).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    );
  });

  it("rolls over the year boundary", () => {
    expect(quotaResetLabel(new Date(2026, 11, 31))).toBe(
      new Date(2027, 0, 1).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    );
  });
});
