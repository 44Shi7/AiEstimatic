import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const PRICEDB_DIR = "pricedb";

function getFilenameForType(type: string): string {
  if (type === "Conest") return "Conest_DataBase.xlsx";
  if (type === "McCormic") return "McCormic_DataBase.xlsx";
  return "AccubidDevices_DataBase.xlsx";
}

export interface DbStatsResult {
  exists: boolean;
  size?: number;
  lastModified?: Date;
  name?: string;
}

export function getDbStats(type: string): DbStatsResult {
  const filename = getFilenameForType(type);
  const serviceDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.join(process.cwd(), PRICEDB_DIR, filename),
    path.join(serviceDir, "..", PRICEDB_DIR, filename),
    path.join("/var/task", PRICEDB_DIR, filename),
  ];

  const filePath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  try {
    if (filePath) {
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        size: stats.size,
        lastModified: stats.mtime,
        name: filename,
      };
    }
    return { exists: false };
  } catch {
    throw new Error("Failed to fetch DB stats");
  }
}
