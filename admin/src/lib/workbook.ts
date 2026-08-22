import ExcelJS from "exceljs";
import { readCachedBranding } from "./brandingCache";
import { fmtDateTime, getLocaleSettings } from "./datetime";

// Every spreadsheet the platform hands out is built here, so they all arrive
// looking like they came from the same place: a brand-green banner the width
// of the table, the export details under it, the filters that produced the
// list, then the table itself with a darker heading row.
//
// The brand is carried by colour and type, never by a picture. A logo dropped
// on a sheet floats above the grid and lands somewhere different in Excel, WPS
// and Sheets - on top of the title in one, missing in another.

const BRAND = "136F3F";
const BRAND_DARK = "0E5A31";
const HEAD_TEXT = "FFFFFF";
const STRIPE = "F7F9FA";
const BORDER = "E4E8EA";
const TEXT = "212829";
const MUTED = "6B7477";

export type CellValue = string | number | Date | null | undefined;

export interface Column {
  header: string;
  /** A floor, not a cap - a heading always gets room for its filter button. */
  width?: number;
  /** "text" keeps long digit strings readable - a phone number is not a sum. */
  type?: "text" | "number" | "money" | "percent" | "date" | "auto";
  /** SUM or AVERAGE under the column, as a formula over the real rows. */
  total?: "sum" | "average";
}

/**
 * A merged band above the headings, covering a run of columns. This is how the
 * client's own workbook groups its columns, for example one Irrigation band
 * sitting over the five irrigation columns.
 */
export interface ColumnGroup {
  label: string;
  /** How many columns this band covers, left to right. */
  span: number;
}

export interface Sheet {
  name: string;
  title?: string;
  subtitle?: string;
  columns: Column[];
  rows: CellValue[][];
  /** Small "label: value" pairs above the table, e.g. the filters used. */
  notes?: Array<[string, string]>;
  /**
   * Bands over the headings. The spans must add up to the column count; any
   * shortfall is left as a blank band so nothing is silently misaligned.
   */
  groups?: ColumnGroup[];
}

function thin(color = BORDER): Partial<ExcelJS.Border> {
  return { style: "thin", color: { argb: `FF${color}` } };
}

/**
 * The format for one cell.
 *
 * "#,##0.##" leaves a dangling dot after a whole number in some spreadsheet
 * apps - 1,025. - and a fixed "#,##0.00" turns a count of 10 farms into
 * "10.00". So the decision is made per value: whole numbers print whole, and
 * only a real fraction gets places after the point.
 */
function numberFormat(
  type: Column["type"],
  value?: CellValue
): string | undefined {
  switch (type) {
    case "money":
      return "#,##0.00";
    case "percent":
      return "0.0%";
    case "date":
      return "dd mmm yyyy, hh:mm AM/PM";
    case "number":
      return typeof value === "number" && !Number.isInteger(value)
        ? "#,##0.00"
        : "#,##0";
    default:
      return undefined;
  }
}

// The filter button sits inside the heading cell and covers about three
// characters, so every column leaves room for it.
const FILTER_ARROW = 4;

function columnWidth(col: Column, rows: CellValue[][], index: number): number {
  let longest = col.header.length + FILTER_ARROW;
  for (const row of rows) {
    const v = row[index];
    const len = v instanceof Date ? 24 : String(v ?? "").length;
    if (len > longest) longest = len;
  }
  const asked = col.width ?? 0;
  return Math.min(52, Math.max(12, asked, longest + 2));
}

/** Right for anything counted or dated, left for anything read. */
function alignment(col: Column): "left" | "right" {
  return col.type === "number" ||
    col.type === "money" ||
    col.type === "percent" ||
    col.type === "date"
    ? "right"
    : "left";
}

/**
 * Writes one sheet: the title block, the notes, the table, and a totals row
 * where a column asked for one.
 */
function writeSheet(
  ws: ExcelJS.Worksheet,
  sheet: Sheet,
  appName: string
): void {
  const width = sheet.columns.length;

  // --- the banner ----------------------------------------------------------
  // A brand-green band the exact width of the table, with the report name
  // centred in it. No image: a floating logo lands somewhere different in
  // every spreadsheet app, so the colour carries the brand instead.
  ws.mergeCells(1, 1, 2, width);
  const banner = ws.getCell("A1");
  banner.value = sheet.title ?? appName;
  banner.font = {
    name: "Calibri",
    size: 16,
    bold: true,
    color: { argb: `FF${HEAD_TEXT}` },
  };
  banner.alignment = { vertical: "middle", horizontal: "center" };
  banner.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${BRAND}` },
  };
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 22;

  // Who exported it and when, on a quiet band under the banner.
  ws.mergeCells(3, 1, 3, width);
  const sub = ws.getCell("A3");
  sub.value = sheet.subtitle ?? `${appName} - exported ${fmtDateTime(new Date())}`;
  sub.font = { size: 9, italic: true, color: { argb: `FF${MUTED}` } };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sub.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${STRIPE}` },
  };
  ws.getRow(3).height = 18;

  let cursor = 4;

  // --- what produced this list, as a small boxed table ---------------------
  for (const [label, value] of sheet.notes ?? []) {
    const row = ws.getRow(cursor);
    const key = row.getCell(1);
    key.value = label;
    key.font = { size: 10, bold: true, color: { argb: `FF${TEXT}` } };
    key.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    key.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${STRIPE}` },
    };
    key.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };

    const val = row.getCell(2);
    val.value = value;
    val.font = { size: 10, color: { argb: `FF${TEXT}` } };
    val.alignment = { vertical: "middle", horizontal: "center" };
    val.border = { top: thin(), bottom: thin(), left: thin(), right: thin() };

    row.height = 18;
    cursor += 1;
  }
  if (sheet.notes?.length) {
    ws.getRow(cursor).height = 8;
    cursor += 1;
  }

  // --- the grouping band, when the sheet uses one --------------------------
  if (sheet.groups?.length) {
    const band = ws.getRow(cursor);
    let col = 1;
    for (const group of sheet.groups) {
      const span = Math.max(1, group.span);
      if (span > 1) ws.mergeCells(cursor, col, cursor, col + span - 1);
      const cell = band.getCell(col);
      cell.value = group.label;
      cell.font = { bold: true, size: 10, color: { argb: `FF${HEAD_TEXT}` } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${BRAND}` },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { left: thin(), right: thin() };
      col += span;
    }
    band.height = 20;
    cursor += 1;
  }

  // --- the headings --------------------------------------------------------
  const headerRowNumber = cursor;
  const header = ws.getRow(headerRowNumber);
  sheet.columns.forEach((col, i) => {
    const cell = header.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 11, color: { argb: `FF${HEAD_TEXT}` } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${BRAND_DARK}` },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: alignment(col),
      indent: 1,
    };
  });
  header.height = 22;

  // --- the rows ------------------------------------------------------------
  sheet.rows.forEach((values, r) => {
    const row = ws.getRow(headerRowNumber + 1 + r);
    sheet.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const raw = values[i];
      // A long run of digits is an identifier, not a quantity: kept as text so
      // it never turns into 9.17729E+11. Nothing at all is left blank rather
      // than filled with an empty string.
      const empty = raw === null || raw === undefined || raw === "";
      cell.value = empty
        ? null
        : col.type === "text"
          ? String(raw)
          : (raw as string | number | Date);

      const format = numberFormat(col.type, raw);
      if (format) cell.numFmt = format;
      cell.font = { size: 10, color: { argb: `FF${TEXT}` } };
      cell.alignment = {
        vertical: "middle",
        horizontal: alignment(col),
        indent: 1,
      };
      cell.border = { bottom: thin() };
      if (r % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${STRIPE}` },
        };
      }
    });
    row.height = 17;
  });

  // --- the total, as a formula over the rows above -------------------------
  const firstDataRow = headerRowNumber + 1;
  const lastDataRow = headerRowNumber + sheet.rows.length;
  if (sheet.rows.length > 0 && sheet.columns.some((c) => c.total)) {
    const totals = ws.getRow(lastDataRow + 1);
    sheet.columns.forEach((col, i) => {
      const cell = totals.getCell(i + 1);
      cell.font = { bold: true, size: 10, color: { argb: `FF${TEXT}` } };
      cell.border = { top: { style: "medium", color: { argb: `FF${BRAND}` } } };
      cell.alignment = {
        vertical: "middle",
        horizontal: alignment(col),
        indent: 1,
      };
      if (i === 0 && !col.total) {
        cell.value = "Total";
        return;
      }
      if (!col.total) return;
      const letter = String.fromCharCode(65 + i);
      cell.value = {
        formula: `${col.total === "sum" ? "SUM" : "AVERAGE"}(${letter}${firstDataRow}:${letter}${lastDataRow})`,
      };
      // A sum of whole numbers stays whole; an average rarely is.
      cell.numFmt =
        col.total === "average"
          ? "#,##0.00"
          : (numberFormat(col.type, 0) ?? "#,##0");
    });
    totals.height = 19;
  }

  // --- how it opens --------------------------------------------------------
  sheet.columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = columnWidth(col, sheet.rows, i);
  });
  if (sheet.rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: lastDataRow, column: width },
    };
  }
  ws.views = [
    {
      state: "frozen",
      ySplit: headerRowNumber,
      showGridLines: false,
    },
  ];
  ws.pageSetup = {
    orientation: width > 6 ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
  };
  ws.headerFooter = { oddFooter: `&L${appName}&C&P of &N&R&D` };
  // The headings repeat at the top of every printed page.
  ws.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
}

/** The date for a filename, on the organization's clock: 2026-08-11. */
export function fileStamp(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: getLocaleSettings().timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Builds the workbook and hands it to the browser as a download. */
export async function downloadWorkbook(
  filename: string,
  sheets: Sheet[]
): Promise<void> {
  const appName = readCachedBranding()?.appName?.trim() || "iiGrain";
  const wb = new ExcelJS.Workbook();
  wb.creator = appName;
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), {
      properties: { defaultRowHeight: 17 },
    });
    writeSheet(ws, sheet, appName);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
