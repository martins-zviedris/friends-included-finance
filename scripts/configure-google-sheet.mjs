import fs from "node:fs";
import { google } from "googleapis";

const [credentialPath, spreadsheetId] = process.argv.slice(2);
if (!credentialPath || !spreadsheetId) throw new Error("Usage: node scripts/configure-google-sheet.mjs <credential-json> <spreadsheet-id>");
const credentials = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });

let metadata = (await sheets.spreadsheets.get({ spreadsheetId })).data;
const firstSheet = metadata.sheets?.[0];
if (!firstSheet?.properties?.sheetId && firstSheet?.properties?.sheetId !== 0) throw new Error("The spreadsheet has no sheet.");
const requests = [];
let salesId = metadata.sheets?.find((sheet) => sheet.properties?.title === "Sales")?.properties?.sheetId;
let expensesId = metadata.sheets?.find((sheet) => sheet.properties?.title === "Expenses")?.properties?.sheetId;
if (salesId == null) {
  salesId = firstSheet.properties.sheetId;
  requests.push({ updateSheetProperties: { properties: { sheetId: salesId, title: "Sales", gridProperties: { frozenRowCount: 1 } }, fields: "title,gridProperties.frozenRowCount" } });
}
if (expensesId == null) requests.push({ addSheet: { properties: { title: "Expenses", gridProperties: { rowCount: 1000, columnCount: 9, frozenRowCount: 1 } } } });
if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
metadata = (await sheets.spreadsheets.get({ spreadsheetId })).data;
salesId = metadata.sheets?.find((sheet) => sheet.properties?.title === "Sales")?.properties?.sheetId;
expensesId = metadata.sheets?.find((sheet) => sheet.properties?.title === "Expenses")?.properties?.sheetId;
if (salesId == null || expensesId == null) throw new Error("Could not resolve Sales and Expenses sheets.");

const salesHeaders = ["Reference", "Submission time", "Salesperson", "Customer", "Project", "Description", "Amount EUR", "Proposed Richard %", "Proposed Anastasia %", "Proposed Jean-Claude %", "Approved Richard %", "Approved Anastasia %", "Approved Jean-Claude %", "Richard commission EUR", "Anastasia commission EUR", "Jean-Claude commission EUR", "Status"];
const expenseHeaders = ["Reference", "Submission time", "Reporter", "Description", "Category", "Amount EUR", "Proposed allocation", "Final allocation", "Status"];
await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data: [
  { range: "Sales!A1:Q1", values: [salesHeaders] },
  { range: "Expenses!A1:I1", values: [expenseHeaders] }
] } });

const style = [];
for (const [sheetId, columns] of [[salesId, 17], [expensesId, 9]]) style.push(
  { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
  { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columns }, cell: { userEnteredFormat: { backgroundColor: { red: .93, green: .93, blue: .93 }, textFormat: { bold: true, foregroundColor: { red: 0, green: 0, blue: 0 } }, verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } }, fields: "userEnteredFormat" } },
  { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 46 }, fields: "pixelSize" } },
  { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: columns } } } }
);
style.push(
  { updateDimensionProperties: { range: { sheetId: salesId, dimension: "COLUMNS", startIndex: 0, endIndex: 17 }, properties: { pixelSize: 130 }, fields: "pixelSize" } },
  { updateDimensionProperties: { range: { sheetId: salesId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: 320 }, fields: "pixelSize" } },
  { updateDimensionProperties: { range: { sheetId: expensesId, dimension: "COLUMNS", startIndex: 0, endIndex: 9 }, properties: { pixelSize: 145 }, fields: "pixelSize" } },
  { updateDimensionProperties: { range: { sheetId: expensesId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 }, properties: { pixelSize: 360 }, fields: "pixelSize" } },
  { repeatCell: { range: { sheetId: salesId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 6, endColumnIndex: 7 }, cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "€#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } },
  { repeatCell: { range: { sheetId: salesId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 13, endColumnIndex: 16 }, cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "€#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } },
  { repeatCell: { range: { sheetId: expensesId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 }, cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "€#,##0.00" } } }, fields: "userEnteredFormat.numberFormat" } }
);
await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: style } });
console.log(JSON.stringify({ spreadsheetId, title: metadata.properties?.title, tabs: ["Sales", "Expenses"], clientEmail: credentials.client_email }));
