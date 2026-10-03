import { describe, expect, it } from "vitest";
import { calculateCommission, calculateSnapshot } from "./finance";
import type { Expense, Sale } from "./types";

describe("commission rules", () => {
  it("calculates the supplied example", () => {
    expect(calculateCommission(100000, { richard: 50, anastasia: 30, "jean-claude": 20 })).toEqual({
      poolCents: 10000,
      commissions: { richard: 5000, anastasia: 3000, "jean-claude": 2000 }
    });
  });

  it("rejects a split that does not total 100", () => {
    expect(() => calculateCommission(10000, { richard: 60, anastasia: 30, "jean-claude": 20 })).toThrow(/100%/);
  });

  it("gives a rounding remainder to the largest share", () => {
    const result = calculateCommission(101, { richard: 34, anastasia: 33, "jean-claude": 33 });
    expect(result.poolCents).toBe(10);
    expect(Object.values(result.commissions).reduce((a, b) => a + b, 0)).toBe(10);
    expect(result.commissions.richard).toBe(4);
  });
});

describe("financial totals", () => {
  it("matches Test 1 control totals", () => {
    const baseSale = { submittedAt: "", description: "", origin: "WEB", originChatId: null, syncStatus: "SYNCED", notificationStatus: "SENT", status: "APPROVED" } as const;
    const sales: Sale[] = [
      { ...baseSale, reference: "S01", salesperson: "richard", customer: "Olivia", project: "A", amountCents: 100000, proposedSplit: { richard: 50, anastasia: 30, "jean-claude": 20 }, approvedSplit: { richard: 50, anastasia: 30, "jean-claude": 20 }, commissionPoolCents: 10000, commissionCents: { richard: 5000, anastasia: 3000, "jean-claude": 2000 } },
      { ...baseSale, reference: "S02", salesperson: "anastasia", customer: "Daniel", project: "B", amountCents: 200000, proposedSplit: { richard: 0, anastasia: 50, "jean-claude": 50 }, approvedSplit: { richard: 20, anastasia: 40, "jean-claude": 40 }, commissionPoolCents: 20000, commissionCents: { richard: 4000, anastasia: 8000, "jean-claude": 8000 } }
    ];
    const baseExpense = { submittedAt: "", reporter: "kevin", category: "OTHER", origin: "WEB", originChatId: null, syncStatus: "SYNCED", notificationStatus: "SENT", status: "ALLOCATED" } as const;
    const expenses: Expense[] = [
      { ...baseExpense, reference: "E01", description: "Costumes", amountCents: 12000, proposedAllocation: "A", finalAllocation: "A" },
      { ...baseExpense, reference: "E02", description: "Taxi", amountCents: 8000, proposedAllocation: "B", finalAllocation: "A" },
      { ...baseExpense, reference: "E03", description: "Website", amountCents: 10000, proposedAllocation: "OVERHEAD", finalAllocation: "OVERHEAD", notificationStatus: "NOT_REQUIRED" }
    ];
    const result = calculateSnapshot(sales, expenses);
    expect(result.projects.A.resultCents).toBe(70000);
    expect(result.projects.B.resultCents).toBe(180000);
    expect(result.company.resultCents).toBe(240000);
    expect(result.commissions).toEqual({ richard: 9000, anastasia: 11000, "jean-claude": 10000 });
  });
});
