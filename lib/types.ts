export type EmployeeKey = "svetlana" | "richard" | "anastasia" | "jean-claude" | "kevin";
export type SalespersonKey = "richard" | "anastasia" | "jean-claude";
export type ProjectKey = "A" | "B";
export type Allocation = ProjectKey | "OVERHEAD";
export type SaleStatus = "PENDING" | "APPROVED";
export type ExpenseStatus = "AWAITING_ALLOCATION" | "ALLOCATED";
export type DeliveryStatus = "NOT_REQUIRED" | "PENDING" | "SENT" | "FAILED";
export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";

export interface CommissionSplit {
  richard: number;
  anastasia: number;
  "jean-claude": number;
}

export interface Employee {
  key: EmployeeKey;
  name: string;
  role: "MANAGER" | "SALESPERSON" | "EXPENSE_REPORTER";
}

export interface Sale {
  reference: string;
  submittedAt: string;
  salesperson: SalespersonKey;
  customer: string;
  project: ProjectKey;
  description: string;
  amountCents: number;
  proposedSplit: CommissionSplit;
  approvedSplit: CommissionSplit | null;
  commissionCents: CommissionSplit;
  commissionPoolCents: number;
  status: SaleStatus;
  origin: "WEB" | "TELEGRAM";
  originChatId: string | null;
  syncStatus: SyncStatus;
  notificationStatus: DeliveryStatus;
}

export interface Expense {
  reference: string;
  submittedAt: string;
  reporter: "kevin";
  description: string;
  category: "MATERIALS" | "TRAVEL" | "OTHER";
  amountCents: number;
  proposedAllocation: Allocation;
  finalAllocation: Allocation | null;
  status: ExpenseStatus;
  origin: "WEB" | "TELEGRAM";
  originChatId: string | null;
  syncStatus: SyncStatus;
  notificationStatus: DeliveryStatus;
}

export interface FinanceSnapshot {
  projects: Record<ProjectKey, {
    incomeCents: number;
    commissionCents: number;
    expensesCents: number;
    resultCents: number;
  }>;
  company: {
    incomeCents: number;
    commissionCents: number;
    recordedExpensesCents: number;
    overheadCents: number;
    awaitingAllocationCents: number;
    resultCents: number;
  };
  commissions: Record<SalespersonKey, number>;
}
