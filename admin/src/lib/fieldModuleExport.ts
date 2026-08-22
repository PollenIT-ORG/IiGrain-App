import {
  downloadWorkbook,
  fileStamp,
  type Sheet,
  type Column,
  type ColumnGroup,
} from "./workbook";
import { MODULES, MODULE_BY_KEY, allFields, STATUS_LABEL } from "./fieldModules";
import type {
  ModuleKey,
  ModuleRecord,
  ModuleDocument,
  FieldModuleContext,
} from "../types";

/**
 * Excel for the monitoring modules.
 *
 * The same column registry that draws the table and the form builds the sheet,
 * so the file can never drift from what is on screen. Two exports come out of
 * it: one tab on its own, and every tab in one workbook, which is why both go
 * through the same sheet builder.
 */

/**
 * The client's worksheet asks for phosphorus and potassium as the element, P
 * and K. A fertilizer bag, and so our form, states them as the oxide, P2O5 and
 * K2O. They are different numbers, so the export converts rather than relabel
 * what the farmer typed. The stored value is never touched.
 */
const P2O5_TO_P = 0.4364;
const K2O_TO_K = 0.8301;

/** Columns that need converting on the way out, and what they become. */
const OXIDE_TO_ELEMENT: Record<string, { header: string; factor: number }> = {
  p2o5_pct: { header: "P%", factor: P2O5_TO_P },
  k2o_pct: { header: "K%", factor: K2O_TO_K },
};

/**
 * How the client's own workbook bands its columns. Only the modules whose
 * sheets carry a band are listed; the rest export as a plain table.
 */
const GROUPS: Partial<Record<ModuleKey, ColumnGroup[]>> = {
  irrigation: [{ label: "Irrigation", span: 5 }],
  pesticide: [{ label: "Pesticide Use", span: 6 }],
  fertilizer: [{ label: "Synthetic Fertilizer Use", span: 8 }],
  tillage: [
    { label: "MANDATORY", span: 5 },
    { label: "Supplemental", span: 2 },
  ],
  amendment: [{ label: "1. Organic Amendments", span: 9 }],
  crop: [{ label: "2. Crop Diversification / 4. Crop Intensification", span: 8 }],
  nutrient: [{ label: "3. Nutrient Management", span: 9 }],
};

/** Excel refuses a sheet name over 31 characters or holding : \ / ? * [ ]. */
function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);
}

function columnType(type: string): Column["type"] {
  if (type === "number") return "number";
  if (type === "date") return "date";
  return "text";
}

/** What a cell should hold, given the column it belongs to. */
function cellValue(record: ModuleRecord, key: string, type: string) {
  const raw = record[key];
  if (raw === null || raw === undefined || raw === "") return "";
  if (type === "boolean") return raw === true ? "Yes" : "No";
  if (type === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? String(raw) : n;
  }
  if (type === "date") {
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? String(raw) : d;
  }
  return String(raw);
}

/**
 * The columns a module contributes to a sheet, in order. Shared so the
 * per-field export and the whole-farm workbook can never drift apart.
 */
export function moduleSheetColumns(module: ModuleKey): Column[] {
  return [
    ...allFields(module).map((f) => ({
      header: OXIDE_TO_ELEMENT[f.key]?.header ?? f.label,
      width: f.width,
      type: columnType(f.type),
    })),
    { header: "Status", width: 14, type: "text" as const },
    { header: "Notes", width: 30, type: "text" as const },
    { header: "Attachments", width: 28, type: "text" as const },
  ];
}

/** One record as the cells for those columns. */
export function moduleSheetRow(
  record: ModuleRecord,
  fields: readonly { key: string; type: string }[],
  fileNames: string[]
) {
  return [
    ...fields.map((f) => {
      const value = cellValue(record, f.key, f.type);
      const convert = OXIDE_TO_ELEMENT[f.key];
      if (!convert || typeof value !== "number") return value;
      // Two decimals: any more is false precision on a bag percentage.
      return Math.round(value * convert.factor * 100) / 100;
    }),
    STATUS_LABEL[record.status] ?? record.status,
    record.notes ?? "",
    fileNames.join(", "),
  ];
}

/**
 * One module as one sheet. Files attached to a row are listed in their own
 * column, by name, so the sheet says what exists without carrying the file.
 */
export function moduleSheet(input: {
  module: ModuleKey;
  records: ModuleRecord[];
  documents: ModuleDocument[];
  context: FieldModuleContext;
}): Sheet {
  const def = MODULE_BY_KEY[input.module];
  const fields = allFields(input.module);

  const filesByRecord = new Map<string, string[]>();
  for (const doc of input.documents) {
    if (!doc.record_id) continue;
    const list = filesByRecord.get(doc.record_id) ?? [];
    list.push(doc.name);
    filesByRecord.set(doc.record_id, list);
  }

  const columns = moduleSheetColumns(input.module);

  const rows = input.records.map((r) =>
    moduleSheetRow(r, fields, filesByRecord.get(r.id) ?? [])
  );

  const groups = GROUPS[input.module];

  return {
    name: safeSheetName(def.sheetName),
    // Spans cover the module's own columns; Status, Notes and Attachments sit
    // outside the band, so a trailing blank keeps everything lined up.
    groups: groups
      ? [...groups, { label: "", span: columns.length - fields.length }]
      : undefined,
    title: `${def.label} - ${input.context.fieldName}`,
    subtitle: `${input.context.farmName} | ${input.context.programName}`,
    // The same header block the client sees at the top of the screen, so a
    // printed sheet stands on its own away from the app.
    notes: [
      ["Farm", input.context.farmName],
      ["Field", input.context.fieldName],
      ["Program", input.context.programName],
      ["Records", String(input.records.length)],
    ],
    columns,
    rows,
  };
}

/** A file name that says what it is without being opened. */
function stamped(context: FieldModuleContext, label: string): string {
  const clean = (s: string) => s.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return `${clean(context.fieldName)}-${clean(label)}-${fileStamp()}.xlsx`;
}

/** The button on a single tab: that module only. */
export async function exportModule(input: {
  module: ModuleKey;
  records: ModuleRecord[];
  documents: ModuleDocument[];
  context: FieldModuleContext;
}): Promise<void> {
  const def = MODULE_BY_KEY[input.module];
  await downloadWorkbook(stamped(input.context, def.label), [moduleSheet(input)]);
}

/**
 * The combined button: every module in one workbook, one sheet each, in the
 * order the tabs appear. Modules with no records still get their sheet, so the
 * file has the same shape for every field and can be compared side by side.
 */
export async function exportAllModules(input: {
  recordsByModule: Record<ModuleKey, ModuleRecord[]>;
  documents: ModuleDocument[];
  context: FieldModuleContext;
}): Promise<void> {
  const sheets: Sheet[] = MODULES.map((def) =>
    moduleSheet({
      module: def.key,
      records: input.recordsByModule[def.key] ?? [],
      documents: input.documents.filter((d) => d.module === def.key),
      context: input.context,
    })
  );
  await downloadWorkbook(stamped(input.context, "Field-Monitoring"), sheets);
}
