"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { employees } from "@/lib/employees";
import { euros } from "@/lib/finance";
import type { EmployeeKey, Expense, FinanceSnapshot, Sale } from "@/lib/types";

type DashboardData = { configured: boolean; sales: Sale[]; expenses: Expense[]; snapshot: FinanceSnapshot; error?: string };
const emptySnapshot: FinanceSnapshot = { projects: { A: { incomeCents: 0, commissionCents: 0, expensesCents: 0, resultCents: 0 }, B: { incomeCents: 0, commissionCents: 0, expensesCents: 0, resultCents: 0 } }, company: { incomeCents: 0, commissionCents: 0, recordedExpensesCents: 0, overheadCents: 0, awaitingAllocationCents: 0, resultCents: 0 }, commissions: { richard: 0, anastasia: 0, "jean-claude": 0 } };
const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/martins-zviedris/friends-included-finance";

export default function FinanceApp() {
  const [role, setRole] = useState<EmployeeKey>("svetlana");
  const [data, setData] = useState<DashboardData>({ configured: false, sales: [], expenses: [], snapshot: emptySnapshot });
  const [notice, setNotice] = useState("");
  const current = useMemo(() => employees.find((item) => item.key === role)!, [role]);
  const load = useCallback(async () => { try { const response = await fetch(`/api/dashboard?actor=${encodeURIComponent(role)}`, { cache: "no-store" }); setData(await response.json()); } catch { setNotice("Could not load the dashboard."); } }, [role]);
  useEffect(() => { void load(); }, [load]);
  const visibleSales = data.sales;
  const visibleExpenses = data.expenses;

  async function submit(path: string, body: unknown) {
    setNotice("");
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Request failed.");
    setNotice(result.warnings?.length ? `Saved. ${result.warnings.join(" ")}` : "Saved successfully.");
    await load();
  }

  return <main>
    <header className="hero">
      <div><p className="eyebrow">Friends Included Ltd</p><h1>Wedding operations<br/><span>without the guesswork.</span></h1><p className="lede">One controlled record from staff submission to manager decision, financial result, and notification.</p></div>
      <div className="identity"><span>Prepared by</span><strong>Mārtiņš Evarts Zviedris</strong><label>Demonstration role<select value={role} onChange={(event) => setRole(event.target.value as EmployeeKey)}>{employees.map((employee) => <option key={employee.key} value={employee.key}>{employee.name}</option>)}</select></label><small>{current.role.replaceAll("_", " ")}</small></div>
    </header>
    {!data.configured && <div className="setup"><strong>Local build ready</strong><span>Connect Supabase with environment variables to enable persistent transactions.</span></div>}
    {notice && <div className="notice">{notice}</div>}
    <nav className="jump">{role === "svetlana" && <a href="#overview">Overview</a>}<a href="#entry">New entry</a>{role === "svetlana" && <a href="#decisions">Decisions</a>}<a href="#records">Records</a><a href="#instructions">Instructions</a><a href="/review">Professor test</a></nav>
    {role === "svetlana" && <section id="overview" className="section"><SectionTitle kicker="Live position" title="Finance overview" detail="Only approved sales count as income. Every recorded expense affects the company immediately."/>
      <div className="metric-grid"><Metric label="Company result" value={euros(data.snapshot.company.resultCents)} accent/><Metric label="Approved income" value={euros(data.snapshot.company.incomeCents)}/><Metric label="Commission expense" value={euros(data.snapshot.company.commissionCents)}/><Metric label="Company overhead" value={euros(data.snapshot.company.overheadCents)}/><Metric label="Awaiting allocation" value={euros(data.snapshot.company.awaitingAllocationCents)}/></div>
      <div className="project-grid">{(["A", "B"] as const).map((key) => <article className="project-card" key={key}><div><span>Project {key}</span><h3>{key === "A" ? "Respectable Relatives" : "Drunk University Friends"}</h3></div><strong>{euros(data.snapshot.projects[key].resultCents)}</strong><dl><div><dt>Income</dt><dd>{euros(data.snapshot.projects[key].incomeCents)}</dd></div><div><dt>Commission</dt><dd>{euros(data.snapshot.projects[key].commissionCents)}</dd></div><div><dt>Expenses</dt><dd>{euros(data.snapshot.projects[key].expensesCents)}</dd></div></dl></article>)}</div>
      <div className="commission-strip"><span>Commission earned</span><b>Richard {euros(data.snapshot.commissions.richard)}</b><b>Anastasia {euros(data.snapshot.commissions.anastasia)}</b><b>Jean-Claude {euros(data.snapshot.commissions["jean-claude"])}</b></div>
    </section>}
    <section id="entry" className="section"><SectionTitle kicker="Staff desk" title="Record a transaction" detail="The selected role determines which action the server will accept."/>
      {(["richard", "anastasia", "jean-claude"] as EmployeeKey[]).includes(role) && <SaleForm role={role} disabled={!data.configured} onSubmit={submit}/>}
      {role === "kevin" && <ExpenseForm disabled={!data.configured} onSubmit={submit}/>}
      {role === "svetlana" && <ManagerSetup disabled={!data.configured} onSubmit={submit}/>}
    </section>
    {role === "svetlana" && <section id="decisions" className="section"><SectionTitle kicker="Manager queue" title="Decisions requiring attention" detail="Original proposals remain visible beside the final decision."/>
      <div className="queue"><h3>Pending sales</h3>{data.sales.filter((sale) => sale.status === "PENDING").map((sale) => <SaleDecision sale={sale} key={sale.reference} disabled={!data.configured} submit={submit}/>)}{!data.sales.some((sale) => sale.status === "PENDING") && <Empty text="No sales are awaiting approval."/>}</div>
      <div className="queue"><h3>Expenses awaiting allocation</h3>{data.expenses.filter((expense) => expense.status === "AWAITING_ALLOCATION").map((expense) => <ExpenseDecision expense={expense} key={expense.reference} disabled={!data.configured} submit={submit}/>)}{!data.expenses.some((expense) => expense.status === "AWAITING_ALLOCATION") && <Empty text="No expenses are awaiting allocation."/>}</div>
    </section>}
    <section id="records" className="section"><SectionTitle kicker="Audit trail" title="Transaction records" detail={role === "svetlana" ? "Manager view includes every record." : "Your view includes only your own submissions and statuses."}/><RecordTable sales={visibleSales} expenses={visibleExpenses} retry={submit}/></section>
    <section id="instructions" className="section"><SectionTitle kicker="Quick guide" title="How to use this system" detail="Website and Telegram submissions follow the same validation and financial rules."/>
      <ol className="instructions">
        <li><b>Select a demonstration role.</b><span>Richard, Anastasia, and Jean-Claude enter sales. Kevin enters expenses. Svetlana manages Telegram links and decisions.</span></li>
        <li><b>Enter a transaction.</b><span>Complete every field and use a unique reference. Sales commission percentages must total 100%.</span></li>
        <li><b>Approve or correct a decision.</b><span>As Svetlana, review the original proposal in the decision queue, make any correction, and approve it.</span></li>
        <li><b>Check delivery.</b><span>The records table shows Google Sheets synchronization and Telegram notification status. Failed deliveries provide a retry.</span></li>
      </ol>
    </section>
    <footer><strong>Friends Included Finance</strong><span><a href="/review">Professor live test</a> · <a href="https://t.me/FriendsIncludedDay4Bot" target="_blank" rel="noreferrer">Telegram bot</a> · Supabase · {process.env.NEXT_PUBLIC_GOOGLE_SHEETS_URL ? <a href={process.env.NEXT_PUBLIC_GOOGLE_SHEETS_URL} target="_blank" rel="noreferrer">Google Sheets</a> : "Google Sheets"} · <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a> · Vercel</span></footer>
  </main>;
}

function SectionTitle({ kicker, title, detail }: { kicker: string; title: string; detail: string }) { return <div className="section-title"><div><p>{kicker}</p><h2>{title}</h2></div><span>{detail}</span></div>; }
function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <article className={`metric ${accent ? "accent" : ""}`}><span>{label}</span><strong>{value}</strong></article>; }
function Empty({ text }: { text: string }) { return <p className="empty">{text}</p>; }

function SaleForm({ role, disabled, onSubmit }: { role: EmployeeKey; disabled: boolean; onSubmit: (path: string, body: unknown) => Promise<void> }) {
  async function handle(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); await onSubmit("/api/transactions", { type: "sale", actor: role, reference: f.get("reference"), customer: f.get("customer"), project: f.get("project"), description: f.get("description"), amountCents: Math.round(Number(f.get("amount")) * 100), proposedSplit: { richard: Number(f.get("richard")), anastasia: Number(f.get("anastasia")), "jean-claude": Number(f.get("jeanClaude")) }, origin: "WEB", originChatId: null }).then(() => event.currentTarget.reset()).catch((e) => alert(e.message)); }
  return <form className="form" onSubmit={handle}><div className="field-row"><Field name="reference" label="Reference" placeholder="S01"/><Field name="customer" label="Customer" placeholder="Olivia Rose"/><label>Project<select name="project"><option>A</option><option>B</option></select></label><Field name="amount" label="Amount €" type="number" step="0.01" min="0.01"/></div><label>Description<textarea name="description" required rows={3}/></label><fieldset><legend>Proposed commission split</legend><div className="field-row"><Field name="richard" label="Richard %" type="number" min="0" max="100"/><Field name="anastasia" label="Anastasia %" type="number" min="0" max="100"/><Field name="jeanClaude" label="Jean-Claude %" type="number" min="0" max="100"/></div></fieldset><button disabled={disabled}>Submit sale</button></form>;
}

function ExpenseForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (path: string, body: unknown) => Promise<void> }) { async function handle(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); await onSubmit("/api/transactions", { type: "expense", actor: "kevin", reference: f.get("reference"), description: f.get("description"), category: f.get("category"), amountCents: Math.round(Number(f.get("amount")) * 100), proposedAllocation: f.get("allocation"), origin: "WEB", originChatId: null }).then(() => event.currentTarget.reset()).catch((e) => alert(e.message)); } return <form className="form" onSubmit={handle}><div className="field-row"><Field name="reference" label="Reference" placeholder="E01"/><label>Category<select name="category"><option value="MATERIALS">Materials</option><option value="TRAVEL">Travel</option><option value="OTHER">Other</option></select></label><Field name="amount" label="Amount €" type="number" step="0.01" min="0.01"/><label>Proposed allocation<select name="allocation"><option value="A">Project A</option><option value="B">Project B</option><option value="OVERHEAD">Company overhead</option></select></label></div><label>Description<textarea name="description" required rows={3}/></label><button disabled={disabled}>Submit expense</button></form>; }

function ManagerSetup({ disabled, onSubmit }: { disabled: boolean; onSubmit: (path: string, body: unknown) => Promise<void> }) { async function handle(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); await onSubmit("/api/employees/link", { actor: "svetlana", employeeKey: f.get("employeeKey"), telegramUserId: f.get("telegramUserId"), chatId: f.get("chatId") }).catch((e) => alert(e.message)); } return <form className="form" onSubmit={handle}><h3>Telegram employee link</h3><p>Only the manager can connect a Telegram identity to a fictional employee.</p><div className="field-row"><label>Employee<select name="employeeKey">{employees.filter((e) => e.key !== "svetlana").map((e) => <option value={e.key} key={e.key}>{e.name}</option>)}</select></label><Field name="telegramUserId" label="Telegram user ID"/><Field name="chatId" label="Telegram chat ID"/></div><button disabled={disabled}>Save link</button></form>; }

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { const { label, ...input } = props; return <label>{label}<input {...input} required/></label>; }

function SaleDecision({ sale, disabled, submit }: { sale: Sale; disabled: boolean; submit: (path: string, body: unknown) => Promise<void> }) { const [split, setSplit] = useState(sale.proposedSplit); return <article className="decision"><div><b>{sale.reference}</b><span>{sale.customer} · Project {sale.project} · {euros(sale.amountCents)}</span><small>{sale.description}</small></div><div className="split"><label>R<input type="number" value={split.richard} onChange={(e) => setSplit({ ...split, richard: Number(e.target.value) })}/></label><label>A<input type="number" value={split.anastasia} onChange={(e) => setSplit({ ...split, anastasia: Number(e.target.value) })}/></label><label>J-C<input type="number" value={split["jean-claude"]} onChange={(e) => setSplit({ ...split, "jean-claude": Number(e.target.value) })}/></label></div><button disabled={disabled} onClick={() => submit(`/api/approve/sale/${sale.reference}`, { actor: "svetlana", split }).catch((e) => alert(e.message))}>Approve sale</button></article>; }
function ExpenseDecision({ expense, disabled, submit }: { expense: Expense; disabled: boolean; submit: (path: string, body: unknown) => Promise<void> }) { const [allocation, setAllocation] = useState(expense.proposedAllocation); return <article className="decision"><div><b>{expense.reference}</b><span>{euros(expense.amountCents)} · Proposed {expense.proposedAllocation}</span><small>{expense.description}</small></div><select value={allocation} onChange={(e) => setAllocation(e.target.value as Expense["proposedAllocation"])}><option value="A">Project A</option><option value="B">Project B</option><option value="OVERHEAD">Overhead</option></select><button disabled={disabled} onClick={() => submit(`/api/approve/expense/${expense.reference}`, { actor: "svetlana", allocation }).catch((e) => alert(e.message))}>Confirm allocation</button></article>; }

function RecordTable({ sales, expenses, retry }: { sales: Sale[]; expenses: Expense[]; retry: (path: string, body: unknown) => Promise<void> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = [
    ...sales.map((sale) => ({ type: "Sale" as const, ref: sale.reference, person: sale.salesperson, amount: sale.amountCents, status: sale.status, sync: sale.syncStatus, notification: sale.notificationStatus, record: sale })),
    ...expenses.map((expense) => ({ type: "Expense" as const, ref: expense.reference, person: expense.reporter, amount: expense.amountCents, status: expense.status, sync: expense.syncStatus, notification: expense.notificationStatus, record: expense }))
  ];
  return <div className="table-wrap"><table><thead><tr><th>Type</th><th>Reference</th><th>Submitted by</th><th>Amount</th><th>Status</th><th>Sheets</th><th>Telegram</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((row) => {
    const key = `${row.type}-${row.ref}`;
    const isOpen = expanded === key;
    return <Fragment key={key}><tr className="record-row" aria-expanded={isOpen} tabIndex={0} onClick={() => setExpanded(isOpen ? null : key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpanded(isOpen ? null : key); } }}><td>{row.type}</td><td><b>{row.ref}</b></td><td>{row.person}</td><td>{euros(row.amount)}</td><td><Status value={row.status}/></td><td><Status value={row.sync}/></td><td>{row.notification === "NOT_REQUIRED" ? <span className="recipient-missing">No Telegram recipient linked</span> : <Status value={row.notification}/>}</td><td className="row-actions"><span className="expand-indicator" aria-hidden="true">{isOpen ? "−" : "+"}</span>{(row.sync === "FAILED" || row.notification === "FAILED") && <button className="small" onClick={(event) => { event.stopPropagation(); retry(`/api/retry/${row.type.toLowerCase()}/${row.ref}`, {}).catch((e) => alert(e.message)); }}>Retry</button>}</td></tr>{isOpen && <tr className="record-detail"><td colSpan={8}>{row.type === "Sale" ? <SaleDetails sale={row.record as Sale}/> : <ExpenseDetails expense={row.record as Expense}/>}</td></tr>}</Fragment>;
  })}</tbody></table>{rows.length === 0 && <Empty text="No records to show yet."/>}</div>;
}

function SaleDetails({ sale }: { sale: Sale }) { return <div className="detail-grid"><Detail label="Submitted" value={new Date(sale.submittedAt).toLocaleString()}/><Detail label="Customer" value={sale.customer}/><Detail label="Project" value={`Project ${sale.project}`}/><Detail label="Origin" value={sale.origin}/><Detail label="Description" value={sale.description} wide/><Detail label="Proposed split" value={`${sale.proposedSplit.richard}% / ${sale.proposedSplit.anastasia}% / ${sale.proposedSplit["jean-claude"]}%`}/><Detail label="Approved split" value={sale.approvedSplit ? `${sale.approvedSplit.richard}% / ${sale.approvedSplit.anastasia}% / ${sale.approvedSplit["jean-claude"]}%` : "Not approved"}/><Detail label="Commission pool" value={euros(sale.commissionPoolCents)}/><Detail label="Earned commissions" value={`Richard ${euros(sale.commissionCents.richard)} · Anastasia ${euros(sale.commissionCents.anastasia)} · Jean-Claude ${euros(sale.commissionCents["jean-claude"])}`} wide/></div>; }
function ExpenseDetails({ expense }: { expense: Expense }) { return <div className="detail-grid"><Detail label="Submitted" value={new Date(expense.submittedAt).toLocaleString()}/><Detail label="Category" value={expense.category}/><Detail label="Origin" value={expense.origin}/><Detail label="Description" value={expense.description} wide/><Detail label="Proposed allocation" value={expense.proposedAllocation}/><Detail label="Final allocation" value={expense.finalAllocation ?? "Awaiting manager decision"}/></div>; }
function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? "detail-wide" : ""}><span>{label}</span><b>{value}</b></div>; }
function Status({ value }: { value: string }) { return <span className={`status status-${value.toLowerCase()}`}>{value.replaceAll("_", " ")}</span>; }
