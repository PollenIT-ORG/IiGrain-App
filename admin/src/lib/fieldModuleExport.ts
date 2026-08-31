import {
  downloadWorkbook,
  fileStamp,
  type Sheet,
  type Column,
  type ColumnGroup,
  type CellValue,
} from "./workbook";
import { MODULES, MODULE_BY_KEY, allFields, STATUS_LABEL } from "./fieldModules";
import { yearOfRecord } from "./monitoringYear";
import { practiceRollup, practiceCells } from "./practiceRollup";
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

/**
 * The attachments cell. Excel allows one link per cell, so the first file is
 * the link and the rest are counted; the Attachments sheet lists them all.
 */
export function attachmentCell(files: ModuleDocument[]): CellValue {
  if (!files.length) return "";
  const first = files[0];
  const text = files.length === 1 ? first.name : `${first.name} (+${files.length - 1} more)`;
  return first.url ? { text, hyperlink: first.url } : text;
}

/** One record as the cells for those columns. */
export function moduleSheetRow(
  record: ModuleRecord,
  fields: readonly { key: string; type: string }[],
  files: ModuleDocument[]
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
    attachmentCell(files),
  ];
}

export interface AttachmentContext {
  /** Keyed by record id, for files pinned to one row. */
  records: Map<string, { year: string; fieldName: string; label: string }>;
  /** Keyed by field id, so a loose file still names its field. */
  fieldNames: Map<string, string>;
}

/** Every file in a workbook on one sheet, each with a link that opens it. */
export function attachmentsSheet(input: {
  documents: ModuleDocument[];
  context: AttachmentContext;
}): Sheet {
  const rows = input.documents.map((d) => {
    const meta = d.record_id ? input.context.records.get(d.record_id) : undefined;
    return [
      meta?.year ?? "",
      meta?.fieldName ?? input.context.fieldNames.get(d.field_id) ?? "",
      MODULE_BY_KEY[d.module as ModuleKey]?.label ?? d.module,
      meta?.label ?? "",
      d.name,
      d.mime_type ?? "",
      d.size_bytes ? Math.round(d.size_bytes / 1024) : "",
      d.url ? { text: "Open", hyperlink: d.url } : "",
    ] as CellValue[];
  });

  return {
    name: "Attachments",
    title: "Attachments",
    notes: [["Files", String(input.documents.length)]],
    columns: [
      { header: "Year", width: 10, type: "text" },
      { header: "Field Name", width: 24, type: "text" },
      { header: "Module", width: 22, type: "text" },
      { header: "Record", width: 28, type: "text" },
      { header: "File Name", width: 46, type: "text" },
      { header: "Type", width: 18, type: "text" },
      { header: "Size (KB)", width: 12, type: "number" },
      { header: "Link", width: 12, type: "text" },
    ],
    rows,
  };
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

  const filesByRecord = new Map<string, ModuleDocument[]>();
  for (const doc of input.documents) {
    if (!doc.record_id) continue;
    const list = filesByRecord.get(doc.record_id) ?? [];
    list.push(doc);
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
    subtitle: input.context.farmName,
    // The same header block the client sees at the top of the screen, so a
    // printed sheet stands on its own away from the app.
    notes: [
      ["Farm", input.context.farmName],
      ["Field", input.context.fieldName],
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

/** How a record is named on the attachments sheet: its most telling column. */
export function recordLabel(module: ModuleKey, record: ModuleRecord): string {
  const fields = allFields(module);
  const named = fields.find(
    (f) =>
      (f.type === "text" || f.type === "select") &&
      record[f.key] !== null &&
      record[f.key] !== undefined &&
      record[f.key] !== ""
  );
  if (named) return String(record[named.key]);

  const dated = fields.find((f) => f.type === "date" && record[f.key]);
  if (dated) return String(record[dated.key]).slice(0, 10);

  return record.id.slice(0, 8);
}

/** Where every file sits, for the attachments sheet. */
export function attachmentIndex(
  recordsByModule: Partial<Record<ModuleKey, ModuleRecord[]>>,
  fieldNameOf: (record: ModuleRecord) => string,
  fieldNames: Map<string, string>
): AttachmentContext {
  const records = new Map<string, { year: string; fieldName: string; label: string }>();
  for (const [key, rows] of Object.entries(recordsByModule)) {
    for (const r of rows ?? []) {
      records.set(r.id, {
        year: yearOfRecord(r),
        fieldName: fieldNameOf(r),
        label: recordLabel(key as ModuleKey, r),
      });
    }
  }
  return { records, fieldNames };
}

/** The button on a single tab: that module only. */
export async function exportModule(input: {
  module: ModuleKey;
  records: ModuleRecord[];
  documents: ModuleDocument[];
  context: FieldModuleContext;
}): Promise<void> {
  const def = MODULE_BY_KEY[input.module];
  const sheets: Sheet[] = [moduleSheet(input)];
  if (input.documents.length) {
    sheets.push(
      attachmentsSheet({
        documents: input.documents,
        context: attachmentIndex(
          { [input.module]: input.records },
          () => input.context.fieldName,
          new Map([[input.context.fieldId, input.context.fieldName]])
        ),
      })
    );
  }
  await downloadWorkbook(stamped(input.context, def.label), sheets);
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
  const rollup = practiceRollup(input.recordsByModule);
  const profile: Sheet = {
    name: "Field Profile",
    title: `Field Profile - ${input.context.fieldName}`,
    subtitle: input.context.farmName,
    notes: [
      ["Farm", input.context.farmName],
      ["Field", input.context.fieldName],
    ],
    groups: [
      { label: "", span: 1 },
      { label: "Tillage", span: 1 },
      { label: "At least 2 required of the following", span: 5 },
    ],
    columns: [
      { header: "Field Name", width: 24, type: "text" },
      { header: "Tillage (No Till, Reduced Till, Did Not Meet Requirement)", width: 30, type: "text" },
      { header: "Organic Amendment", width: 18, type: "text" },
      { header: "Crop Intensification", width: 20, type: "text" },
      { header: "Crop Diversification", width: 20, type: "text" },
      { header: "Synthetic Nutrient Management", width: 26, type: "text" },
      { header: "Animal Integration", width: 18, type: "text" },
    ],
    rows: [[input.context.fieldName, ...practiceCells(rollup)]],
  };

  const sheets: Sheet[] = [
    profile,
    ...MODULES.map((def) =>
      moduleSheet({
        module: def.key,
        records: input.recordsByModule[def.key] ?? [],
        documents: input.documents.filter((d) => d.module === def.key),
        context: input.context,
      })
    ),
    attachmentsSheet({
      documents: input.documents,
      context: attachmentIndex(
        input.recordsByModule,
        () => input.context.fieldName,
        new Map([[input.context.fieldId, input.context.fieldName]])
      ),
    }),
  ];
  await downloadWorkbook(stamped(input.context, "Field-Monitoring"), sheets);
}
