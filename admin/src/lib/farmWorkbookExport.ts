import { downloadWorkbook, fileStamp, type Sheet, type Column } from "./workbook";
import { MODULES, allFields } from "./fieldModules";
import {
  moduleSheetColumns,
  moduleSheetRow,
  attachmentsSheet,
  attachmentIndex,
} from "./fieldModuleExport";
import { yearOfRecord, yearsInRecords, currentYear } from "./monitoringYear";
import { practiceRollup, practiceCells, type RecordsByModule } from "./practiceRollup";
import type { ModuleKey, ModuleRecord, ModuleDocument, FarmField } from "../types";

export type { FarmField };

export interface FarmExportInput {
  farmName: string;
  /** Set when one year was asked for; otherwise every record is included. */
  year?: string;
  fields: FarmField[];
  /** Records for every field of this farm, keyed by module. */
  recordsByModule: Record<ModuleKey, Array<ModuleRecord & { fieldName: string }>>;
  documents: ModuleDocument[];
}

/** What the sheets are headed with: the chosen year, or the range covered. */
function coveredYear(input: FarmExportInput): string {
  if (input.year) return input.year;
  const years = yearsInRecords(
    Object.values(input.recordsByModule).flat() as ModuleRecord[]
  );
  if (!years.length) return currentYear();
  return years.length === 1 ? years[0] : `${years[years.length - 1]} to ${years[0]}`;
}

/** Every module's records for one field, which is what the rollup needs. */
function recordsForField(input: FarmExportInput, fieldName: string): RecordsByModule {
  const out: RecordsByModule = {};
  for (const [key, rows] of Object.entries(input.recordsByModule)) {
    out[key as ModuleKey] = rows.filter((r) => r.fieldName === fieldName);
  }
  return out;
}

/** Profile sheet: the farm at the top, then one row per field. */
function profileSheet(input: FarmExportInput): Sheet {
  const acres = input.fields.reduce((sum, f) => sum + (f.areaAcres ?? 0), 0);
  const year = coveredYear(input);

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
    name: `${year} Farm Profile`.slice(0, 31),
    title: `${year} Farm Profile - ${input.farmName}`,
    notes: [
      ["Farm ID", input.farmName],
      ["# of acres enrolled", String(Math.round(acres * 100) / 100)],
      ["Year", year],
      ["Fields enrolled", String(input.fields.length)],
    ],
    // The five practices sit under one banded heading.
    groups: [
      { label: "", span: 2 },
      { label: "Tillage", span: 1 },
      { label: "At least 2 required of the following", span: 5 },
    ],
    columns,
    rows: input.fields.map((f) => [
      f.fieldName,
      f.areaAcres ?? "",
      ...practiceCells(practiceRollup(recordsForField(input, f.fieldName))),
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

  const filesByRecord = new Map<string, ModuleDocument[]>();
  for (const doc of input.documents) {
    if (!doc.record_id || doc.module !== module) continue;
    filesByRecord.set(doc.record_id, [
      ...(filesByRecord.get(doc.record_id) ?? []),
      doc,
    ]);
  }

  const columns: Column[] = [
    { header: "Year", width: 10, type: "text" },
    { header: "Field Name", width: 24, type: "text" },
    ...moduleSheetColumns(module),
  ];

  const rows = records.map((r) => [
    yearOfRecord(r),
    r.fieldName,
    ...moduleSheetRow(r, fields, filesByRecord.get(r.id) ?? []),
  ]);

  return {
    name: def.sheetName.slice(0, 31),
    title: `${def.label} - ${input.farmName}`,
    subtitle: coveredYear(input),
    notes: [
      ["Farm ID", input.farmName],
      ["Year", coveredYear(input)],
      ["Records", String(records.length)],
    ],
    columns,
    rows,
  };
}

/** A file name that can be filed without opening it. */
function fileName(input: FarmExportInput): string {
  const clean = (s: string) => s.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return `${clean(input.farmName)}-${clean(coveredYear(input))}-Field-Monitoring-${fileStamp()}.xlsx`;
}

/** The profile first, then a sheet per module. Empty modules keep their sheet. */
export async function exportFarmWorkbook(input: FarmExportInput): Promise<void> {
  const byField = new Map<string, string>();
  for (const rows of Object.values(input.recordsByModule)) {
    for (const r of rows) byField.set(r.id, r.fieldName);
  }

  const sheets: Sheet[] = [
    profileSheet(input),
    ...MODULES.map((def) => farmModuleSheet(def.key, input)),
    attachmentsSheet({
      documents: input.documents,
      context: attachmentIndex(
        input.recordsByModule,
        (r) => byField.get(r.id) ?? "",
        new Map(input.fields.map((f) => [f.fieldId, f.fieldName]))
      ),
    }),
  ];
  await downloadWorkbook(fileName(input), sheets);
}
