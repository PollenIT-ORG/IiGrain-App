import { downloadWorkbook, fileStamp, type Sheet, type Column } from "./workbook";
import { MODULES, allFields } from "./fieldModules";
import { moduleSheetColumns, moduleSheetRow } from "./fieldModuleExport";
import type { ModuleKey, ModuleRecord, ModuleDocument } from "../types";

/**
 * The whole farm as one workbook, in the shape of the client's own template.
 *
 * Their file is one farm for one year: a profile listing every field, then a
 * sheet per practice holding the detail. Our program is that year, so a
 * workbook is one farm inside one program.
 *
 * This is not the same as the per-field export. There, every row is already
 * about one field so the field is in the header. Here a sheet spans the whole
 * farm, so every row has to say which field it belongs to.
 */

export interface FarmField {
  fieldId: string;
  fieldName: string;
  areaAcres: number | null;
}

export interface FarmExportInput {
  farmName: string;
  programName: string;
  /** Program start year, which is what their template calls the Year. */
  year: string;
  fields: FarmField[];
  /** Records for every field of this farm, keyed by module. */
  recordsByModule: Record<ModuleKey, Array<ModuleRecord & { fieldName: string }>>;
  documents: ModuleDocument[];
}

/**
 * The profile sheet: the farm at the top, then one row per field.
 *
 * Their version also carries the tillage result and the five practice answers.
 * Those come from the tier rules, which are not built yet, so the columns are
 * present but left empty rather than guessed at. When the tier work lands, the
 * values fill in and the sheet does not change shape.
 */
function profileSheet(input: FarmExportInput): Sheet {
  const acres = input.fields.reduce((sum, f) => sum + (f.areaAcres ?? 0), 0);

  const columns: Column[] = [
    { header: "Field Name", width: 24, type: "text" },
    { header: "Field Size (Acres)", width: 18, type: "number", total: "sum" },
    { header: "Tillage (No Till, Reduced Till, Did Not Meet Requirement)", width: 30, type: "text" },
    { header: "Organic Amendment", width: 18, type: "text" },
    { header: "Crop Intensification", width: 20, type: "text" },
    { header: "Crop Diversification", width: 20, type: "text" },
    { header: "Synthetic Nutrient Management", width: 26, type: "text" },
    { header: "Animal Integration", width: 18, type: "text" },
  ];

  return {
    name: `${input.year} Farm Profile`.slice(0, 31),
    title: `${input.year} Farm Profile - ${input.farmName}`,
    subtitle: input.programName,
    notes: [
      ["Farm ID", input.farmName],
      ["# of acres enrolled", String(Math.round(acres * 100) / 100)],
      ["Year", input.year],
      ["Fields enrolled", String(input.fields.length)],
    ],
    // Their sheet bands the five practices under one heading.
    groups: [
      { label: "", span: 2 },
      { label: "Tillage", span: 1 },
      { label: "At least 2 required of the following", span: 5 },
    ],
    columns,
    rows: input.fields.map((f) => [
      f.fieldName,
      f.areaAcres ?? "",
      "", "", "", "", "", "",
    ]),
  };
}

/** One module across every field of the farm, with the field named per row. */
function farmModuleSheet(
  module: ModuleKey,
  input: FarmExportInput
): Sheet {
  const def = MODULES.find((m) => m.key === module)!;
  const records = input.recordsByModule[module] ?? [];
  const fields = allFields(module);

  const filesByRecord = new Map<string, string[]>();
  for (const doc of input.documents) {
    if (!doc.record_id || doc.module !== module) continue;
    filesByRecord.set(doc.record_id, [
      ...(filesByRecord.get(doc.record_id) ?? []),
      doc.name,
    ]);
  }

  const columns: Column[] = [
    { header: "Year", width: 10, type: "text" },
    { header: "Field Name", width: 24, type: "text" },
    ...moduleSheetColumns(module),
  ];

  const rows = records.map((r) => [
    input.year,
    r.fieldName,
    ...moduleSheetRow(r, fields, filesByRecord.get(r.id) ?? []),
  ]);

  return {
    name: def.sheetName.slice(0, 31),
    title: `${def.label} - ${input.farmName}`,
    subtitle: `${input.programName} | ${input.year}`,
    notes: [
      ["Farm ID", input.farmName],
      ["Year", input.year],
      ["Records", String(records.length)],
    ],
    columns,
    rows,
  };
}

/** A file name the client can file without opening. */
function fileName(input: FarmExportInput): string {
  const clean = (s: string) => s.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return `${clean(input.farmName)}-${input.year}-Field-Monitoring-${fileStamp()}.xlsx`;
}

/**
 * The full workbook: the profile first, then a sheet per module in the order
 * the client's own file uses. Empty modules still get their sheet, so every
 * farm's workbook has the same shape and can be compared side by side.
 */
export async function exportFarmWorkbook(input: FarmExportInput): Promise<void> {
  const sheets: Sheet[] = [
    profileSheet(input),
    ...MODULES.map((def) => farmModuleSheet(def.key, input)),
  ];
  await downloadWorkbook(fileName(input), sheets);
}
