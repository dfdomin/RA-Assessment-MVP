/**
 * Academusoft 4.0 «Listado de Estudiantes Inscritos» — ADR-0002
 * Mirror of src/services/academusoft_pdf.py for Supabase Edge (Deno).
 */
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const FOOTER_MARKERS = [
  "señor docente",
  "legalizar matrícula",
  "legalizar matricula",
];

const ROW_RE =
  /^\s*(\d+)\s+(?:TI|CC)\s*-\s*(\d+)\s+\S+\s+(.+?)\s*$/i;
const MATERIA_LINE_RE = /^(.+?)\s+([0-9][0-9A-Z_]+)\s*$/i;
const COURSE_CODE_RE = /^([A-Z0-9]+)-/i;

export type AcademusoftPdfHeader = {
  materia: string;
  course_code: string;
  group_name: string;
};

export type AcademusoftPdfRow = {
  roster_position: number;
  document_number: string;
  full_name: string;
};

export type AcademusoftPdfParseResult = {
  header: AcademusoftPdfHeader;
  rows: AcademusoftPdfRow[];
};

export class AcademusoftPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademusoftPdfError";
  }
}

export class AcademusoftPdfModuleMismatchError extends AcademusoftPdfError {
  constructor(
    public pdfMateria: string,
    public pdfGroup: string,
    public moduleCourseCode: string,
    public moduleGroup: string,
  ) {
    super(
      `Este PDF es de ${pdfMateria} / ${pdfGroup}; usted está en ${moduleCourseCode} / ${moduleGroup}.`,
    );
    this.name = "AcademusoftPdfModuleMismatchError";
  }
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

async function extractPdfText(content: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(content);
  const { text } = await extractText(pdf, { mergePages: true });
  if (!text || !text.trim()) {
    throw new AcademusoftPdfError("PDF vacío o sin texto extraíble");
  }
  return text;
}

function isFooterLine(line: string): boolean {
  const lowered = line.trim().toLowerCase();
  return FOOTER_MARKERS.some((marker) => lowered.includes(marker));
}

function parseHeader(lines: string[]): AcademusoftPdfHeader {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.toLowerCase().includes("materia") || !line.toLowerCase().includes("grupo")) {
      continue;
    }
    const materiaLine = (lines[index + 1] ?? "").trim();
    const match = MATERIA_LINE_RE.exec(materiaLine);
    if (!match) {
      throw new AcademusoftPdfError(
        `No se pudo leer Materia/Grupo del PDF: ${materiaLine}`,
      );
    }
    const materia = match[1].trim();
    const groupName = match[2].trim();
    const codeMatch = COURSE_CODE_RE.exec(materia);
    if (!codeMatch) {
      throw new AcademusoftPdfError(`No se pudo leer el código de materia: ${materia}`);
    }
    return {
      materia,
      course_code: codeMatch[1].toUpperCase(),
      group_name: groupName,
    };
  }
  throw new AcademusoftPdfError("Encabezado Materia/Grupo no encontrado en el PDF");
}

function parseRowsFromText(text: string): AcademusoftPdfRow[] {
  const rows: AcademusoftPdfRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (isFooterLine(line)) break;
    const match = ROW_RE.exec(line);
    if (!match) continue;
    rows.push({
      roster_position: Number(match[1]),
      document_number: match[2],
      full_name: match[3].trim(),
    });
  }
  return rows;
}

export async function parseAcademusoftPdf(
  content: Uint8Array,
): Promise<AcademusoftPdfParseResult> {
  const text = await extractPdfText(content);
  const lines = text.split(/\r?\n/);
  const header = parseHeader(lines);
  const rows = parseRowsFromText(text);

  if (!rows.length) {
    throw new AcademusoftPdfError("No se encontraron estudiantes en el PDF");
  }

  const seen = new Set<number>();
  const deduped: AcademusoftPdfRow[] = [];
  for (const row of [...rows].sort((a, b) => a.roster_position - b.roster_position)) {
    if (seen.has(row.roster_position)) continue;
    seen.add(row.roster_position);
    deduped.push(row);
  }

  return { header, rows: deduped };
}

export function validatePdfHeaderForModule(
  header: AcademusoftPdfHeader,
  courseCode: string,
  groupName: string,
): void {
  if (normalizeToken(header.group_name) !== normalizeToken(groupName)) {
    throw new AcademusoftPdfModuleMismatchError(
      header.materia,
      header.group_name,
      courseCode,
      groupName,
    );
  }
  const materiaNorm = normalizeToken(header.materia);
  const codeNorm = normalizeToken(courseCode);
  if (!materiaNorm.startsWith(`${codeNorm}-`)) {
    if (normalizeToken(header.course_code) !== codeNorm) {
      throw new AcademusoftPdfModuleMismatchError(
        header.materia,
        header.group_name,
        courseCode,
        groupName,
      );
    }
  }
}
