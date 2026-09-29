import * as xlsx from "xlsx";
import ExcelJS from "exceljs";
import ApiError from "../utils/ApiError.js";

// Physical rows read from a sheet, blank rows included; a padded sheet range is cut down to this before any grid is built.
const MAX_SHEET_ROWS = 20_000;
const MAX_SHEET_COLUMNS = 50;
const UNREADABLE_FILE = "This Excel file could not be read. Save it again as .xlsx and try once more.";

export type ImportKey =
  | "section"
  | "questionCode"
  | "questionText"
  | "answerType"
  | "answers"
  | "maxScore"
  | "evidence"
  | "description"
  | "guidanceNote"
  | "score0"
  | "score1"
  | "score2"
  | "score3";

interface ImportColumn {
  key: ImportKey;
  header: string;
  aliases: readonly string[];
  required: boolean;
  width: number;
}

// The only list of spreadsheet columns: the importer reads by it and the empty template is written from it.
export const IMPORT_COLUMNS: readonly ImportColumn[] = [
  { key: "section", header: "Section", aliases: ["Category"], required: true, width: 24 },
  { key: "questionCode", header: "QuestionCode", aliases: ["Question Code"], required: false, width: 16 },
  { key: "questionText", header: "QuestionText", aliases: ["Question Text", "Question"], required: true, width: 60 },
  { key: "answerType", header: "AnswerType", aliases: ["Answer Type", "Type"], required: false, width: 18 },
  { key: "answers", header: "Answers", aliases: ["Choices", "Options"], required: false, width: 40 },
  { key: "maxScore", header: "MaxScore", aliases: ["Max Score", "Highest Score"], required: false, width: 12 },
  { key: "evidence", header: "Evidence", aliases: ["Photo"], required: false, width: 14 },
  { key: "description", header: "Description", aliases: ["Note"], required: false, width: 14 },
  { key: "guidanceNote", header: "GuidanceNote", aliases: ["Guidance Note", "Guidance"], required: false, width: 40 },
  { key: "score0", header: "Score0Description", aliases: ["Score0", "score0_description"], required: false, width: 30 },
  { key: "score1", header: "Score1Description", aliases: ["Score1", "score1_description"], required: false, width: 30 },
  { key: "score2", header: "Score2Description", aliases: ["Score2", "score2_description"], required: false, width: 30 },
  { key: "score3", header: "Score3Description", aliases: ["Score3", "score3_description"], required: false, width: 30 },
];

export type ImportCells = Record<ImportKey, string>;

export interface ParsedRow {
  // Where the row came from, for a problem message: "Row 7" or "Trainings, column B".
  where: string;
  cells: ImportCells;
}

export interface ParsedSheet {
  missingColumns: string[];
  rows: ParsedRow[];
  // Sheets that were left out on purpose, reported back to whoever imported.
  notes: { where: string; message: string }[];
  // Which shape the file turned out to be, so a blank template can take its kind from it.
  shape: "form" | "flat";
}

// The name the empty template ships with, which has to be changed to the form name.
const PLACEHOLDER_SHEET = "your form";

const EMPTY_CELLS: ImportCells = {
  section: "",
  questionCode: "",
  questionText: "",
  answerType: "",
  answers: "",
  maxScore: "",
  evidence: "",
  description: "",
  guidanceNote: "",
  score0: "",
  score1: "",
  score2: "",
  score3: "",
};

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function matchesColumn(column: ImportColumn, heading: string): boolean {
  const wanted = heading.toLowerCase();
  return [column.header, ...column.aliases].some((name) => name.toLowerCase() === wanted);
}

/** Reads a workbook written either as one row per question or as forms. */
export function readImportWorkbook(buffer: Buffer): ParsedSheet | null {
  let workbook: xlsx.WorkBook;
  try {
    workbook = xlsx.read(buffer, { type: "buffer", sheetRows: MAX_SHEET_ROWS + 1 });
  } catch {
    throw ApiError.badRequest(UNREADABLE_FILE);
  }
  const asForms = readFormWorkbook(workbook);
  return asForms ?? readImportSheet(buffer);
}

/** Reads the first sheet; row 1 holds the headers. Returns null when the file has no sheet. */
export function readImportSheet(buffer: Buffer): ParsedSheet | null {
  let workbook: xlsx.WorkBook;
  try {
    // One row past the cap, so a sheet that is too long can be told apart from one that just fits.
    workbook = xlsx.read(buffer, { type: "buffer", sheets: 0, sheetRows: MAX_SHEET_ROWS + 1 });
  } catch {
    throw ApiError.badRequest(UNREADABLE_FILE);
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return null;

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw ApiError.badRequest(UNREADABLE_FILE);
  const ref = sheet["!ref"];
  const required = IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.header);
  if (!ref) return { missingColumns: required, rows: [], notes: [], shape: "flat" };

  const range = xlsx.utils.decode_range(ref);
  if (range.e.r + 1 > MAX_SHEET_ROWS) {
    throw ApiError.badRequest(
      `This file has more than ${MAX_SHEET_ROWS} rows. Remove the empty rows or split it into smaller files.`
    );
  }
  range.e.c = Math.min(range.e.c, range.s.c + MAX_SHEET_COLUMNS - 1);

  // Row numbers match what the person sees in their spreadsheet, blank rows included.
  const firstRow = range.s.r;
  let grid: unknown[][];
  try {
    grid = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false,
      range,
    });
  } catch {
    throw ApiError.badRequest(UNREADABLE_FILE);
  }
  const headings = (grid[0] ?? []).map(cellText);

  const positions = new Map<ImportKey, number>();
  const missingColumns: string[] = [];
  for (const column of IMPORT_COLUMNS) {
    const at = headings.findIndex((h) => matchesColumn(column, h));
    if (at >= 0) positions.set(column.key, at);
    else if (column.required) missingColumns.push(column.header);
  }

  const rows = grid.slice(1).map((line, index) => {
    const cells: ImportCells = { ...EMPTY_CELLS };
    for (const column of IMPORT_COLUMNS) {
      const at = positions.get(column.key);
      if (at !== undefined) cells[column.key] = cellText(line[at]);
    }
    return { where: `Row ${firstRow + index + 2}`, cells };
  });

  return { missingColumns, rows, notes: [], shape: "flat" };
}

/** The letters of a column, the way a spreadsheet names it. */
function columnLetter(index: number): string {
  let at = index;
  let name = "";
  while (at > 0) {
    const remainder = (at - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    at = Math.floor((at - 1) / 26);
  }
  return name;
}

/**
 * A workbook written as forms: one sheet per form, the fields across the top
 * and their settings on the lines above, which is how the worksheets people
 * already keep are laid out.
 */
function readFormWorkbook(workbook: xlsx.WorkBook): ParsedSheet | null {
  const rows: ParsedRow[] = [];
  const notes: { where: string; message: string }[] = [];
  let looksLikeForms = false;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) continue;
    const range = xlsx.utils.decode_range(sheet["!ref"]);
    range.e.c = Math.min(range.e.c, range.s.c + MAX_SHEET_COLUMNS - 1);
    const grid = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false,
      range,
    });

    // Column A names each line, so the lines can be found wherever they sit.
    const lineAt = new Map<FormLine, number>();
    grid.forEach((line, index) => {
      const label = cellText(line[0]).toLowerCase();
      for (const key of FORM_LINE_ORDER) {
        const names = [FORM_LINES[key].toLowerCase(), ...(FORM_LINE_ALIASES[key] ?? [])];
        // The first match wins, so notes written under the form are left out of it.
        if (names.includes(label) && !lineAt.has(key)) lineAt.set(key, index);
      }
    });
    if (!lineAt.has("label")) continue;
    looksLikeForms = true;

    // A tab still carrying the name the empty template ships with is not a form
    // name, so its fields are left out and said so rather than imported as one.
    if (sheetName.trim().toLowerCase() === PLACEHOLDER_SHEET) {
      const labelLine = grid[lineAt.get("label") ?? -1] ?? [];
      if (labelLine.slice(1).some((cell) => cellText(cell) !== "")) {
        notes.push({
          where: sheetName,
          message: `Rename this tab to the form name before importing. Nothing from "${sheetName}" was imported.`,
        });
      }
      continue;
    }

    const lineCells = (key: FormLine): unknown[] => grid[lineAt.get(key) ?? -1] ?? [];
    const labels = lineCells("label");

    for (let column = 1; column < labels.length; column += 1) {
      const questionText = cellText(labels[column]);
      if (!questionText) continue;
      const value = (key: FormLine): string => cellText(lineCells(key)[column]);
      rows.push({
        where: `${sheetName}, column ${columnLetter(column + 1)}`,
        cells: {
          ...EMPTY_CELLS,
          section: sheetName,
          questionText,
          questionCode: value("questionCode"),
          answerType: value("answerType"),
          answers: value("answers"),
          maxScore: value("maxScore"),
          evidence: value("evidence"),
          description: value("description"),
          guidanceNote: value("guidanceNote"),
        },
      });
    }
  }

  return looksLikeForms ? { missingColumns: [], rows, notes, shape: "form" } : null;
}

// The words the AnswerType column takes: a multiple choice question, or the
// kind of field an input based form asks for.
export const IMPORT_TYPE_WORDS: Record<string, string> = {
  "multiple choice": "mcq",
  mcq: "mcq",
  choice: "mcq",
  "input based": "text",
  input: "text",
  "short text": "text",
  text: "text",
  description: "long_text",
  "long text": "long_text",
  long_text: "long_text",
  number: "number",
  date: "date",
  "yes or no": "boolean",
  "yes/no": "boolean",
  boolean: "boolean",
  // A photo is asked for by the Evidence column now, so the field itself is plain text.
  photo: "text",
  "score 0 to 3": "scored",
  scored: "scored",
};

// The words the Evidence and Description columns take; left empty means off.
export const IMPORT_EXTRA_WORDS: Record<string, string> = {
  "": "off",
  off: "off",
  no: "off",
  none: "off",
  optional: "optional",
  yes: "optional",
  required: "required",
  mandatory: "required",
};

// The words a column accepts, offered as a dropdown so nobody has to guess them.
const ANSWER_TYPE_CHOICES = [
  "Short text",
  "Description",
  "Number",
  "Date",
  "Yes or No",
  "Multiple choice",
  "Score 0 to 3",
];

const EXTRA_CHOICES = ["Off", "Optional", "Required"];

// How far down the dropdowns reach, so rows added later still have them.
const VALIDATED_ROWS = 500;

interface ValidatedColumn {
  key: ImportKey;
  choices: string[];
  title: string;
  message: string;
}

const VALIDATED_COLUMNS: ValidatedColumn[] = [
  {
    key: "answerType",
    choices: ANSWER_TYPE_CHOICES,
    title: "Answer type",
    message: "Pick one of the listed answer types.",
  },
  {
    key: "evidence",
    choices: EXTRA_CHOICES,
    title: "Evidence with the answer",
    message: "Pick Off, Optional or Required.",
  },
  {
    key: "description",
    choices: EXTRA_CHOICES,
    title: "Description with the answer",
    message: "Pick Off, Optional or Required.",
  },
];

/** A sheet in the import format, with the headers, the widths and the dropdowns. */
function addQuestionSheet(
  book: ExcelJS.Workbook,
  name: string,
  rows: string[][],
  validatedRows = VALIDATED_ROWS
): void {
  const sheet = book.addWorksheet(name);
  sheet.columns = IMPORT_COLUMNS.map((c) => ({ header: c.header, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);

  const lastRow = Math.max(rows.length + 1, validatedRows);
  for (const column of VALIDATED_COLUMNS) {
    const at = IMPORT_COLUMNS.findIndex((c) => c.key === column.key) + 1;
    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
      sheet.getCell(rowNumber, at).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${column.choices.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: column.title,
        error: column.message,
      };
    }
  }
}

// A form sheet: column A names each line, and every column after it is one field.
const FORM_LINES = {
  label: "Field",
  answerType: "Answer type",
  maxScore: "Highest score",
  evidence: "Evidence",
  description: "Description",
  answers: "Answers",
  questionCode: "Field code",
  guidanceNote: "Guidance",
} as const;

type FormLine = keyof typeof FORM_LINES;

// Older names a line may still carry in a file downloaded before it was renamed.
const FORM_LINE_ALIASES: Partial<Record<FormLine, string[]>> = { evidence: ["photo"] };

const FORM_LINE_ORDER: FormLine[] = [
  "label",
  "answerType",
  "maxScore",
  "evidence",
  "description",
  "answers",
  "questionCode",
  "guidanceNote",
];

// How far across a form sheet the dropdowns reach, so fields added later have them.
const FORM_COLUMNS = 60;

const FORM_VALIDATED: { line: FormLine; choices: string[]; title: string; message: string }[] = [
  { line: "answerType", choices: ANSWER_TYPE_CHOICES, title: "Answer type", message: "Pick one of the listed answer types." },
  { line: "evidence", choices: EXTRA_CHOICES, title: "Evidence with the answer", message: "Pick Off, Optional or Required." },
  { line: "description", choices: EXTRA_CHOICES, title: "Description with the answer", message: "Pick Off, Optional or Required." },
];

export interface FormSheet {
  name: string;
  fields: Partial<Record<FormLine, string>>[];
  // The line above the form that says what this sheet is for.
  note?: string;
}

// What every line asks for, written under the form so nobody has to be told.
const FORM_LINE_HELP: Record<FormLine, string> = {
  label: "Field - the question the farmer sees. Required: a column with no field name is skipped.",
  answerType: "Answer type - how the farmer answers. Click the cell and pick from the list.",
  maxScore: "Highest score - the most an admin can give this answer in review. Leave it blank for a multiple choice field.",
  evidence: "Evidence - Off, Optional or Required, for a photo or file along with the answer. Off when left empty.",
  description: "Description - Off, Optional or Required, for a note along with the answer.",
  answers: "Answers - multiple choice only, written as Bronze = 2 | Silver = 3.",
  questionCode: "Field code - a short code of your own, such as tr1. Optional.",
  guidanceNote: "Guidance - a hint for the farmer or for the admin who scores it. Optional.",
};

const SHEET_COLOURS = {
  banner: "FF14532D",
  bannerText: "FFFFFFFF",
  fieldLine: "FFDCFCE7",
  lineLabel: "FFF1F5F9",
  grid: "FFCBD5E1",
  help: "FF475569",
};

const CELL_BORDER = {
  top: { style: "thin" as const, color: { argb: SHEET_COLOURS.grid } },
  left: { style: "thin" as const, color: { argb: SHEET_COLOURS.grid } },
  bottom: { style: "thin" as const, color: { argb: SHEET_COLOURS.grid } },
  right: { style: "thin" as const, color: { argb: SHEET_COLOURS.grid } },
};

const fill = (argb: string) =>
  ({ type: "pattern", pattern: "solid", fgColor: { argb } }) as const;

// The form starts under the note, and every line is found by its own label anyway.
const FORM_FIRST_ROW = 3;

// How many field columns an empty form shows, so there is somewhere to type.
const EMPTY_FORM_FIELDS = 6;

const FORM_NOTE =
  "One sheet is one form. Every field is a column: write the field name on the Field line, then fill the lines under it.";

/** One sheet per form, with the fields across the top, as the worksheets people already use look. */
export async function buildFormWorkbook(forms: FormSheet[]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  for (const form of forms) addFormSheet(book, form);
  return Buffer.from(await book.xlsx.writeBuffer());
}

function addFormSheet(book: ExcelJS.Workbook, form: FormSheet): void {
  // A sheet name cannot hold these characters or run past 31 of them.
  const title = (form.name.replace(/[\/?*[\]:]/g, " ").trim() || "Form").slice(0, 31);
  const sheet = book.addWorksheet(title);
  const width = Math.max(form.fields.length, EMPTY_FORM_FIELDS);

  sheet.getColumn(1).width = 22;
  for (let i = 0; i < width; i += 1) sheet.getColumn(i + 2).width = 28;

  sheet.mergeCells(1, 1, 1, Math.min(width + 1, 8));
  const note = sheet.getCell(1, 1);
  note.value = form.note ?? FORM_NOTE;
  note.font = { bold: true, size: 12, color: { argb: SHEET_COLOURS.bannerText } };
  note.fill = fill(SHEET_COLOURS.banner);
  note.alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(1).height = 34;

  FORM_LINE_ORDER.forEach((line, index) => {
    const row = sheet.getRow(FORM_FIRST_ROW + index);
    row.height = 22;
    const isLabel = line === "label";
    const label = row.getCell(1);
    label.value = FORM_LINES[line];
    label.font = { bold: true };
    label.fill = fill(isLabel ? SHEET_COLOURS.fieldLine : SHEET_COLOURS.lineLabel);
    label.alignment = { vertical: "middle" };
    label.border = CELL_BORDER;
    for (let at = 0; at < width; at += 1) {
      const cell = row.getCell(at + 2);
      cell.value = form.fields[at]?.[line] ?? "";
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = CELL_BORDER;
      if (isLabel) {
        cell.font = { bold: true };
        cell.fill = fill(SHEET_COLOURS.fieldLine);
      }
    }
  });

  for (const rule of FORM_VALIDATED) {
    const rowNumber = FORM_FIRST_ROW + FORM_LINE_ORDER.indexOf(rule.line);
    for (let column = 2; column <= FORM_COLUMNS; column += 1) {
      sheet.getCell(rowNumber, column).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${rule.choices.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: rule.title,
        error: rule.message,
      };
    }
  }

  // The lines explained under the form, so the sheet stands on its own.
  const helpTop = FORM_FIRST_ROW + FORM_LINE_ORDER.length + 1;
  const heading = sheet.getCell(helpTop, 1);
  heading.value = "What each line means";
  heading.font = { bold: true };
  FORM_LINE_ORDER.forEach((line, index) => {
    const at = helpTop + 1 + index;
    sheet.mergeCells(at, 1, at, Math.min(width + 1, 7));
    const cell = sheet.getCell(at, 1);
    cell.value = FORM_LINE_HELP[line];
    cell.font = { color: { argb: SHEET_COLOURS.help } };
    cell.alignment = { vertical: "middle" };
  });

  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: FORM_FIRST_ROW }];
}

// The word each answer type is written as in the sheet.
const TYPE_WORDS: Record<string, string> = {
  mcq: "Multiple choice",
  text: "Short text",
  long_text: "Description",
  number: "Number",
  date: "Date",
  boolean: "Yes or No",
  scored: "Score 0 to 3",
};

export interface ExportQuestionRow {
  section: string;
  questionCode: string | null;
  questionText: string;
  questionType: string;
  maxScore: number;
  evidenceMode: string;
  commentMode: string;
  guidanceNote: string | null;
  score0Description: string | null;
  score1Description: string | null;
  score2Description: string | null;
  score3Description: string | null;
  options: { option_text: string; score: number }[];
}

const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** One field of a form, written the way the sheet holds it. */
function formField(row: ExportQuestionRow): Partial<Record<FormLine, string>> {
  return {
    label: row.questionText,
    answerType: TYPE_WORDS[row.questionType] ?? row.questionType,
    maxScore: row.questionType === "mcq" ? "" : String(row.maxScore),
    evidence: capitalise(row.evidenceMode),
    description: capitalise(row.commentMode),
    answers: row.options.map((o) => `${o.option_text} = ${o.score}`).join(" | "),
    questionCode: row.questionCode ?? "",
    guidanceNote: row.guidanceNote ?? "",
  };
}

/** An assessment written out as forms: one sheet per form, fields across the top. */
export async function buildFormExport(
  forms: { name: string; fields: ExportQuestionRow[] }[]
): Promise<Buffer> {
  return buildFormWorkbook(
    forms.map((form) => ({
      name: form.name,
      fields: form.fields.map(formField),
      note: `${form.name} as it stands today. Change what you need and import this file back; a field you add becomes a new field of this form.`,
    }))
  );
}

const GUIDE_STEPS = [
  "1. One sheet is one form. The tab name becomes the form name in the panel, so rename the Your form tab (right click the tab, then Rename) to Trainings, Soil samples, and so on. A tab left as Your form is not imported.",
  "2. Every field of the form is a column. The first field goes in column B, the next in column C, and so on.",
  "3. Read the lines down column A. Only the Field line has to be filled in; the rest are there when you need them.",
  "4. The Answer type, Evidence and Description cells hold a list. Click the cell, then the arrow, and pick a value. Evidence and Description are Off when left empty.",
  "5. A multiple choice field writes its answers on the Answers line as Bronze = 2 | Silver = 3.",
  "6. To add another form, copy the tab (right click the tab, Move or Copy, tick Create a copy) and rename the copy.",
  "7. Every tab that has fields becomes a form when the file is imported. This page is never imported.",
  "8. On the assessment page, press Import Excel and pick this file.",
];

// The example is drawn one column in, so this page can never be read as a form.
const GUIDE_EXAMPLE: [string, string[]][] = [
  ["Field", ["Date of the training", "Name of the training", "Length in hours", "Attendance sheet", "Tier"]],
  ["Answer type", ["Date", "Short text", "Number", "Short text", "Multiple choice"]],
  ["Highest score", ["3", "3", "3", "3", ""]],
  ["Evidence", ["Off", "Off", "Off", "Required", "Off"]],
  ["Description", ["Off", "Optional", "Off", "Off", "Off"]],
  ["Answers", ["", "", "", "", "Bronze = 2 | Silver = 3"]],
  ["Field code", ["", "", "", "tr4", ""]],
  ["Guidance", ["", "", "", "Ask for the signed sheet.", ""]],
];

const GUIDE_TYPES: [string, string][] = [
  ["Short text", "One line of text, such as a name."],
  ["Description", "A longer note over several lines."],
  ["Number", "A number, such as hours or a count."],
  ["Date", "A date from the calendar."],
  ["Yes or No", "A yes or no answer."],
  ["Multiple choice", "The farmer picks one of the answers you write, and that answer carries its own score."],
];

const GUIDE_SCORES =
  "Scores: a multiple choice answer carries the score you write next to it. For every other field an admin gives the score during review, up to the Highest score.";

/** The page that explains the file, so an admin can fill it in without being shown how. */
function addGuideSheet(book: ExcelJS.Workbook): void {
  const sheet = book.addWorksheet("Start here");
  const wide = 8;
  sheet.getColumn(1).width = 4;
  sheet.getColumn(2).width = 22;
  for (let c = 3; c <= wide; c += 1) sheet.getColumn(c).width = 26;
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const banner = (at: number, text: string) => {
    sheet.mergeCells(at, 1, at, wide);
    const cell = sheet.getCell(at, 1);
    cell.value = text;
    cell.font = { bold: true, size: 12, color: { argb: SHEET_COLOURS.bannerText } };
    cell.fill = fill(SHEET_COLOURS.banner);
    cell.alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(at).height = 30;
  };

  banner(1, "Input based assessment: how to fill this file in");

  let at = 3;
  for (const step of GUIDE_STEPS) {
    sheet.mergeCells(at, 1, at, wide);
    const cell = sheet.getCell(at, 1);
    cell.value = step;
    cell.alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(at).height = 30;
    at += 1;
  }

  at += 1;
  banner(at, "An example form. Your tab looks like this, with your own fields. Nothing on this page is imported.");
  at += 1;
  for (const [line, values] of GUIDE_EXAMPLE) {
    const row = sheet.getRow(at);
    row.height = 22;
    const label = row.getCell(2);
    label.value = line;
    label.font = { bold: true };
    label.fill = fill(line === "Field" ? SHEET_COLOURS.fieldLine : SHEET_COLOURS.lineLabel);
    label.border = CELL_BORDER;
    label.alignment = { vertical: "middle" };
    values.forEach((value, index) => {
      const cell = row.getCell(index + 3);
      cell.value = value;
      cell.border = CELL_BORDER;
      cell.alignment = { vertical: "middle", wrapText: true };
      if (line === "Field") {
        cell.font = { bold: true };
        cell.fill = fill(SHEET_COLOURS.fieldLine);
      }
    });
    at += 1;
  }

  at += 1;
  banner(at, "The answer types you can pick, and what the farmer fills in");
  at += 1;
  for (const [type, means] of GUIDE_TYPES) {
    const row = sheet.getRow(at);
    row.height = 22;
    row.getCell(2).value = type;
    row.getCell(2).fill = fill(SHEET_COLOURS.lineLabel);
    row.getCell(2).border = CELL_BORDER;
    sheet.mergeCells(at, 3, at, wide);
    const cell = sheet.getCell(at, 3);
    cell.value = means;
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: "middle", wrapText: true };
    at += 1;
  }

  at += 1;
  sheet.mergeCells(at, 1, at, wide);
  const scores = sheet.getCell(at, 1);
  scores.value = GUIDE_SCORES;
  scores.alignment = { vertical: "middle", wrapText: true };
  scores.font = { color: { argb: SHEET_COLOURS.help } };
  sheet.getRow(at).height = 30;
}

/** An assessment written out in the import format, ready to edit and import again. */
export async function buildTemplateExport(rows: ExportQuestionRow[]): Promise<Buffer> {
  const cells = (row: ExportQuestionRow): Record<ImportKey, string> => ({
    section: row.section,
    questionCode: row.questionCode ?? "",
    questionText: row.questionText,
    answerType: TYPE_WORDS[row.questionType] ?? row.questionType,
    answers: row.options.map((o) => `${o.option_text} = ${o.score}`).join(" | "),
    maxScore: row.questionType === "mcq" ? "" : String(row.maxScore),
    evidence: capitalise(row.evidenceMode),
    description: capitalise(row.commentMode),
    guidanceNote: row.guidanceNote ?? "",
    score0: row.score0Description ?? "",
    score1: row.score1Description ?? "",
    score2: row.score2Description ?? "",
    score3: row.score3Description ?? "",
  });

  const book = new ExcelJS.Workbook();
  addQuestionSheet(
    book,
    "Questions",
    rows.map((row) => {
      const values = cells(row);
      return IMPORT_COLUMNS.map((c) => values[c.key]);
    }),
    rows.length + 100
  );
  return Buffer.from(await book.xlsx.writeBuffer());
}

/**
 * An xlsx to fill in and import: the first sheet holds the headers only, since
 * that is the one that gets read, and a second sheet shows filled in examples.
 */
export async function buildImportSample(kind?: "mcq" | "input"): Promise<Buffer> {
  const example = (values: Partial<Record<ImportKey, string>>) =>
    IMPORT_COLUMNS.map((c) => values[c.key] ?? "");

  // The examples follow the kind of assessment being built, so a row can be copied as it is.
  const mcqExamples = [
    example({
      section: "Tillage",
      questionText: "Tillage used on this field",
      answerType: "Multiple choice",
      answers: "No till = 3 | Reduced till = 2 | Conventional = 0",
      evidence: "Optional",
      description: "Optional",
    }),
    example({
      section: "Soil",
      questionText: "Cover crop use",
      answerType: "Score 0 to 3",
      score0: "No cover crops",
      score1: "One species",
      score2: "Two to four species",
      score3: "Five or more species",
    }),
  ];

  const inputExamples = [
    example({
      section: "Trainings",
      questionText: "Date of the training",
      answerType: "Date",
      maxScore: "3",
      guidanceNote: "An admin scores this answer during review.",
    }),
    example({ section: "Trainings", questionText: "Name of the training", answerType: "Short text", maxScore: "3" }),
    example({ section: "Trainings", questionText: "Topics covered", answerType: "Description", maxScore: "3" }),
    example({ section: "Trainings", questionText: "Length in hours", answerType: "Number", maxScore: "3" }),
    example({
      section: "Trainings",
      questionText: "Attendance sheet",
      answerType: "Short text",
      maxScore: "3",
      evidence: "Required",
      description: "Off",
    }),
    example({
      section: "Trainings",
      questionText: "Tier",
      answerType: "Multiple choice",
      answers: "Bronze = 2 | Silver = 3",
    }),
  ];

  if (kind === "input") {
    // A page that explains the file, and one empty form to fill in and copy.
    const book = new ExcelJS.Workbook();
    addGuideSheet(book);
    addFormSheet(book, {
      name: "Your form",
      note: "Rename this tab to the form name, then write your fields across the Field line, one field to a column. A tab still named Your form is not imported. Read Start here for the rest.",
      fields: [],
    });
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  const book = new ExcelJS.Workbook();
  addQuestionSheet(book, "Questions", []);
  addQuestionSheet(book, "Examples", kind === "mcq" ? mcqExamples : [...mcqExamples, ...inputExamples]);
  return Buffer.from(await book.xlsx.writeBuffer());
}
