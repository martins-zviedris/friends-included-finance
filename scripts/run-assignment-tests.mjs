const base = "http://localhost:3000";
const report = [];

async function request(path, body, expected = [200, 201]) {
  const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!expected.includes(response.status)) throw new Error(`${path}: expected ${expected.join("/")}, got ${response.status}: ${result.error ?? "unknown error"}`);
  return { status: response.status, result };
}

async function dashboard() { return (await request("/api/dashboard")).result; }
async function createIfMissing(type, reference, body) {
  const data = await dashboard();
  const collection = type === "sale" ? data.sales : data.expenses;
  if (!collection.some((item) => item.reference === reference)) await request("/api/transactions", body, [201]);
}
async function approveIfPending(type, reference, body) {
  const data = await dashboard();
  const collection = type === "sale" ? data.sales : data.expenses;
  const item = collection.find((row) => row.reference === reference);
  const pending = type === "sale" ? item?.status === "PENDING" : item?.status === "AWAITING_ALLOCATION";
  if (pending) await request(`/api/approve/${type}/${reference}`, body);
}
function assert(label, condition, details = "") {
  if (!condition) throw new Error(`${label} failed${details ? `: ${details}` : ""}`);
  report.push({ test: label, result: "PASS" });
}

// Complete Test 1.
await createIfMissing("sale", "S02", { type: "sale", reference: "S02", actor: "anastasia", customer: "Daniel King", project: "B", description: "University friends, dancing, and the stripping performance", amountCents: 200000, proposedSplit: { richard: 0, anastasia: 50, "jean-claude": 50 }, origin: "WEB", originChatId: null });
await createIfMissing("expense", "E02", { type: "expense", reference: "E02", actor: "kevin", description: "Taxi for the grandmother; Kevin selected the wrong project", category: "TRAVEL", amountCents: 8000, proposedAllocation: "B", origin: "WEB", originChatId: null });
await createIfMissing("expense", "E03", { type: "expense", reference: "E03", actor: "kevin", description: "Monthly company website subscription", category: "OTHER", amountCents: 10000, proposedAllocation: "OVERHEAD", origin: "WEB", originChatId: null });
let d = await dashboard();
const completedDataset = d.snapshot.company.resultCents === 393000
  && d.sales.find((row) => row.reference === "S05")?.status === "PENDING"
  && d.expenses.find((row) => row.reference === "E07")?.status === "AWAITING_ALLOCATION";
if (completedDataset) report.push({ test: "Completed Test 2 dataset detected", result: "PASS" });
else assert("Test 1 pre-decision company result", d.snapshot.company.resultCents === -30000, String(d.snapshot.company.resultCents));
await approveIfPending("sale", "S01", { actor: "svetlana", split: { richard: 50, anastasia: 30, "jean-claude": 20 } });
await approveIfPending("sale", "S02", { actor: "svetlana", split: { richard: 20, anastasia: 40, "jean-claude": 40 } });
await approveIfPending("expense", "E01", { actor: "svetlana", allocation: "A" });
await approveIfPending("expense", "E02", { actor: "svetlana", allocation: "A" });
d = await dashboard();
if (!completedDataset) {
  assert("Test 1 Project A result", d.snapshot.projects.A.resultCents === 70000, String(d.snapshot.projects.A.resultCents));
  assert("Test 1 Project B result", d.snapshot.projects.B.resultCents === 180000, String(d.snapshot.projects.B.resultCents));
  assert("Test 1 company result", d.snapshot.company.resultCents === 240000, String(d.snapshot.company.resultCents));
  assert("Test 1 commissions", d.snapshot.commissions.richard === 9000 && d.snapshot.commissions.anastasia === 11000 && d.snapshot.commissions["jean-claude"] === 10000, JSON.stringify(d.snapshot.commissions));
}

// Add Test 2 entries.
await createIfMissing("sale", "S03", { type: "sale", reference: "S03", actor: "jean-claude", customer: "Emma Stonebridge", project: "A", description: "Premium relatives, including an uncle presented as a surgeon", amountCents: 150000, proposedSplit: { richard: 40, anastasia: 40, "jean-claude": 20 }, origin: "WEB", originChatId: null });
await createIfMissing("sale", "S04", { type: "sale", reference: "S04", actor: "richard", customer: "Lucas Green", project: "B", description: "Small group of loud university friends", amountCents: 80000, proposedSplit: { richard: 25, anastasia: 25, "jean-claude": 50 }, origin: "WEB", originChatId: null });
await createIfMissing("sale", "S05", { type: "sale", reference: "S05", actor: "richard", customer: "Mia Brooks", project: "B", description: "Extra guests and an embarrassing speech", amountCents: 60000, proposedSplit: { richard: 100, anastasia: 0, "jean-claude": 0 }, origin: "WEB", originChatId: null });
await createIfMissing("expense", "E04", { type: "expense", reference: "E04", actor: "kevin", description: "Replacement costumes after an enthusiastic dance performance", category: "MATERIALS", amountCents: 25000, proposedAllocation: "B", origin: "WEB", originChatId: null });
await createIfMissing("expense", "E05", { type: "expense", reference: "E05", actor: "kevin", description: "Minibus for university friends; Kevin selected the wrong project again", category: "TRAVEL", amountCents: 9000, proposedAllocation: "A", origin: "WEB", originChatId: null });
await createIfMissing("expense", "E06", { type: "expense", reference: "E06", actor: "kevin", description: "Company telephone subscription", category: "OTHER", amountCents: 6000, proposedAllocation: "OVERHEAD", origin: "WEB", originChatId: null });
await createIfMissing("expense", "E07", { type: "expense", reference: "E07", actor: "kevin", description: "Emergency replacement clothing; project allocation still needs checking", category: "MATERIALS", amountCents: 14000, proposedAllocation: "A", origin: "WEB", originChatId: null });

// Link Jean-Claude for S03 decision, then Kevin for E04/E05 decisions.
await request("/api/employees/link", { actor: "svetlana", employeeKey: "jean-claude", telegramUserId: "8519628459", chatId: "8519628459" });
await approveIfPending("sale", "S03", { actor: "svetlana", split: { richard: 20, anastasia: 30, "jean-claude": 50 } });
await approveIfPending("sale", "S04", { actor: "svetlana", split: { richard: 25, anastasia: 25, "jean-claude": 50 } });
await request("/api/employees/link", { actor: "svetlana", employeeKey: "kevin", telegramUserId: "8519628459", chatId: "8519628459" });
await approveIfPending("expense", "E04", { actor: "svetlana", allocation: "B" });
await approveIfPending("expense", "E05", { actor: "svetlana", allocation: "B" });

d = await dashboard();
assert("Test 2 Project A result", d.snapshot.projects.A.resultCents === 205000, String(d.snapshot.projects.A.resultCents));
assert("Test 2 Project B result", d.snapshot.projects.B.resultCents === 218000, String(d.snapshot.projects.B.resultCents));
assert("Test 2 company result", d.snapshot.company.resultCents === 393000, String(d.snapshot.company.resultCents));
assert("Test 2 commissions", d.snapshot.commissions.richard === 14000 && d.snapshot.commissions.anastasia === 17500 && d.snapshot.commissions["jean-claude"] === 21500, JSON.stringify(d.snapshot.commissions));
assert("S05 remains pending", d.sales.find((row) => row.reference === "S05")?.status === "PENDING");
assert("E07 remains awaiting allocation", d.expenses.find((row) => row.reference === "E07")?.status === "AWAITING_ALLOCATION");

// Permission and validation failures.
const before = JSON.stringify(d.snapshot);
assert("Reject split totaling 110%", (await request("/api/transactions", { type: "sale", reference: "BAD-SPLIT", actor: "richard", customer: "Test", project: "A", description: "Invalid", amountCents: 10000, proposedSplit: { richard: 60, anastasia: 30, "jean-claude": 20 }, origin: "WEB", originChatId: null }, [400])).status === 400);
assert("Deny Richard approval", (await request("/api/approve/sale/S05", { actor: "richard", split: { richard: 100, anastasia: 0, "jean-claude": 0 } }, [403])).status === 403);
assert("Deny Kevin sale", (await request("/api/transactions", { type: "sale", reference: "BAD-ROLE", actor: "kevin", customer: "Test", project: "A", description: "Invalid", amountCents: 10000, proposedSplit: { richard: 100, anastasia: 0, "jean-claude": 0 }, origin: "WEB", originChatId: null }, [400])).status === 400);
assert("Reject zero expense", (await request("/api/transactions", { type: "expense", reference: "BAD-ZERO", actor: "kevin", description: "Invalid", category: "OTHER", amountCents: 0, proposedAllocation: "A", origin: "WEB", originChatId: null }, [400])).status === 400);
assert("Reject duplicate reference", (await request("/api/transactions", { type: "sale", reference: "S01", actor: "richard", customer: "Duplicate", project: "A", description: "Duplicate", amountCents: 10000, proposedSplit: { richard: 100, anastasia: 0, "jean-claude": 0 }, origin: "WEB", originChatId: null }, [409])).status === 409);
assert("Reject repeated approval", (await request("/api/approve/sale/S01", { actor: "svetlana", split: { richard: 50, anastasia: 30, "jean-claude": 20 } }, [409])).status === 409);
d = await dashboard();
assert("Denied actions leave totals unchanged", JSON.stringify(d.snapshot) === before);
assert("All Sheets synchronizations succeeded", [...d.sales, ...d.expenses].every((row) => row.syncStatus === "SYNCED"));

console.log(JSON.stringify({ passed: report.length, report, final: d.snapshot }, null, 2));
