import { NextResponse } from "next/server";
import { syncTransaction } from "@/lib/workflows";

export async function POST(_: Request, context: { params: Promise<{ type: string; reference: string }> }) {
  const { type, reference } = await context.params;
  if (!(["sale", "expense"] as string[]).includes(type)) return NextResponse.json({ error: "Unknown type." }, { status: 404 });
  const warnings = await syncTransaction(type as "sale" | "expense", reference, false);
  return NextResponse.json({ ok: warnings.length === 0, warnings });
}
