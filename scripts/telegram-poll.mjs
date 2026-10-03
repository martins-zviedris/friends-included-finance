import fs from "node:fs";
import path from "node:path";

function readEnvFile() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

readEnvFile();
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const localWebhook = process.env.LOCAL_TELEGRAM_WEBHOOK ?? "http://localhost:3000/api/telegram/webhook";
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing from .env.local");

let offset = 0;
let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

console.log("Telegram polling is active. Press Ctrl+C to stop.");
while (!stopping) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offset, timeout: 25, allowed_updates: ["message"] })
    });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.description ?? "Telegram getUpdates failed");
    for (const update of payload.result) {
      offset = update.update_id + 1;
      const forwarded = await fetch(localWebhook, {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret ?? "" },
        body: JSON.stringify(update)
      });
      if (!forwarded.ok) console.error(`Local webhook returned ${forwarded.status}.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Polling error");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
