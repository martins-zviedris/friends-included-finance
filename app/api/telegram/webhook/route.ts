import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";
import { syncTransaction } from "@/lib/workflows";

type TelegramUpdate = { message?: { text?: string; from?: { id?: number }; chat?: { id?: number } } };

export async function POST(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && request.headers.get("x-telegram-bot-api-secret-token") !== expected) return new NextResponse("Forbidden", { status: 403 });
  const update = await request.json() as TelegramUpdate;
  const message = update.message;
  const chatId = message?.chat?.id?.toString();
  const userId = message?.from?.id?.toString();
  const text = message?.text?.trim() ?? "";
  if (!chatId || !userId) return NextResponse.json({ ok: true });
  if (text === "/start" || text === "/help") {
    await sendTelegram(chatId, `Your Telegram user ID is ${userId}. Ask Svetlana to link it in Manager setup.\n\nSales format:\n/sale REF | Customer | A or B | Description | Amount | Richard/Anastasia/Jean-Claude percentages\n\nExpense format:\n/expense REF | Description | Materials/Travel/Other | Amount | A/B/Overhead`);
    return NextResponse.json({ ok: true });
  }
  const db = serverSupabase();
  const { data: employee } = await db.from("employees").select("*").eq("telegram_user_id", userId).single();
  if (!employee) {
    await sendTelegram(chatId, `You are not linked to an employee. Your Telegram user ID is ${userId}.`);
    return NextResponse.json({ ok: true });
  }
  try {
    const parts = text.split("|").map((part) => part.trim());
    if (text.startsWith("/sale") && employee.role === "SALESPERSON" && parts.length === 6) {
      const [command, customer, project, description, amount, splitText] = parts;
      const reference = command.replace(/^\/sale\s+/i, "").toUpperCase();
      const split = splitText.split("/").map(Number);
      if (!(["A", "B"] as string[]).includes(project) || split.length !== 3 || split.reduce((a, b) => a + b, 0) !== 100) throw new Error("Project must be A or B and the three commission shares must total 100%.");
      const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
      if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Amount must be greater than zero.");
      const { error } = await db.from("sales").insert({ reference, salesperson_key: employee.key, customer, project, description, amount_cents: amountCents,
        proposed_richard: split[0], proposed_anastasia: split[1], proposed_jean_claude: split[2], origin: "TELEGRAM", origin_chat_id: chatId, notification_status: "PENDING" });
      if (error) throw new Error(error.code === "23505" ? "That reference already exists." : error.message);
      await db.from("audit_log").insert({ actor_key: employee.key, action: "SUBMITTED", transaction_type: "SALE", reference });
      await syncTransaction("sale", reference, true);
    } else if (text.startsWith("/expense") && employee.key === "kevin" && parts.length === 5) {
      const [command, description, categoryText, amount, allocationText] = parts;
      const reference = command.replace(/^\/expense\s+/i, "").toUpperCase();
      const category = categoryText.toUpperCase();
      const allocation = allocationText.toUpperCase() === "OVERHEAD" ? "OVERHEAD" : allocationText.toUpperCase();
      if (!(["MATERIALS", "TRAVEL", "OTHER"] as string[]).includes(category) || !(["A", "B", "OVERHEAD"] as string[]).includes(allocation)) throw new Error("Use a valid category and A, B, or Overhead allocation.");
      const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
      if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Amount must be greater than zero.");
      const overhead = allocation === "OVERHEAD";
      const { error } = await db.from("expenses").insert({ reference, reporter_key: "kevin", description, category, amount_cents: amountCents, proposed_allocation: allocation,
        final_allocation: overhead ? "OVERHEAD" : null, status: overhead ? "ALLOCATED" : "AWAITING_ALLOCATION", origin: "TELEGRAM", origin_chat_id: chatId, notification_status: "PENDING" });
      if (error) throw new Error(error.code === "23505" ? "That reference already exists." : error.message);
      await db.from("audit_log").insert({ actor_key: "kevin", action: "SUBMITTED", transaction_type: "EXPENSE", reference });
      await syncTransaction("expense", reference, true);
    } else throw new Error("That command is not permitted for your linked role or the format is incomplete. Send /help for examples.");
  } catch (error) {
    await sendTelegram(chatId, `Not recorded: ${error instanceof Error ? error.message : "Invalid submission."}`);
  }
  return NextResponse.json({ ok: true });
}
