/**
 * Creates minimal Excel files in pricedb/ so the pricing API does not return
 * "Database for Accubid not found" on Vercel. Run: node scripts/seed-pricedb.cjs
 * Columns: B=description, G=unitCost, K=labor (row 6+ used by pricingService).
 */
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const ROOT = path.join(__dirname, "..");
const PRICEDB = path.join(ROOT, "pricedb");

const FILES = [
  { filename: "AccubidDevices_DataBase.xlsx", type: "Accubid", rows: [
    { description: "Device outlet", unitCost: 25, labor: 0.5 },
    { description: "Wire cable", unitCost: 2.5, labor: 0.25 },
    { description: "Conduit", unitCost: 15, labor: 0.3 },
  ]},
  { filename: "Conest_DataBase.xlsx", type: "Conest", rows: [
    { description: "Device outlet", unitCost: 24, labor: 0.5 },
    { description: "Wire cable", unitCost: 2.4, labor: 0.25 },
  ]},
  { filename: "McCormic_DataBase.xlsx", type: "McCormic", rows: [
    { description: "Device outlet", unitCost: 26, labor: 0.5 },
    { description: "Wire cable", unitCost: 2.6, labor: 0.25 },
  ]},
];

if (!fs.existsSync(PRICEDB)) {
  fs.mkdirSync(PRICEDB, { recursive: true });
}

async function writeOne({ filename, type, rows }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Pricing", { properties: { defaultRowHeight: 18 } });
  // Rows 1-5 skipped by pricingService; data from row 6+
  ws.getCell(1, 2).value = "Pricing database";
  ws.getCell(5, 2).value = "Description";
  ws.getCell(5, 7).value = "Unit Cost";
  ws.getCell(5, 11).value = "Labor";
  rows.forEach((row, i) => {
    const r = 6 + i;
    ws.getCell(r, 2).value = row.description;
    ws.getCell(r, 7).value = row.unitCost;
    ws.getCell(r, 11).value = row.labor;
  });
  const filePath = path.join(PRICEDB, filename);
  await wb.xlsx.writeFile(filePath);
  console.log("Written:", filePath);
}

(async () => {
  for (const spec of FILES) {
    await writeOne(spec);
  }
  console.log("Done. pricedb/ is ready.");
})();
