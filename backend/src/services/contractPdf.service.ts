import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import logger from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";
import { formatDate, formatDateTime, type Clock } from "../utils/datetime.js";

// Builds the signed copy of a contract. The PDF the producer read is kept
// intact and the signature, name and date are written onto its own signature
// line, so the legal wording is never altered. Only a contract that carries no
// signature line at all is signed on a page of its own, in the same style.

export interface SignedContractInput {
  producerName: string;
  producerEmail: string;
  programName: string;
  state: string | null;
  totalAcres: string | null;
  signedName: string;
  signedAt: Date;
  signerIp: string | null;
  // The blank contract the producer signed: an uploaded PDF, or the wording
  // laid out as the same document they read.
  contractPdfUrl?: string | null;
  doc?: ContractDocInput;
  intro?: string | null;
  clauses?: Array<{ heading: string; body: string }>;
  signatureUrl?: string | null;
}

const A4: [number, number] = [595.28, 841.89];
const INK = rgb(0.13, 0.16, 0.16);
const MUTED = rgb(0.45, 0.48, 0.5);

/**
 * Fetches a stored contract PDF so our own endpoint can serve it with the right
 * headers. Files are kept as raw storage objects with no ".pdf" ending, because
 * storage refuses to deliver anything it recognises as a PDF; the browser only
 * ever sees a proper application/pdf response from us.
 */
export async function fetchStoredPdf(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    logger.warn(`Stored contract PDF could not be read (${res.status}): ${url}`);
    throw ApiError.notFound(
      "That contract file could not be opened. Please upload the contract PDF again."
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    logger.warn(`Could not fetch ${url} for the signed contract`, err);
    return null;
  }
}

/** Word-wraps text to a width, returning the lines. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

interface Field {
  x: number;
  width: number;
}

export interface ContractOrg {
  name: string;
  code: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
}

export interface ContractDocInput {
  /** The timezone and clock the organization shows dates with. */
  clock?: Clock;
  /** The contract's own name, which is the document's title. */
  contractName: string;
  org: ContractOrg | null;
  reference: string;
  issuedAt: Date;
  intro?: string | null;
  clauses?: Array<{ heading: string; body: string }>;
}

// Where the three ruled lines ended up, so the signed copy can write on them.
interface DrawnSpot {
  pageIndex: number;
  labelY: number;
  signature: Field;
  fullName: Field;
  date: Field;
  headroom: number;
  footroom: number;
}

// Matches the contract the admin panel exports: same margins, same type, same
// letterhead, so a written contract and an uploaded one look like one family.
const SHEET_MARGIN = 51; // 18mm
const BRAND = rgb(0.075, 0.435, 0.247);
const PAPER_INK = rgb(0.102, 0.114, 0.118);
const PAPER_MUTED = rgb(0.357, 0.392, 0.404);
const HAIRLINE = rgb(0.851, 0.871, 0.875);
const BODY = 10.5;
const LEAD = 15.5;
const DOT = " • ";

interface Fonts {
  serif: PDFFont;
  serifItalic: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatIssued(date: Date, clock?: Clock): string {
  if (clock) return formatDate(date, clock);
  return `${String(date.getUTCDate()).padStart(2, "0")} ${
    MONTH_NAMES[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

/** Width of text drawn with letter spacing. */
function trackedWidth(
  text: string,
  font: PDFFont,
  size: number,
  spacing: number
): number {
  return font.widthOfTextAtSize(text, size) + spacing * Math.max(0, text.length - 1);
}

/** Draws text letter by letter, so headings carry the same tracking. */
function drawTracked(
  page: PDFPage,
  text: string,
  o: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
    spacing: number;
  }
): void {
  let x = o.x;
  for (const ch of text) {
    page.drawText(ch, { x, y: o.y, size: o.size, font: o.font, color: o.color });
    x += o.font.widthOfTextAtSize(ch, o.size) + o.spacing;
  }
}

/** One paragraph, justified the way the exported contract is. */
function drawParagraph(
  page: PDFPage,
  text: string,
  o: {
    x: number;
    y: number;
    width: number;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
    lead: number;
  }
): number {
  let y = o.y;
  const lines = wrap(text, o.font, o.size, o.width);
  lines.forEach((line, i) => {
    const words = line.split(" ").filter(Boolean);
    const lineWidth = o.font.widthOfTextAtSize(line, o.size);
    const last = i === lines.length - 1;
    if (last || words.length < 2 || lineWidth >= o.width) {
      page.drawText(line, { x: o.x, y, size: o.size, font: o.font, color: o.color });
    } else {
      const extra = (o.width - lineWidth) / (words.length - 1);
      let x = o.x;
      for (const word of words) {
        page.drawText(word, { x, y, size: o.size, font: o.font, color: o.color });
        x += o.font.widthOfTextAtSize(`${word} `, o.size) + extra;
      }
    }
    y -= o.lead;
  });
  return y;
}

interface ExecutionBlock {
  labelY: number;
  columns: Array<[string, number, number]>;
}

/** The block a contract is executed in: the note, and the three ruled lines. */
function drawExecutionBlock(
  page: PDFPage,
  top: number,
  width: number,
  fonts: Fonts
): ExecutionBlock {
  const right = SHEET_MARGIN + width;
  let y = top - 8;
  page.drawLine({
    start: { x: SHEET_MARGIN, y },
    end: { x: right, y },
    thickness: 1,
    color: PAPER_INK,
  });
  y -= 17;
  drawTracked(page, "EXECUTION", {
    x: SHEET_MARGIN,
    y,
    size: 9.5,
    font: fonts.sansBold,
    color: PAPER_INK,
    spacing: 1,
  });
  y -= 14;
  page.drawText(
    "Signed by the Producer on the date shown. An electronic signature has the same effect as a handwritten one.",
    { x: SHEET_MARGIN, y, size: 9, font: fonts.serif, color: PAPER_MUTED }
  );
  y -= 22;
  drawTracked(page, "THE PRODUCER", {
    x: SHEET_MARGIN,
    y,
    size: 8,
    font: fonts.sans,
    color: PAPER_MUTED,
    spacing: 1,
  });
  y -= 44;

  const gap = 26;
  const sigWidth = (width - gap * 2) * 0.42;
  const restWidth = (width - gap * 2 - sigWidth) / 2;
  const columns: Array<[string, number, number]> = [
    ["Signature", SHEET_MARGIN, sigWidth],
    ["Full name", SHEET_MARGIN + sigWidth + gap, restWidth],
    ["Date", SHEET_MARGIN + sigWidth + gap + restWidth + gap, restWidth],
  ];
  for (const [, x, w] of columns) {
    page.drawLine({
      start: { x, y },
      end: { x: x + w, y },
      thickness: 1,
      color: PAPER_INK,
    });
  }
  const labelY = y - 12;
  for (const [label, x] of columns) {
    page.drawText(label, {
      x,
      y: labelY,
      size: 7.8,
      font: fonts.sans,
      color: PAPER_MUTED,
    });
  }
  return { labelY, columns };
}

/**
 * Lays the contract out as the document it is, the same way the admin panel
 * exports one: letterhead, title, wording, and the lines it is signed on.
 */
async function renderContract(
  pdf: PDFDocument,
  input: ContractDocInput,
  fonts: Fonts
): Promise<DrawnSpot> {
  const width = A4[0] - SHEET_MARGIN * 2;
  let page = pdf.addPage(A4);
  let y = A4[1] - SHEET_MARGIN;
  const orgName = input.org?.name?.trim() || "iiGrain";

  const room = (needed: number) => {
    if (y - needed < SHEET_MARGIN + 30) {
      page = pdf.addPage(A4);
      y = A4[1] - SHEET_MARGIN;
    }
  };

  // Letterhead: the organization on the left, this document's details right.
  const headTop = y;
  let brandX = SHEET_MARGIN;
  if (input.org?.logoUrl) {
    const bytes = await fetchBytes(input.org.logoUrl);
    if (bytes) {
      try {
        const lower = input.org.logoUrl.toLowerCase();
        const img =
          lower.includes(".jpg") || lower.includes(".jpeg")
            ? await pdf.embedJpg(bytes)
            : await pdf.embedPng(bytes);
        const h = 26;
        const w = (img.width / img.height) * h;
        page.drawImage(img, { x: brandX, y: headTop - h + 5, width: w, height: h });
        brandX += w + 8;
      } catch (err) {
        logger.warn("Could not put the organization logo on the contract", err);
      }
    }
  }
  page.drawText(orgName, {
    x: brandX,
    y: headTop - 15,
    size: 15,
    font: fonts.sansBold,
    color: BRAND,
  });

  const right = SHEET_MARGIN + width;
  let metaY = headTop - 6;
  for (const [label, value] of [
    ["Document", input.reference],
    ["Issued", formatIssued(input.issuedAt, input.clock)],
    ["Version", "1.0"],
  ] as Array<[string, string]>) {
    const valueWidth = fonts.sans.widthOfTextAtSize(` ${value}`, 7.8);
    const labelWidth = fonts.sansBold.widthOfTextAtSize(label, 7.8);
    page.drawText(label, {
      x: right - valueWidth - labelWidth,
      y: metaY,
      size: 7.8,
      font: fonts.sansBold,
      color: PAPER_INK,
    });
    page.drawText(` ${value}`, {
      x: right - valueWidth,
      y: metaY,
      size: 7.8,
      font: fonts.sans,
      color: PAPER_MUTED,
    });
    metaY -= 11.5;
  }

  y = Math.min(headTop - 32, metaY - 3);
  page.drawLine({
    start: { x: SHEET_MARGIN, y },
    end: { x: right, y },
    thickness: 2,
    color: BRAND,
  });
  y -= 12;

  const contact = [input.org?.address, input.org?.contactEmail, input.org?.contactPhone]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(DOT);
  if (contact) {
    page.drawText(contact, {
      x: SHEET_MARGIN,
      y,
      size: 7.5,
      font: fonts.sans,
      color: PAPER_MUTED,
    });
    y -= 8;
    page.drawLine({
      start: { x: SHEET_MARGIN, y },
      end: { x: right, y },
      thickness: 1,
      color: HAIRLINE,
    });
  }
  y -= 28;

  // Title
  const title = input.contractName.toUpperCase();
  drawTracked(page, title, {
    x: SHEET_MARGIN + (width - trackedWidth(title, fonts.sansBold, 13, 1.6)) / 2,
    y,
    size: 13,
    font: fonts.sansBold,
    color: PAPER_INK,
    spacing: 1.6,
  });
  y -= 16;
  const subtitle = "Program participation agreement";
  page.drawText(subtitle, {
    x: SHEET_MARGIN + (width - fonts.serifItalic.widthOfTextAtSize(subtitle, 9.5)) / 2,
    y,
    size: 9.5,
    font: fonts.serifItalic,
    color: PAPER_MUTED,
  });
  y -= 26;

  // Recitals
  for (const text of [
    ...(input.intro ? [input.intro] : []),
    `This Agreement is entered into between ${orgName} (the "Program Operator") and the undersigned producer (the "Producer"), and takes effect on the date of signature below. By signing, the Producer confirms they have read, understood and accept the terms set out in this Agreement.`,
  ]) {
    room(LEAD * 3);
    y = drawParagraph(page, text, {
      x: SHEET_MARGIN,
      y,
      width,
      size: BODY,
      font: fonts.serif,
      color: PAPER_INK,
      lead: LEAD,
    }) - 5;
  }

  // Clauses
  const indent = 22;
  (input.clauses ?? []).forEach((c, i) => {
    room(54);
    // A number the admin typed into the heading is not repeated.
    const heading = c.heading.replace(/^\s*\d+[.)]\s*/, "").toUpperCase();
    page.drawText(`${i + 1}.`, {
      x: SHEET_MARGIN,
      y,
      size: 10,
      font: fonts.sansBold,
      color: PAPER_INK,
    });
    drawTracked(page, heading, {
      x: SHEET_MARGIN + indent,
      y,
      size: 10,
      font: fonts.sansBold,
      color: PAPER_INK,
      spacing: 0.4,
    });
    y -= 16;
    for (const part of c.body.split(/\n{2,}/)) {
      room(LEAD * 2);
      y = drawParagraph(page, part, {
        x: SHEET_MARGIN + indent,
        y,
        width: width - indent,
        size: BODY,
        font: fonts.serif,
        color: PAPER_INK,
        lead: LEAD,
      }) - 4;
    }
    y -= 6;
  });

  // Execution, kept whole on whichever page it lands on.
  room(150);
  const execution = drawExecutionBlock(page, y, width, fonts);
  const { labelY, columns } = execution;
  y = labelY;

  // Footer
  const footerY = labelY - 30;
  page.drawLine({
    start: { x: SHEET_MARGIN, y: footerY + 12 },
    end: { x: right, y: footerY + 12 },
    thickness: 1,
    color: HAIRLINE,
  });
  page.drawText(`${orgName}${DOT}${input.contractName}`, {
    x: SHEET_MARGIN,
    y: footerY,
    size: 7.2,
    font: fonts.sans,
    color: PAPER_MUTED,
  });
  page.drawText(input.reference, {
    x: right - fonts.sans.widthOfTextAtSize(input.reference, 7.2),
    y: footerY,
    size: 7.2,
    font: fonts.sans,
    color: PAPER_MUTED,
  });

  return {
    pageIndex: pdf.getPageCount() - 1,
    labelY,
    signature: { x: columns[0][1], width: columns[0][2] },
    fullName: { x: columns[1][1], width: columns[1][2] },
    date: { x: columns[2][1], width: columns[2][2] },
    headroom: 30,
    footroom: labelY - footerY,
  };
}

async function loadFonts(pdf: PDFDocument): Promise<Fonts> {
  const [serif, serifItalic, sans, sansBold] = await Promise.all([
    pdf.embedFont(StandardFonts.TimesRoman),
    pdf.embedFont(StandardFonts.TimesRomanItalic),
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);
  return { serif, serifItalic, sans, sansBold };
}

/** The blank contract, as the producer reads it before signing. */
export async function buildContractPdf(
  input: ContractDocInput
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  await renderContract(pdf, input, await loadFonts(pdf));
  return pdf.save();
}

/**
 * A contract that carries no signature line of its own is signed on a page in
 * the same style, not on a summary sheet of a different design.
 */
async function appendExecutionPage(
  pdf: PDFDocument,
  input: SignedContractInput,
  script: PDFFont
): Promise<void> {
  const fonts = await loadFonts(pdf);
  const page = pdf.addPage(A4);
  const width = A4[0] - SHEET_MARGIN * 2;
  const right = SHEET_MARGIN + width;
  let y = A4[1] - SHEET_MARGIN;
  const orgName = input.doc?.org?.name?.trim() || input.programName;

  page.drawText(orgName, {
    x: SHEET_MARGIN,
    y,
    size: 15,
    font: fonts.sansBold,
    color: BRAND,
  });
  y -= 12;
  page.drawLine({
    start: { x: SHEET_MARGIN, y },
    end: { x: right, y },
    thickness: 2,
    color: BRAND,
  });
  y -= 26;
  const title = (input.doc?.contractName ?? "Program contract").toUpperCase();
  drawTracked(page, title, {
    x: SHEET_MARGIN + (width - trackedWidth(title, fonts.sansBold, 13, 1.6)) / 2,
    y,
    size: 13,
    font: fonts.sansBold,
    color: PAPER_INK,
    spacing: 1.6,
  });
  y -= 34;

  const { labelY, columns } = drawExecutionBlock(page, y, width, fonts);
  const footerY = labelY - 30;
  page.drawLine({
    start: { x: SHEET_MARGIN, y: footerY + 12 },
    end: { x: right, y: footerY + 12 },
    thickness: 1,
    color: HAIRLINE,
  });
  page.drawText(`${orgName}${DOT}${input.doc?.contractName ?? input.programName}`, {
    x: SHEET_MARGIN,
    y: footerY,
    size: 7.2,
    font: fonts.sans,
    color: PAPER_MUTED,
  });

  await signInPlace(
    pdf,
    {
      pageIndex: pdf.getPageCount() - 1,
      labelY,
      signature: { x: columns[0][1], width: columns[0][2] },
      fullName: { x: columns[1][1], width: columns[1][2] },
      date: { x: columns[2][1], width: columns[2][2] },
      headroom: 30,
      footroom: labelY - footerY,
    },
    input,
    fonts.sans,
    fonts.sansBold,
    script
  );
}

// ---------------------------- Signing in place -----------------------------
// A contract is signed on its own signature line, not on a page tacked onto the
// end. The lines are found by their captions, so the wording is never touched
// and any contract laid out this way works.

interface SignatureSpot {
  pageIndex: number;
  /** Baseline of the captions under the ruled lines. */
  labelY: number;
  signature: Field;
  fullName: Field;
  date: Field;
  /** Clear space above the lines, and below the captions. */
  headroom: number;
  footroom: number;
}

interface TextAt {
  text: string;
  x: number;
  y: number;
  width: number;
}

// Captions of one row sit on the same baseline, give or take rounding.
const SAME_ROW = 3;
const SIGNATURE_MAX_HEIGHT = 30;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function signedOn(date: Date, clock?: Clock): string {
  if (clock) return formatDate(date, clock);
  return `${String(date.getUTCDate()).padStart(2, "0")} ${
    MONTHS[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

/** Locates the signature line, its neighbours, and the room around them. */
async function findSignatureSpot(
  bytes: Uint8Array
): Promise<SignatureSpot | null> {
  let doc;
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    doc = await getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  } catch (err) {
    // Reading the contract's text is what tells us where its signature line
    // is. Without it the contract is still signed, just on its own page.
    logger.warn("Could not read the contract's text to find its signature line", err);
    return null;
  }
  try {
    // The block belongs at the end, so the last page carrying it wins.
    for (let n = doc.numPages; n >= 1; n -= 1) {
      const page = await doc.getPage(n);
      if (page.rotate % 360 !== 0) continue;

      const items: TextAt[] = [];
      for (const item of (await page.getTextContent()).items) {
        if (!("str" in item) || !item.str.trim()) continue;
        items.push({
          text: item.str,
          x: item.transform[4] as number,
          y: item.transform[5] as number,
          width: item.width,
        });
      }

      const pageWidth = page.view[2] - page.view[0];
      // The block sits at the foot of the contract, so the page is read from
      // the bottom up.
      const rows = rowsOf(items).reverse();
      for (const row of rows) {
        const spot = spotInRow(row, items, pageWidth, n - 1);
        if (spot) return spot;
      }
    }
    logger.warn("The contract carries no Signature / Full name / Date line.");
    return null;
  } finally {
    await doc.destroy();
  }
}

/** Groups the text of a page into rows, top to bottom, each left to right. */
function rowsOf(items: TextAt[]): TextAt[][] {
  const rows: TextAt[][] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= SAME_ROW);
    if (row) row.push(item);
    else rows.push([item]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

/**
 * Finds the captions inside one row. A PDF writer is free to break a word into
 * several pieces, so the row is read as one string and each caption is traced
 * back to the piece it starts in.
 */
function spotInRow(
  row: TextAt[],
  all: TextAt[],
  pageWidth: number,
  pageIndex: number
): SignatureSpot | null {
  // The row as one string, remembering where every piece begins.
  let line = "";
  const starts: number[] = [];
  for (const item of row) {
    starts.push(line.length);
    line += item.text;
  }
  const pieceAt = (index: number): TextAt => {
    let found = 0;
    for (let i = 0; i < starts.length; i += 1) if (starts[i] <= index) found = i;
    return row[found];
  };

  const at = (re: RegExp): { item: TextAt; x: number } | null => {
    const match = re.exec(line);
    if (!match) return null;
    const item = pieceAt(match.index);
    // Where the caption itself starts, not where its piece of text does.
    const before = line.slice(starts[row.indexOf(item)], match.index);
    return { item, x: item.x + (before ? approxWidth(before, item) : 0) };
  };

  // Captions, not prose: a paragraph that happens to use these words is not a
  // signature line.
  if (line.length > 60) return null;
  const signature = at(/signature/i);
  const fullName = at(/full\s*name/i);
  // No word boundary here: joining the pieces of a row removes them.
  const date = at(/date/i);
  if (!signature || !fullName || !date) return null;
  if (!(signature.x < fullName.x && fullName.x < date.x)) return null;

  const labelY = signature.item.y;
  const columns = [signature, fullName, date].sort((a, b) => a.x - b.x);
  const widthOf = (i: number) =>
    (columns[i + 1]?.x ?? pageWidth - columns[0].x) - columns[i].x - 12;

  const lineY = labelY + 13;
  const above = all
    .filter((i) => i.y > lineY + 2)
    .reduce((low, i) => Math.min(low, i.y), Number.POSITIVE_INFINITY);
  const below = all
    .filter((i) => i.y < labelY - 6)
    .reduce((high, i) => Math.max(high, i.y), 0);

  return {
    pageIndex,
    labelY,
    signature: { x: signature.x, width: widthOf(columns.indexOf(signature)) },
    fullName: { x: fullName.x, width: widthOf(columns.indexOf(fullName)) },
    date: { x: date.x, width: widthOf(columns.indexOf(date)) },
    headroom: Number.isFinite(above) ? above - lineY - 4 : SIGNATURE_MAX_HEIGHT,
    footroom: below > 0 ? labelY - below : labelY,
  };
}

/** Roughly how wide a slice of a text piece is, from the piece's own width. */
function approxWidth(slice: string, item: TextAt): number {
  return item.text.length ? (item.width / item.text.length) * slice.length : 0;
}

/**
 * Some contracts arrive with their text turned into outlines - a print driver
 * that draws letters as shapes leaves nothing to search for. The signature
 * block is still there as three ruled lines, so it is found by its shape:
 * three short horizontal rules sharing a baseline in the lower part of a page.
 */
async function findSignatureRules(
  bytes: Uint8Array
): Promise<SignatureSpot | null> {
  let doc;
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false })
      .promise;
    const { OPS } = pdfjs;
    for (let n = doc.numPages; n >= 1; n -= 1) {
      const page = await doc.getPage(n);
      if (page.rotate % 360 !== 0) continue;
      const pageHeight = page.view[3] - page.view[1];
      const shapes = shapesOf(await page.getOperatorList(), OPS);
      const spot = signatureRow(shapes, pageHeight, n - 1);
      if (spot) return spot;
    }
    return null;
  } catch (err) {
    logger.warn("Could not read the contract's shapes to find its signature line", err);
    return null;
  } finally {
    await doc?.destroy();
  }
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function combine(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Every drawn shape on a page, in the page's own coordinates. */
function shapesOf(
  ops: { fnArray: number[]; argsArray: unknown[] },
  OPS: Record<string, number>
): Box[] {
  const shapes: Box[] = [];
  let ctm: Matrix = IDENTITY;
  const stack: Matrix[] = [];
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? IDENTITY;
    else if (fn === OPS.transform)
      ctm = combine(ctm, ops.argsArray[i] as Matrix);
    else if (fn === OPS.constructPath) {
      const args = ops.argsArray[i] as [number[], number[], number[]];
      const box = args[2];
      if (!box || box.length < 4) continue;
      const [ax, ay] = apply(ctm, box[0], box[1]);
      const [bx, by] = apply(ctm, box[2], box[3]);
      shapes.push({
        x0: Math.min(ax, bx),
        y0: Math.min(ay, by),
        x1: Math.max(ax, bx),
        y1: Math.max(ay, by),
      });
    }
  }
  return shapes;
}

// A ruled line: long, and no thicker than a rule.
const RULE_MAX_THICKNESS = 3.5;
const RULE_MIN_LENGTH = 60;
const SAME_RULE_ROW = 2.5;

function signatureRow(
  shapes: Box[],
  pageHeight: number,
  pageIndex: number
): SignatureSpot | null {
  const rules = shapes.filter(
    (s) => s.y1 - s.y0 <= RULE_MAX_THICKNESS && s.x1 - s.x0 >= RULE_MIN_LENGTH
  );
  const rows = new Map<number, Box[]>();
  for (const rule of rules) {
    const y = (rule.y0 + rule.y1) / 2;
    const key = [...rows.keys()].find((k) => Math.abs(k - y) <= SAME_RULE_ROW);
    if (key === undefined) rows.set(y, [rule]);
    else rows.get(key)!.push(rule);
  }

  // Three rules side by side, in the lower half: that is where a contract is
  // signed. The lowest such row wins, the way the block sits above the footer.
  const candidates = [...rows.entries()]
    .filter(([y, list]) => list.length === 3 && y < pageHeight * 0.55)
    .sort((a, b) => a[0] - b[0]);
  const found = candidates[0];
  if (!found) return null;

  const [ruleY, list] = found;
  const columns = [...list].sort((a, b) => a.x0 - b.x0);
  // The captions sit just under the rules, which is where the values go.
  const labelY = ruleY - 13;
  const above = shapes
    .filter((s) => s.y0 > ruleY + 2 && s.x0 < columns[2].x1 && s.x1 > columns[0].x0)
    .reduce((low, s) => Math.min(low, s.y0), Number.POSITIVE_INFINITY);
  const below = shapes
    .filter((s) => s.y1 < labelY - 4)
    .reduce((high, s) => Math.max(high, s.y1), 0);

  return {
    pageIndex,
    labelY,
    signature: { x: columns[0].x0, width: columns[0].x1 - columns[0].x0 },
    fullName: { x: columns[1].x0, width: columns[1].x1 - columns[1].x0 },
    date: { x: columns[2].x0, width: columns[2].x1 - columns[2].x0 },
    headroom: Number.isFinite(above) ? above - ruleY - 4 : SIGNATURE_MAX_HEIGHT,
    footroom: below > 0 ? labelY - below : 20,
  };
}

/** Writes the signature, name and date onto the contract's own lines. */
async function signInPlace(
  pdf: PDFDocument,
  spot: SignatureSpot,
  input: SignedContractInput,
  font: PDFFont,
  bold: PDFFont,
  script: PDFFont
): Promise<void> {
  const page = pdf.getPage(spot.pageIndex);
  const valueY = spot.labelY + 16;

  page.drawText(input.signedName, {
    x: spot.fullName.x,
    y: valueY,
    size: 10,
    font: bold,
    color: INK,
  });
  page.drawText(signedOn(input.signedAt, input.doc?.clock), {
    x: spot.date.x,
    y: valueY,
    size: 10,
    font: bold,
    color: INK,
  });

  const roomAbove = Math.max(14, Math.min(SIGNATURE_MAX_HEIGHT, spot.headroom + 4));
  let drewImage = false;
  if (input.signatureUrl) {
    const bytes = await fetchBytes(input.signatureUrl);
    if (bytes) {
      try {
        const lower = input.signatureUrl.toLowerCase();
        const img =
          lower.includes(".jpg") || lower.includes(".jpeg")
            ? await pdf.embedJpg(bytes)
            : await pdf.embedPng(bytes);
        const scale = Math.min(
          spot.signature.width / img.width,
          roomAbove / img.height,
          1
        );
        // Sitting on the line, the way a signature is written on paper.
        page.drawImage(img, {
          x: spot.signature.x,
          y: spot.labelY + 11,
          width: img.width * scale,
          height: img.height * scale,
        });
        drewImage = true;
      } catch (err) {
        logger.warn("Could not embed the signature image", err);
      }
    }
  }
  if (!drewImage) {
    // Typed, so it is written on the line the way a name is signed.
    page.drawText(input.signedName, {
      x: spot.signature.x,
      y: spot.labelY + 15,
      size: Math.min(15, roomAbove),
      font: script,
      color: INK,
    });
  }

  // The evidence a signed document carries, kept to one discreet line.
  if (spot.footroom >= 12) {
    page.drawText(
      input.doc?.clock
        ? `Signed electronically on ${formatDateTime(input.signedAt, input.doc.clock)}${
            input.signerIp ? ` from ${input.signerIp}` : ""
          }.`
        : `Signed electronically on ${signedOn(input.signedAt)} at ${input.signedAt
            .toISOString()
            .slice(11, 16)} UTC${input.signerIp ? ` from ${input.signerIp}` : ""}.`,
      { x: spot.signature.x, y: spot.labelY - 11, size: 6.5, font, color: MUTED }
    );
  }
}

/** Returns the signed contract as PDF bytes. */
export async function buildSignedContractPdf(
  input: SignedContractInput
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const script = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  // Keep the uploaded contract exactly as the producer saw it.
  let signedInPlace = false;
  if (input.contractPdfUrl) {
    const bytes = await fetchBytes(input.contractPdfUrl);
    if (bytes) {
      let carriedOver = false;
      try {
        const source = await PDFDocument.load(bytes);
        const pages = await pdf.copyPages(source, source.getPageIndices());
        for (const p of pages) pdf.addPage(p);
        carriedOver = true;
      } catch (err) {
        logger.warn("Could not read the uploaded contract PDF", err);
      }
      // Its own step: a lookup that fails must not cost us the pages, and it
      // has to say so in the log rather than quietly adding a page later.
      if (carriedOver) {
        const spot =
          (await findSignatureSpot(bytes)) ?? (await findSignatureRules(bytes));
        if (spot) {
          await signInPlace(pdf, spot, input, font, bold, script);
          signedInPlace = true;
        } else {
          logger.warn(
            "No signature line found in the uploaded contract; signing on a page of its own instead."
          );
        }
      }
    }
  }
  // No PDF (or it could not be read): lay the wording out as the same document
  // the producer read, and sign it on its own lines.
  if (pdf.getPageCount() === 0 && input.doc) {
    const spot = await renderContract(pdf, input.doc, await loadFonts(pdf));
    await signInPlace(pdf, spot, input, font, bold, script);
    signedInPlace = true;
  }

  // Only where the contract carries no signature line of its own: the same
  // execution block the contracts use, never a summary of its own design.
  if (!signedInPlace) {
    await appendExecutionPage(pdf, input, script);
  }
  return pdf.save();
}
