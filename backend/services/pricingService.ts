import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";

export interface PricingMatch {
  unitCost: number;
  labor: number;
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

  workbook.worksheets.forEach((worksheet) => {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 5) return;

      const description = row.getCell(2).value?.toString() || "";
      const unitCost = parseFloat(row.getCell(7).value?.toString() || "0");
      const laborRate = parseFloat(row.getCell(11).value?.toString() || "0");

      if (description && unitCost > 0) {
        const searchWords = item.toLowerCase().split(/\s+/);
        const descLower = description.toLowerCase();
        let matches = 0;
        searchWords.forEach((word: string) => {
          if (descLower.includes(word)) matches++;
        });

        const score = matches / searchWords.length;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = { unitCost, labor: laborRate, description };
        }
      }
    });
  });

  if (bestMatch && highestScore > 0.5) {
    return bestMatch;
  }
  return null;
}
