import { NextRequest, NextResponse } from "next/server";
import { calculateSnapshot } from "@/lib/finance";
import { serverSupabase } from "@/lib/supabase";
import type { Expense, Sale } from "@/lib/types";

function mapSale(row: Record<string, unknown>): Sale {
  return {
    reference: String(row.reference), submittedAt: String(row.submitted_at), salesperson: row.salesperson_key as Sale["salesperson"],
    customer: String(row.customer), project: row.project as Sale["project"], description: String(row.description), amountCents: Number(row.amount_cents),
    proposedSplit: { richard: Number(row.proposed_richard), anastasia: Number(row.proposed_anastasia), "jean-claude": Number(row.proposed_jean_claude) },
    approvedSplit: row.approved_richard == null ? null : { richard: Number(row.approved_richard), anastasia: Number(row.approved_anastasia), "jean-claude": Number(row.approved_jean_claude) },
    commissionPoolCents: Number(row.commission_pool_cents), commissionCents: { richard: Number(row.richard_commission_cents), anastasia: Number(row.anastasia_commission_cents), "jean-claude": Number(row.jean_claude_commission_cents) },
    status: row.status as Sale["status"], origin: row.origin as Sale["origin"], originChatId: row.origin_chat_id as string | null,
    syncStatus: row.sheets_sync_status as Sale["syncStatus"], notificationStatus: row.notification_status as Sale["notificationStatus"]
  };
}

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    reference: String(row.reference), submittedAt: String(row.submitted_at), reporter: "kevin", description: String(row.description),
    category: row.category as Expense["category"], amountCents: Number(row.amount_cents), proposedAllocation: row.proposed_allocation as Expense["proposedAllocation"],
    finalAllocation: row.final_allocation as Expense["finalAllocation"], status: row.status as Expense["status"], origin: row.origin as Expense["origin"],
    originChatId: row.origin_chat_id as string | null, syncStatus: row.sheets_sync_status as Expense["syncStatus"], notificationStatus: row.notification_status as Expense["notificationStatus"]
  };
}

export async function GET(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ configured: false, sales: [], expenses: [], snapshot: calculateSnapshot([], []) });
  }
  const db = serverSupabase();
  const [{ data: saleRows, error: saleError }, { data: expenseRows, error: expenseError }] = await Promise.all([
    db.from("sales").select("*").order("submitted_at", { ascending: false }),
    db.from("expenses").select("*").order("submitted_at", { ascending: false })
  ]);
  if (saleError || expenseError) return NextResponse.json({ error: saleError?.message ?? expenseError?.message }, { status: 500 });
  const sales = (saleRows ?? []).map(mapSale);
  const expenses = (expenseRows ?? []).map(mapExpense);
  const actor = request.nextUrl.searchParams.get("actor") ?? "svetlana";
  if (!["svetlana", "richard", "anastasia", "jean-claude", "kevin"].includes(actor)) {
    return NextResponse.json({ error: "Unknown demonstration role." }, { status: 400 });
  }
  if (actor !== "svetlana") {
    return NextResponse.json({
      configured: true,
      sales: sales.filter((sale) => sale.salesperson === actor),
      expenses: expenses.filter((expense) => expense.reporter === actor),
      snapshot: calculateSnapshot([], [])
    });
  }
  return NextResponse.json({ configured: true, sales, expenses, snapshot: calculateSnapshot(sales, expenses) });
}
