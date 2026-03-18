import { GoogleGenAI, Type } from "@google/genai";
import ExcelJS from "exceljs";
import { PlanSwiftItem, AggregatedItem, ClassificationMode, SystemMapping, SectionRule } from "../types";


export const SYSTEM_MAPPING: Record<string, string> = {
  DEM: "DEMOLITION",
  REP: "DEMOLITION",
  REL: "DEMOLITION",
  PNL: "DISTRIBUTION",
  B: "DISTRIBUTION",
  DIST: "DISTRIBUTION",
  DISC: "DISTRIBUTION",
  G: "DISTRIBUTION",
  GW: "DISTRIBUTION",
  LUGS: "DISTRIBUTION",
  DW: "DISTRIBUTION",
  DISTELBOW: "DISTRIBUTION",
  DB: "DISTRIBUTION",
  P: "RECEPTACLES & SWITCHES",
  PWB: "RECEPTACLES & SWITCHES",
  PWH: "RECEPTACLES & SWITCHES",
  SL: "SITE LIGHTING",
  SLWB: "SITE LIGHTING",
  SLWH: "SITE LIGHTING",
  LF: "LIGHTING",
  LC: "LIGHTING",
  LWB: "LIGHTING",
  LWH: "LIGHTING",
  FA: "FIRE ALARM",
  FAW: "FIRE ALARM",
  LV: "LOW VOLTAGE",
  LVW: "LOW VOLTAGE",
  LVELB: "LOW VOLTAGE",
  TEL: "TELECOMMUNICATION",
  TL: "TELECOMMUNICATION",
  TELEW: "TELECOMMUNICATION",
  TELEELB: "TELECOMMUNICATION",
  AV: "AUDIO & VISUAL",
  AVW: "AUDIO & VISUAL",
  AVELB: "AUDIO & VISUAL",
  SEC: "SECURITY",
  S: "SECURITY",
  SECW: "SECURITY",
  SECELB: "SECURITY",
  NCS: "NURSE CALL SYSTEM",
  NCSW: "NURSE CALL SYSTEM",
  NCSELB: "NURSE CALL SYSTEM",
  MISC: "MISCELLANEOUS",
  "SAW CUT": "SAW CUT",
  TRENCHING: "TRENCHING & BACKFILLING",
  PANELS: "DISTRIBUTION",
  PANEL: "DISTRIBUTION",
  SWITCHBOARD: "DISTRIBUTION",
  DS: "DISTRIBUTION",
  
};

export const SECTION_RULES = [
  { keywords: ["CONDUIT", "EMT", "PVC", "FMC", "RMC", "IMC"], section: "CONDUITS", unit: "FT" },
  { keywords: ["WIRE", "CU", "AL", "THHN", "THWN", "KCMIL"], section: "CONDUCTORS", unit: "FT" },
  { keywords: ["LUG", "TERMINATION", "HEAT SHRINK", "COMPRESSION"], section: "TERMINATIONS", unit: "EA" },
  { keywords: ["BREAKER", "MCB"], section: "CIRCUIT BREAKERS", unit: "EA" },
  { keywords: ["PANEL", "PANELBOARD"], section: "PANELS", unit: "EA" },
  { keywords: ["DISCONNECT", "SAFETY SWITCH"], section: "DISCONNECT SWITCH", unit: "EA" },
  { keywords: ["TRANSFORMER", "XFMR"], section: "DEVICES", unit: "EA" },
  { keywords: ["GENERATOR"], section: "DEVICES", unit: "EA" },
  { keywords: ["SWITCHGEAR", "SWITCHBOARD"], section: "DEVICES", unit: "EA" },
  { keywords: ["GROUND", "GROUND ROD", "GROUNDING"], section: "GROUNDING", unit: "EA" },
  { keywords: ["DEVICE", "SUPPORT", "BRACKET"], section: "DEVICES", unit: "EA" }
];

export function ruleBasedClassify(
  item: string, 
  customSystemMapping?: SystemMapping, 
  customSectionRules?: SectionRule[]
): { system: string; format: string; unit: string; cleanItem: string } {
  const lowerItem = item.toLowerCase();
  let cleanItem = item;
  let system = "OTHER";
  let format = "OTHER";
  let unit = "EA";

  const mapping = customSystemMapping || SYSTEM_MAPPING;
  const rules = customSectionRules || SECTION_RULES;

  // 1. Detect and remove tag for system mapping
  const tags = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    const prefixes = [lowerTag + ":", lowerTag + " ", lowerTag + "-"];
    for (const p of prefixes) {
      if (lowerItem.startsWith(p)) {
        system = mapping[tag];
        cleanItem = item.substring(p.length).trim();
        break;
      }
    }
    if (system !== "OTHER") break;
  }

  // 2. Refine format and unit based on SECTION_RULES
  const upperClean = cleanItem.toUpperCase();
  for (const rule of rules) {
    if (rule.keywords.some(k => upperClean.includes(k))) {
      format = rule.section;
      unit = rule.unit;
      break;
    }
  }

  return { system, format, unit, cleanItem };
}

export async function aiClassify(
  items: string[], 
  customSystemMapping?: SystemMapping
): Promise<Record<string, { system: string; format: string; unit: string; cleanItem: string }>> {
  if (items.length === 0) return {};

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const mapping = customSystemMapping || SYSTEM_MAPPING;
  const systems = Array.from(new Set(Object.values(mapping))).join(", ");
  
  // Batch processing to avoid token limits and improve reliability
  const batchSize = 40;
  const resultMapping: Record<string, { system: string; format: string; unit: string; cleanItem: string }> = {};

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const generateWithRetry = async (retries = 2, delay = 1000): Promise<any> => {
      try {
        return await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Classify the following electrical items into one of these systems: ${systems}, OTHER.
          Also provide a standardized 'format' name for each item based on common electrical estimating categories (e.g., CONDUITS, CONDUCTORS, TERMINATIONS, CIRCUIT BREAKERS, PANELS, DEVICES).
          
          CRITICAL RULES:
          1. Remove any leading tags like 'DS:', 'LC:', 'TL:', 'S:' from the item name.
          2. The 'system' and 'format' MUST be in ALL CAPS.
          3. If an item contains 'conduit', its format must be 'CONDUITS'.
          4. If an item contains '#', 'CU', 'AL', or 'wire', its format must be 'CONDUCTORS'.
          5. If an item contains 'lugs' or 'tubing', its format must be 'TERMINATIONS'.
          
          Items: ${batch.join(", ")}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                classifications: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      item: { type: Type.STRING, description: "Original item name" },
                      cleanItem: { type: Type.STRING, description: "Item name without tag" },
                      system: { type: Type.STRING },
                      format: { type: Type.STRING },
                      unit: { type: Type.STRING, description: "EA or FT" },
                    },
                    required: ["item", "cleanItem", "system", "format", "unit"],
                  },
                },
              },
            },
          },
        });
      } catch (err: any) {
        if (retries > 0 && (err.message?.includes("503") || err.message?.includes("high demand"))) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return generateWithRetry(retries - 1, delay * 2);
        }
        throw err;
      }
    };

    try {
      const response = await generateWithRetry();

      let text = response.text || "{}";
      // Clean markdown backticks if present
      if (text.startsWith("```json")) {
        text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (text.startsWith("```")) {
        text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }

      const data = JSON.parse(text);
      data.classifications?.forEach((c: any) => {
        resultMapping[c.item] = { system: c.system, format: c.format, unit: c.unit, cleanItem: c.cleanItem };
      });
    } catch (err) {
      console.error(`AI Classification failed for batch ${i / batchSize}:`, err);
      // Fallback to rule-based for this batch
      batch.forEach(item => {
        const fallback = ruleBasedClassify(item, mapping);
        resultMapping[item] = fallback;
      });
    }
  }
  
  return resultMapping;
}

export async function readPlanSwiftFile(file: File): Promise<PlanSwiftItem[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  const items: PlanSwiftItem[] = [];

  // Assuming headers are in row 1: Item, Qty
  let itemCol = -1;
  let qtyCol = -1;

  worksheet.getRow(1).eachCell((cell, colNumber) => {
    const val = cell.value?.toString().toLowerCase();
    if (val === "item") itemCol = colNumber;
    if (val === "qty" || val === "quantity") qtyCol = colNumber;
  });

  if (itemCol === -1 || qtyCol === -1) {
    // Fallback to columns 1 and 2 if headers not found
    itemCol = 1;
    qtyCol = 2;
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item = row.getCell(itemCol).value?.toString() || "";
    const qty = parseFloat(row.getCell(qtyCol).value?.toString() || "0");
    if (item) {
      items.push({ Item: item, Qty: qty });
    }
  });

  return items;
}

export function aggregateItems(
  items: PlanSwiftItem[], 
  mode: ClassificationMode, 
  aiMapping?: Record<string, any>,
  customSystemMapping?: SystemMapping,
  customSectionRules?: SectionRule[]
): AggregatedItem[] {
  const summary: Record<string, Record<string, { qty: number; unit: string; cleanItem: string }>> = {};

  items.forEach((item) => {
    let system = "OTHER";
    let format = "OTHER";
    let unit = "EA";
    let cleanItem = item.Item;

    if (mode === 'AI_POWERED' && aiMapping && aiMapping[item.Item]) {
      const m = aiMapping[item.Item];
      system = m.system;
      format = m.format;
      unit = m.unit;
      cleanItem = m.cleanItem;
    } else {
      const m = ruleBasedClassify(item.Item, customSystemMapping, customSectionRules);
      system = m.system;
      format = m.format;
      unit = m.unit;
      cleanItem = m.cleanItem;
    }

    const key = `${system}|${format}`;
    if (!summary[key]) summary[key] = {};
    if (!summary[key][cleanItem]) summary[key][cleanItem] = { qty: 0, unit, cleanItem };
    summary[key][cleanItem].qty += item.Qty;
  });

  const result: AggregatedItem[] = [];
  Object.keys(summary).forEach((key) => {
    const [system, format] = key.split('|');
    Object.keys(summary[key]).forEach((cleanItem) => {
      const data = summary[key][cleanItem];
      result.push({
        System: system,
        Format: format,
        Item: data.cleanItem,
        Qty: data.qty,
        OriginalQty: data.qty,
        Unit: data.unit,
        unitCost: null,
        labor: null
      });
    });
  });

  return result;
}

export async function fillTemplate(
  templateFile: File,
  summary: AggregatedItem[],
  projectDetails?: {
    projectId: string;
    projectName: string;
    address: string;
    rev: string;
    clientName: string;
    clientId: string;
    date: string;
  }
): Promise<Blob> {
  if (!templateFile.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Please use a .xlsx file. Legacy .xls files are not supported.');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await templateFile.arrayBuffer());
  } catch (e) {
    throw new Error('Could not read the Excel file. Please ensure it is a valid .xlsx workbook.');
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('The uploaded template has no worksheets.');
  }

  // Punch in Project Details
  if (projectDetails) {
    const darkGrey = 'FF808080';
    const calibri12 = { name: 'Calibri', size: 12, color: { argb: darkGrey } };

    // Project ID on N1
    const idCell = sheet.getCell('N1');
    idCell.value = projectDetails.projectId;
    idCell.font = calibri12;

    // Project Name on D1
    const nameCell = sheet.getCell('D1');
    nameCell.value = projectDetails.projectName;
    nameCell.font = calibri12;

    // Address on D2
    const address = projectDetails.address || '';
    const addrCell = sheet.getCell('D2');
    addrCell.value = address;
    addrCell.font = calibri12;

    // Rev on D4
    const revCell = sheet.getCell('D4');
    revCell.value = projectDetails.rev;
    revCell.font = calibri12;

    // Date on A4 with text "Date:"
    const dateCell = sheet.getCell('A4');
    dateCell.value = `Date: ${projectDetails.date}`;
    dateCell.font = calibri12;
  }

  // Group items by System and then by Format
  const grouped: Record<string, Record<string, AggregatedItem[]>> = {};
  summary.forEach(item => {
    if (!grouped[item.System]) grouped[item.System] = {};
    if (!grouped[item.System][item.Format]) grouped[item.System][item.Format] = [];
    grouped[item.System][item.Format].push(item);
  });

  let row = 10; // Starting row

  Object.keys(grouped).forEach(system => {
    // System Header - Entire Row Bold
    const systemRow = sheet.getRow(row);
    const systemCell = systemRow.getCell(2);
    systemCell.value = system;
    systemRow.font = { bold: true, size: 14, name: 'Calibri' };
    systemCell.alignment = { vertical: 'middle', horizontal: 'left' };
    row++;

    Object.keys(grouped[system]).forEach(format => {
      // Format Sub-header (Section) - Entire Row Bold
      row++; 
      const formatRow = sheet.getRow(row);
      const formatCell = formatRow.getCell(2);
      formatCell.value = format;
      formatRow.font = { bold: true, size: 12, name: 'Calibri' };
      formatCell.alignment = { horizontal: 'left' };
      // Explicitly clear any previous background fill from template
      formatCell.fill = { type: 'pattern', pattern: 'none' };
      row++;

      let srNo = 1;
      grouped[system][format].forEach(item => {
        // SR. NO.
        const srNoCell = sheet.getCell(row, 1);
        srNoCell.value = srNo++;
        srNoCell.font = { bold: false };
        srNoCell.alignment = { horizontal: 'center' };

        // DESCRIPTION
        const itemCell = sheet.getCell(row, 2);
        itemCell.value = item.Item;
        itemCell.font = { bold: false };
        itemCell.alignment = { horizontal: 'left' };

        // QUANTITY
        const qtyCell = sheet.getCell(row, 3);
        qtyCell.value = item.Qty;
        qtyCell.font = { bold: false };
        qtyCell.alignment = { horizontal: 'center' };

        // PERCENTAGE (Column D)
        const pctCell = sheet.getCell(row, 4);
        pctCell.value = '0%';
        pctCell.font = { bold: false };
        pctCell.alignment = { horizontal: 'center' };

        // UNIT
        const unitCell = sheet.getCell(row, 6);
        unitCell.value = item.Unit;
        unitCell.font = { bold: false };
        unitCell.alignment = { horizontal: 'center' };

        // UNIT COST (Column G)
        const unitCostCell = sheet.getCell(row, 7);
        unitCostCell.value = item.unitCost == null ? null : item.unitCost;
        unitCostCell.font = { bold: false };
        unitCostCell.alignment = { horizontal: 'right' };

        // LABOR (Column K)
        const laborCell = sheet.getCell(row, 11);
        laborCell.value = item.labor == null ? null : item.labor;
        laborCell.font = { bold: false };
        laborCell.alignment = { horizontal: 'right' };
        
        row++;
      });
      
      row++; // Space after each format group
    });
    
    row++; // Space after each system group
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
