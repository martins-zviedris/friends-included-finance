import { google } from "googleapis";
import fs from "node:fs";

function sheetsClient() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const credentialPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
  if ((!email || !privateKey) && credentialPath) {
    const credentials = JSON.parse(fs.readFileSync(credentialPath, "utf8")) as { client_email?: string; private_key?: string };
    email = credentials.client_email;
    privateKey = credentials.private_key;
  }
  if (!email || !privateKey) throw new Error("Google Sheets service account is not configured.");
  const auth = new google.auth.JWT({ email, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

export async function upsertSheetRow(tab: "Sales" | "Expenses", reference: string, values: (string | number)[]) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Google Sheets spreadsheet ID is not configured.");
  const sheets = sheetsClient();
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:A` });
  const rows = existing.data.values ?? [];
  const index = rows.findIndex((row) => row[0] === reference);
  const rowNumber = index >= 0 ? index + 1 : rows.length + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: `${tab}!A${rowNumber}`, valueInputOption: "RAW", requestBody: { values: [values] }
  });
}
