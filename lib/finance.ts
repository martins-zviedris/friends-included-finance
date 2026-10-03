import type { CommissionSplit, Expense, FinanceSnapshot, Sale, SalespersonKey } from "./types";

export const salespeople: SalespersonKey[] = ["richard", "anastasia", "jean-claude"];

export function assertValidSplit(split: CommissionSplit): void {
  for (const value of Object.values(split)) {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new Error("Each commission share must be a whole percentage from 0 to 100.");
    }
  }
  if (salespeople.reduce((sum, person) => sum + split[person], 0) !== 100) {
    throw new Error("Commission shares must total 100%.");
  }
}

export function calculateCommission(amountCents: number, split: CommissionSplit) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Amount must be greater than zero.");
  assertValidSplit(split);
  const poolCents = Math.round(amountCents * 0.1);
  const commissions: CommissionSplit = {
    richard: Math.round(poolCents * split.richard / 100),
    anastasia: Math.round(poolCents * split.anastasia / 100),
    "jean-claude": Math.round(poolCents * split["jean-claude"] / 100)
  };
  const difference = poolCents - salespeople.reduce((sum, person) => sum + commissions[person], 0);
  if (difference !== 0) {
    const recipient = [...salespeople].sort((a, b) => split[b] - split[a] || salespeople.indexOf(a) - salespeople.indexOf(b))[0];
    commissions[recipient] += difference;
  }
  return { poolCents, commissions };
}

export function calculateSnapshot(sales: Sale[], expenses: Expense[]): FinanceSnapshot {
  const snapshot: FinanceSnapshot = {
    projects: {
      A: { incomeCents: 0, commissionCents: 0, expensesCents: 0, resultCents: 0 },
      B: { incomeCents: 0, commissionCents: 0, expensesCents: 0, resultCents: 0 }
    },
    company: { incomeCents: 0, commissionCents: 0, recordedExpensesCents: 0, overheadCents: 0, awaitingAllocationCents: 0, resultCents: 0 },
    commissions: { richard: 0, anastasia: 0, "jean-claude": 0 }
  };

  for (const sale of sales) {
    if (sale.status !== "APPROVED") continue;
    snapshot.projects[sale.project].incomeCents += sale.amountCents;
    snapshot.projects[sale.project].commissionCents += sale.commissionPoolCents;
    snapshot.company.incomeCents += sale.amountCents;
    snapshot.company.commissionCents += sale.commissionPoolCents;
    for (const person of salespeople) snapshot.commissions[person] += sale.commissionCents[person];
  }

  for (const expense of expenses) {
    snapshot.company.recordedExpensesCents += expense.amountCents;
    if (expense.status === "AWAITING_ALLOCATION") snapshot.company.awaitingAllocationCents += expense.amountCents;
    if (expense.finalAllocation === "OVERHEAD") snapshot.company.overheadCents += expense.amountCents;
    if (expense.finalAllocation === "A" || expense.finalAllocation === "B") {
      snapshot.projects[expense.finalAllocation].expensesCents += expense.amountCents;
    }
  }

  for (const project of ["A", "B"] as const) {
    const item = snapshot.projects[project];
    item.resultCents = item.incomeCents - item.commissionCents - item.expensesCents;
  }
  snapshot.company.resultCents = snapshot.company.incomeCents - snapshot.company.commissionCents - snapshot.company.recordedExpensesCents;
  return snapshot;
}

export function euros(cents: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}
