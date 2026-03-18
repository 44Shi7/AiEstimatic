/**
 * Inspect Accubid Excel structure - run from backend: node scripts/inspect-accubid.cjs
 */
const path = require("path");
const ExcelJS = require("exceljs");

const filePath = path.join(__dirname, "..", "pricedb", "AccubidDevices_DataBase.xlsx");

function cellStr(cell) {
  const val = cell.value;
  if (val == null) return "";
  if (typeof val === "object" && val.result !== undefined) return String(val.result);
  if (typeof val === "object" && val.value !== undefined) return String(val.value);
  return String(val).slice(0, 40);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log("Sheets:", wb.worksheets.map((s) => s.name));
  const breakerSheet = wb.worksheets.find((s) => s.name.toLowerCase().includes("breaker"));
  if (breakerSheet) {
    console.log("\n--- Breakers sheet first 12 rows, cols 1-15 ---");
    for (let r = 1; r <= 12; r++) {
      const row = [];
      for (let c = 1; c <= 15; c++) row.push(cellStr(breakerSheet.getCell(r, c)));
      console.log("Row", r, row);
    }
  }
  for (let si = 0; si < Math.min(wb.worksheets.length, 5); si++) {
    const sheet = wb.worksheets[si];
    console.log("\n=== Sheet:", sheet.name, "rows:", sheet.rowCount, "===");
    for (let r = 1; r <= Math.min(6, sheet.rowCount || 6); r++) {
      const row = [];
      for (let c = 1; c <= 15; c++) {
        row.push(cellStr(sheet.getCell(r, c)));
      }
      console.log("Row", r, row);
    }
    if (sheet.rowCount > 10) {
      console.log("... sample row 10:", [...Array(15)].map((_, c) => cellStr(sheet.getCell(10, c + 1))));
    }
  }
}

main().catch(console.error);
