import fs from "node:fs";
import { google } from "googleapis";

const credentialPath = process.argv[2];
const editorEmail = process.argv[3];
if (!credentialPath || !editorEmail) throw new Error("Usage: node scripts/create-google-sheet.mjs <credential-json> <editor-email>");

const credentials = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
const auth = new google.auth.GoogleAuth({ credentials, scopes: [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive"
] });
const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

const created = await sheets.spreadsheets.create({ requestBody: {
  properties: { title: "Friends Included Finance Records", locale: "en_GB", timeZone: "Europe/Riga" },
  sheets: [
    { properties: { title: "Sales", gridProperties: { rowCount: 1000, columnCount: 17, frozenRowCount: 1 } } },
    { properties: { title: "Expenses", gridProperties: { rowCount: 1000, columnCount: 9, frozenRowCount: 1 } } }
  ]
} });

const spreadsheetId = created.data.spreadsheetId;
if (!spreadsheetId) throw new Error("Google did not return a spreadsheet ID.");
const salesId = created.data.sheets?.find((sheet) => sheet.properties?.title === "Sales")?.properties?.sheetId;
const expensesId = created.data.sheets?.find((sheet) => sheet.properties?.title === "Expenses")?.properties?.sheetId;

const salesHeaders = ["Reference", "Submission time", "Salesperson", "Customer", "Project", "Description", "Amount EUR", "Proposed Richard %", "Proposed Anastasia %", "Proposed Jean-Claude %", "Approved Richard %", "Approved Anastasia %", "Approved Jean-Claude %", "Richard commission EUR", "Anastasia commission EUR", "Jean-Claude commission EUR", "Status"];
const expenseHeaders = ["Reference", "Submission time", "Reporter", "Description", "Category", "Amount EUR", "Proposed allocation", "Final allocation", "Status"];
await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: [
  { range: "Sales!A1:Q1", values: [salesHeaders] },
  { range: "Expenses!A1:I1", values: [expenseHeaders] }
] } });

const requests = [];
for (const [sheetId, columns] of [[salesId, 17], [expensesId, 9]]) {
  requests.push(
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columns }, cell: { userEnteredFormat: { backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 }, textFormat: { bold: true, foregroundColor: { red: 0, green: 0, blue: 0 } }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: "pixelSize" } },
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: columns } } } },
    { updateBorders: { range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: columns }, top: { style: "SOLID", color: { red: .85, green: .85, blue: .85 } }, bottom: { style: "SOLID", color: { red: .85, green: .85, blue: .85 } }, left: { style: "SOLID", color: { red: .85, green: .85, blue: .85 } }, right: { style: "SOLID", color: { red: .85, green: .85, blue: .85 } }, innerHorizontal: { style: "SOLID", color: { red: .9, green: .9, blue: .9 } }, innerVertical: { style: "SOLID", color: { red: .9, green: .9, blue: .9 } } } }
  );
}
requests.push(
  { updateDimensionProperties: { range: { sheetId: salesId, dimension: "COLUMNS", startIndex: 0, endIndex: 17 }, properties: { pixelSize: 130 }, fields: "pixelSize" } },
  { updateDimensionProperties: { range: { sheetId: salesId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: 320 }, fields: "pixelSize" } },
  { updateDimensionProperties: { range: { sheetId: expensesId, dimension: "COLUMNS", startIndex: 0, endIndex: 9 }, properties: { pixelSize: 145 }, fields: "pixelSize" } },
  { updateDimensionProperties: { range: { sheetId: expensesId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 }, properties: { pixelSize: 360 }, fields: "pixelSize" } },
  { repeatCell: { range: { sheetId: salesId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 6, endColumnIndex: 7 }, cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "€#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } },
  { repeatCell: { range: { sheetId: salesId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 13, endColumnIndex: 16 }, cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "€#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } },
  { repeatCell: { range: { sheetId: expensesId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 }, cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "€#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } }
);
await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

let shared = false;
try {
  await drive.permissions.create({ fileId: spreadsheetId, sendNotificationEmail: true, requestBody: { type: "user", role: "writer", emailAddress: editorEmail } });
  shared = true;
} catch (error) {
  console.error(`SHARE_ERROR=${error instanceof Error ? error.message : String(error)}`);
}

console.log(JSON.stringify({ spreadsheetId, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, clientEmail: credentials.client_email, shared }));
