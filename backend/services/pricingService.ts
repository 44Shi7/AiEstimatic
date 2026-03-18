import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";

export interface PricingMatch {
  unitCost: number | null;
  labor: number | null;
  description: string;
}

function getFilenameForType(type: string): string {
  if (type === "Conest") return "Conest_DataBase.xlsx";
  if (type === "McCormic") return "McCormic_DataBase.xlsx";
  return "AccubidDevices_DataBase.xlsx";
}

export class DatabaseNotFoundError extends Error {
  constructor(public type: string) {
    super(`Database for ${type} not found`);
    this.name = "DatabaseNotFoundError";
  }
}

/** Normalize header text for matching */
function headerText(val: unknown): string {
  if (val == null) return "";
  const s = typeof val === "object" && "result" in (val as object)
    ? String((val as { result: unknown }).result)
    : String(val);
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Get string from cell (handles formula/richText) */
function cellString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && v !== null && "result" in (v as object))
    return String((v as { result: unknown }).result).trim();
  return String(v).trim();
}

/** Get numeric value from cell (handles formula result objects) */
function cellNumberOrNull(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "object" && v !== null) {
    const r = (v as { result?: unknown }).result;
    if (typeof r === "number" && !Number.isNaN(r)) return r;
    if (typeof r === "string") {
      const trimmed = r.trim();
      if (!trimmed) return null;
      const parsed = parseFloat(trimmed.replace(/,/g, ""));
      return Number.isNaN(parsed) ? null : parsed;
    }
  }
  const sRaw = String(v);
  const s = sRaw.trim();
  if (!s) return null;
  const parsed = parseFloat(s.replace(/,/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

/** Detect column indices from header row(s). Accubid uses row 5 with DESCRIPTION, UNIT COST, MATERIAL COST, LABOR. */
function detectColumns(worksheet: ExcelJS.Worksheet): {
  descCol: number;
  unitCostCol: number;
  materialCostCol: number;
  laborHoursCol: number;
  laborCostCol: number;
  dataStartRow: number;
} {
  const descKeywords = ["description", "desc", "item", "name", "title"];
  let descCol = 0;
  let unitCostCol = 0;
  let materialCostCol = 0;
  let laborHoursCol = 0;
  let laborCostCol = 0;
  let dataStartRow = 6;

  for (let r = 1; r <= 10; r++) {
    for (let c = 1; c <= 20; c++) {
      const val = headerText(worksheet.getCell(r, c).value);
      if (!val) continue;
      if (descKeywords.some((k) => val.includes(k))) descCol = c;
      if (val.includes("material") && val.includes("cost")) materialCostCol = c;
      else if (val.includes("unit") && val.includes("cost")) unitCostCol = c;

      if (val.includes("labor") && val.includes("cost")) laborCostCol = c;
      else if (val === "labor" || (val.includes("labor") && !val.includes("rate") && !val.includes("total"))) {
        laborHoursCol = laborHoursCol || c;
      }
    }
    if (descCol && (unitCostCol || materialCostCol || laborCostCol || laborHoursCol)) {
      dataStartRow = r + 1;
      break;
    }
  }
  return {
    descCol: descCol || 2,
    unitCostCol: unitCostCol || 7,
    materialCostCol: materialCostCol || 9,
    laborHoursCol: laborHoursCol || 11,
    laborCostCol: laborCostCol || 14,
    dataStartRow,
  };
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1);
}

export async function findPricing(
  type: string,
  item: string
): Promise<PricingMatch | null> {
  const filename = getFilenameForType(type);
  const filePath = path.join(process.cwd(), "pricedb", filename);

  if (!fs.existsSync(filePath)) {
    throw new DatabaseNotFoundError(type);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  let bestMatch: PricingMatch | null = null;
  let highestScore = 0;
  let highestMatches = 0;
  let highestNumericMatches = 0;

  const searchTokens = tokenize(item);
  if (searchTokens.length === 0) return null;
  const searchTokenSet = new Set(searchTokens);
  const searchNumericTokens = searchTokens.filter((t) => /\d/.test(t));

  for (const sheet of workbook.worksheets) {
    const { descCol, unitCostCol, materialCostCol, laborHoursCol, laborCostCol, dataStartRow } = detectColumns(sheet);

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber < dataStartRow) return;

      const description = cellString(row.getCell(descCol));
      if (!description) return;

      const unitFromUnitCost = cellNumberOrNull(row.getCell(unitCostCol));
      const unitFromMaterialCost = cellNumberOrNull(row.getCell(materialCostCol));
      const useUnitCost = unitFromUnitCost ?? unitFromMaterialCost;

      const laborFromCost = cellNumberOrNull(row.getCell(laborCostCol));
      const laborFromHours = cellNumberOrNull(row.getCell(laborHoursCol));
      const useLabor = laborFromCost ?? laborFromHours;

      const hasAnyPricing =
        (useUnitCost != null && useUnitCost > 0) || (useLabor != null && useLabor > 0);
      if (!hasAnyPricing) return;

      const descTokens = tokenize(description);
      if (descTokens.length === 0) return;
      const descTokenSet = new Set(descTokens);

      let matches = 0;
      searchTokenSet.forEach((t) => {
        if (descTokenSet.has(t)) matches++;
      });
      const numericMatches = searchNumericTokens.reduce(
        (acc, t) => acc + (descTokenSet.has(t) ? 1 : 0),
        0
      );

      const score = matches / searchTokens.length;
      if (
        score > highestScore ||
        (score === highestScore && (matches > highestMatches || numericMatches > highestNumericMatches))
      ) {
        highestScore = score;
        highestMatches = matches;
        highestNumericMatches = numericMatches;
        bestMatch = { unitCost: useUnitCost, labor: useLabor, description };
      }
    });
  }

  if (bestMatch && highestScore >= 0.25) {
    return bestMatch;
  }
  return null;
}
