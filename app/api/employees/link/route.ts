import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverSupabase } from "@/lib/supabase";

const input = z.object({ actor: z.literal("svetlana"), employeeKey: z.enum(["richard", "anastasia", "jean-claude", "kevin"]), telegramUserId: z.string().trim().min(1), chatId: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Only Svetlana can link a Telegram account." }, { status: 403 });
  const db = serverSupabase();
  const { error: clearError } = await db.from("employees").update({ telegram_user_id: null, linked_chat_id: null }).eq("telegram_user_id", parsed.data.telegramUserId);
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
  const { error } = await db.from("employees").update({ telegram_user_id: parsed.data.telegramUserId, linked_chat_id: parsed.data.chatId }).eq("key", parsed.data.employeeKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from("audit_log").insert({ actor_key: "svetlana", action: "LINKED_TELEGRAM", transaction_type: "EMPLOYEE_LINK", reference: parsed.data.employeeKey, details: { telegramUserId: parsed.data.telegramUserId, chatId: parsed.data.chatId } });
  return NextResponse.json({ ok: true });
}
