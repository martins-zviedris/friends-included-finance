import { NextRequest, NextResponse } from "next/server";
import { calculateCommission } from "@/lib/finance";
import { serverSupabase } from "@/lib/supabase";
import { expenseApprovalInput, saleApprovalInput } from "@/lib/validation";
import { syncTransaction } from "@/lib/workflows";

export async function POST(request: NextRequest, context: { params: Promise<{ type: string; reference: string }> }) {
  const { type, reference } = await context.params;
  const body = await request.json();
  const db = serverSupabase();
  if (type === "sale") {
    const parsed = saleApprovalInput.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Only Svetlana can approve a valid commission split." }, { status: 403 });
    const { data: existing, error } = await db.from("sales").select("*").eq("reference", reference).single();
    if (error || !existing) return NextResponse.json({ error: "Sale not found." }, { status: 404 });
    if (existing.status === "APPROVED") return NextResponse.json({ error: "This sale is already approved." }, { status: 409 });
    let notificationChatId = existing.origin_chat_id as string | null;
    if (!notificationChatId && existing.origin === "WEB") {
      const { data: employee } = await db.from("employees").select("linked_chat_id").eq("key", existing.salesperson_key).single();
      notificationChatId = employee?.linked_chat_id ?? null;
    }
    const result = calculateCommission(Number(existing.amount_cents), parsed.data.split);
    const { error: updateError } = await db.from("sales").update({
      status: "APPROVED", approved_at: new Date().toISOString(), approved_richard: parsed.data.split.richard,
      approved_anastasia: parsed.data.split.anastasia, approved_jean_claude: parsed.data.split["jean-claude"],
      commission_pool_cents: result.poolCents, richard_commission_cents: result.commissions.richard,
      anastasia_commission_cents: result.commissions.anastasia, jean_claude_commission_cents: result.commissions["jean-claude"],
      origin_chat_id: notificationChatId, sheets_sync_status: "PENDING", notification_status: notificationChatId ? "PENDING" : "NOT_REQUIRED"
    }).eq("reference", reference).eq("status", "PENDING");
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  } else if (type === "expense") {
    const parsed = expenseApprovalInput.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Only Svetlana can allocate an expense." }, { status: 403 });
    const { data: existing, error } = await db.from("expenses").select("*").eq("reference", reference).single();
    if (error || !existing) return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    if (existing.status === "ALLOCATED") return NextResponse.json({ error: "This expense is already allocated." }, { status: 409 });
    let notificationChatId = existing.origin_chat_id as string | null;
    if (!notificationChatId && existing.origin === "WEB") {
      const { data: employee } = await db.from("employees").select("linked_chat_id").eq("key", existing.reporter_key).single();
      notificationChatId = employee?.linked_chat_id ?? null;
    }
    const { error: updateError } = await db.from("expenses").update({ status: "ALLOCATED", final_allocation: parsed.data.allocation,
      allocated_at: new Date().toISOString(), origin_chat_id: notificationChatId, sheets_sync_status: "PENDING", notification_status: notificationChatId ? "PENDING" : "NOT_REQUIRED"
    }).eq("reference", reference).eq("status", "AWAITING_ALLOCATION");
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  } else return NextResponse.json({ error: "Unknown transaction type." }, { status: 404 });
  await db.from("audit_log").insert({ actor_key: "svetlana", action: "APPROVED", transaction_type: type === "sale" ? "SALE" : "EXPENSE", reference });
  const warnings = await syncTransaction(type as "sale" | "expense", reference, false);
  return NextResponse.json({ ok: true, warnings });
}
