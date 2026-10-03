import { euros } from "./finance";
import { upsertSheetRow } from "./google-sheets";
import { serverSupabase } from "./supabase";
import { sendTelegram } from "./telegram";

export async function syncTransaction(type: "sale" | "expense", reference: string, initial: boolean) {
  const db = serverSupabase();
  const table = type === "sale" ? "sales" : "expenses";
  const { data: row, error } = await db.from(table).select("*").eq("reference", reference).single();
  if (error || !row) return ["The record was saved but could not be reloaded for integration updates."];
  const warnings: string[] = [];
  try {
    const values = type === "sale"
      ? [row.reference, row.submitted_at, row.salesperson_key, row.customer, row.project, row.description, row.amount_cents / 100,
        row.proposed_richard, row.proposed_anastasia, row.proposed_jean_claude, row.approved_richard ?? "", row.approved_anastasia ?? "", row.approved_jean_claude ?? "",
        row.richard_commission_cents / 100, row.anastasia_commission_cents / 100, row.jean_claude_commission_cents / 100, row.status]
      : [row.reference, row.submitted_at, row.reporter_key, row.description, row.category, row.amount_cents / 100, row.proposed_allocation, row.final_allocation ?? "", row.status];
    await upsertSheetRow(type === "sale" ? "Sales" : "Expenses", reference, values);
    await db.from(table).update({ sheets_sync_status: "SYNCED", sheets_sync_error: null }).eq("reference", reference);
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "Unknown Sheets error";
    await db.from(table).update({ sheets_sync_status: "FAILED", sheets_sync_error: message }).eq("reference", reference);
    warnings.push("Google Sheets sync failed. The saved record can be retried.");
  }
  if (row.origin_chat_id && row.notification_status !== "SENT") {
    try {
      let text: string;
      if (initial || row.status === "PENDING" || row.status === "AWAITING_ALLOCATION") text = `${reference} recorded. ${euros(Number(row.amount_cents))}. Status: ${row.status}.`;
      else if (type === "sale") {
        const changed = row.proposed_richard !== row.approved_richard || row.proposed_anastasia !== row.approved_anastasia || row.proposed_jean_claude !== row.approved_jean_claude;
        text = `${reference} approved${changed ? " — commission split changed" : ""}. Sale ${euros(Number(row.amount_cents))}; total commission ${euros(Number(row.commission_pool_cents))}. Richard: ${row.proposed_richard}% → ${row.approved_richard}% (${euros(Number(row.richard_commission_cents))}). Anastasia: ${row.proposed_anastasia}% → ${row.approved_anastasia}% (${euros(Number(row.anastasia_commission_cents))}). Jean-Claude: ${row.proposed_jean_claude}% → ${row.approved_jean_claude}% (${euros(Number(row.jean_claude_commission_cents))}).`;
      } else {
        const changed = row.proposed_allocation !== row.final_allocation;
        text = `${reference} allocation ${changed ? "changed" : "confirmed"}. ${euros(Number(row.amount_cents))}: ${row.description}. Proposed: ${row.proposed_allocation}. Approved: ${row.final_allocation}.`;
      }
      await sendTelegram(String(row.origin_chat_id), text);
      await db.from(table).update({ notification_status: "SENT", notification_error: null }).eq("reference", reference);
    } catch (notificationError) {
      const message = notificationError instanceof Error ? notificationError.message : "Unknown Telegram error";
      await db.from(table).update({ notification_status: "FAILED", notification_error: message }).eq("reference", reference);
      warnings.push("Telegram notification failed. The financial record remains saved.");
    }
  }
  return warnings;
}
