import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";
import { transactionInput } from "@/lib/validation";
import { syncTransaction } from "@/lib/workflows";

export async function POST(request: NextRequest) {
  const parsed = transactionInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid transaction." }, { status: 400 });
  const input = parsed.data;
  const db = serverSupabase();
  let notificationChatId = input.originChatId;
  if (input.origin === "WEB") {
    const { data: employee } = await db.from("employees").select("linked_chat_id").eq("key", input.actor).single();
    notificationChatId = employee?.linked_chat_id ?? null;
  }
  if (input.type === "sale") {
    const { error } = await db.from("sales").insert({
      reference: input.reference.toUpperCase(), salesperson_key: input.actor, customer: input.customer, project: input.project,
      description: input.description, amount_cents: input.amountCents, proposed_richard: input.proposedSplit.richard,
      proposed_anastasia: input.proposedSplit.anastasia, proposed_jean_claude: input.proposedSplit["jean-claude"],
      origin: input.origin, origin_chat_id: notificationChatId, notification_status: notificationChatId ? "PENDING" : "NOT_REQUIRED"
    });
    if (error) return NextResponse.json({ error: error.code === "23505" ? "This reference already exists." : error.message }, { status: 409 });
  } else {
    const overhead = input.proposedAllocation === "OVERHEAD";
    const { error } = await db.from("expenses").insert({
      reference: input.reference.toUpperCase(), reporter_key: input.actor, description: input.description, category: input.category,
      amount_cents: input.amountCents, proposed_allocation: input.proposedAllocation, final_allocation: overhead ? "OVERHEAD" : null,
      status: overhead ? "ALLOCATED" : "AWAITING_ALLOCATION", origin: input.origin, origin_chat_id: notificationChatId,
      notification_status: notificationChatId ? "PENDING" : "NOT_REQUIRED"
    });
    if (error) return NextResponse.json({ error: error.code === "23505" ? "This reference already exists." : error.message }, { status: 409 });
  }
  await db.from("audit_log").insert({ actor_key: input.actor, action: "SUBMITTED", transaction_type: input.type === "sale" ? "SALE" : "EXPENSE", reference: input.reference.toUpperCase() });
  const warnings = await syncTransaction(input.type, input.reference.toUpperCase(), true);
  return NextResponse.json({ ok: true, reference: input.reference.toUpperCase(), warnings }, { status: 201 });
}
