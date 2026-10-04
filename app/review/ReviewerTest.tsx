"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { Sale } from "@/lib/types";

type Dashboard = { configured: boolean; sales: Sale[] };
type StepState = "READY" | "WORKING" | "DONE" | "ERROR";

function makeReference() {
  return `REVIEW-${Date.now().toString(36).toUpperCase()}`;
}

async function request(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "The live test request failed.");
  return result;
}

export default function ReviewerTest({ embedded = false }: { embedded?: boolean }) {
  const [reference, setReference] = useState("");
  const [linkState, setLinkState] = useState<StepState>("READY");
  const [submitState, setSubmitState] = useState<StepState>("READY");
  const [approvalState, setApprovalState] = useState<StepState>("READY");
  const [record, setRecord] = useState<Sale | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => setReference(makeReference()), []);

  async function refresh(target = reference) {
    if (!target) return;
    const response = await fetch("/api/dashboard?actor=svetlana", { cache: "no-store" });
    const dashboard = await response.json() as Dashboard;
    setRecord(dashboard.sales.find((sale) => sale.reference === target) ?? null);
  }

  async function linkTelegram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const telegramUserId = String(form.get("telegramUserId") ?? "").trim();
    const chatId = String(form.get("chatId") ?? "").trim() || telegramUserId;
    setLinkState("WORKING"); setMessage("");
    try {
      await request("/api/employees/link", { actor: "svetlana", employeeKey: "richard", telegramUserId, chatId });
      setLinkState("DONE"); setMessage("Richard is linked for this fictional test. The IDs are stored privately in Supabase.");
    } catch (error) { setLinkState("ERROR"); setMessage(error instanceof Error ? error.message : "Linking failed."); }
  }

  async function createSubmission() {
    setSubmitState("WORKING"); setMessage("");
    try {
      await request("/api/transactions", { type: "sale", actor: "richard", reference, customer: "Professor Test", project: "A", description: "Small fictional live-review booking", amountCents: 1000, proposedSplit: { richard: 50, anastasia: 25, "jean-claude": 25 }, origin: "WEB", originChatId: null });
      setSubmitState("DONE"); setMessage("€10.00 submission saved. Telegram receives the submission confirmation and Google Sheets receives the pending row.");
      await refresh(reference);
    } catch (error) { setSubmitState("ERROR"); setMessage(error instanceof Error ? error.message : "Submission failed."); }
  }

  async function approveCorrection() {
    setApprovalState("WORKING"); setMessage("");
    try {
      await request(`/api/approve/sale/${encodeURIComponent(reference)}`, { actor: "svetlana", split: { richard: 30, anastasia: 40, "jean-claude": 30 } });
      setApprovalState("DONE"); setMessage("Svetlana’s corrected 30/40/30 split is approved. The ledger is updated and Telegram receives the actual manager return message.");
      await refresh(reference);
    } catch (error) { setApprovalState("ERROR"); setMessage(error instanceof Error ? error.message : "Approval failed."); }
  }

  const configured = record !== null || submitState !== "READY";
  return <section id="review-test" className={`review-flow ${embedded ? "review-embedded" : ""}`}>
    {embedded && <div className="section-title"><div><p>One-link verification</p><h2>Professor live test</h2></div><span>Run the connected Telegram, Supabase, Google Sheets and manager-decision workflow without leaving this website.</span></div>}
    <div className="review-note"><strong>What this proves</strong><span>Telegram identity link → persistent Supabase submission → manager correction → Google Sheets update → Telegram return.</span></div>

    <article className="review-step">
      <div className="step-number">01</div>
      <div><h2>Start the real bot</h2><p>Open the bot, press <b>Start</b> or send <code>/start</code>. It replies with your Telegram user ID. In a private chat, the chat ID is the same number.</p><a className="action-link" href="https://t.me/FriendsIncludedDay4Bot" target="_blank" rel="noreferrer">Open Friends Included bot ↗</a></div>
    </article>

    <article className="review-step">
      <div className="step-number">02</div>
      <div><h2>Link the fictional Richard role</h2><p>No token, database key, or private deployment configuration is needed.</p><form className="review-form" onSubmit={linkTelegram}><label>Telegram user ID<input name="telegramUserId" inputMode="numeric" required placeholder="Number returned by /start"/></label><label>Telegram chat ID <span>(optional in a private chat)</span><input name="chatId" inputMode="numeric" placeholder="Defaults to the user ID"/></label><button disabled={linkState === "WORKING"}>{linkState === "WORKING" ? "Linking…" : linkState === "DONE" ? "Linked ✓" : "Link Richard"}</button></form></div>
    </article>

    <article className="review-step">
      <div className="step-number">03</div>
      <div><h2>Create a small persistent submission</h2><p>The test creates a €10.00 Project A sale with a unique reference and a proposed 50/25/25 commission split.</p><div className="test-reference"><span>Unique reference</span><b>{reference || "Generating…"}</b></div><button onClick={createSubmission} disabled={!reference || linkState !== "DONE" || submitState === "WORKING" || submitState === "DONE"}>{submitState === "WORKING" ? "Saving…" : submitState === "DONE" ? "Submission saved ✓" : "Save €10 test sale"}</button></div>
    </article>

    <article className="review-step">
      <div className="step-number">04</div>
      <div><h2>Apply the manager correction</h2><p>Svetlana changes the proposed 50/25/25 split to 30/40/30 and approves the sale. This triggers the actual Telegram return message.</p><button onClick={approveCorrection} disabled={submitState !== "DONE" || approvalState === "WORKING" || approvalState === "DONE"}>{approvalState === "WORKING" ? "Approving…" : approvalState === "DONE" ? "Correction approved ✓" : "Approve corrected 30/40/30 split"}</button></div>
    </article>

    {(message || record) && <aside className={`review-result ${message && (linkState === "ERROR" || submitState === "ERROR" || approvalState === "ERROR") ? "error" : ""}`} aria-live="polite"><h2>Live result</h2>{message && <p>{message}</p>}{record && <dl><div><dt>Reference</dt><dd>{record.reference}</dd></div><div><dt>Database status</dt><dd>{record.status}</dd></div><div><dt>Google Sheets</dt><dd>{record.syncStatus}</dd></div><div><dt>Telegram</dt><dd>{record.notificationStatus}</dd></div><div><dt>Proposed split</dt><dd>50 / 25 / 25</dd></div><div><dt>Manager decision</dt><dd>{record.approvedSplit ? `${record.approvedSplit.richard} / ${record.approvedSplit.anastasia} / ${record.approvedSplit["jean-claude"]}` : "Awaiting decision"}</dd></div></dl>}<button className="secondary" onClick={() => refresh()} disabled={!configured}>Refresh delivery status</button></aside>}

    <div className="review-links"><a href={process.env.NEXT_PUBLIC_GOOGLE_SHEETS_URL} target="_blank" rel="noreferrer">Open Viewer ledger ↗</a><Link href="/#records">Open website records →</Link></div>
  </section>;
}
