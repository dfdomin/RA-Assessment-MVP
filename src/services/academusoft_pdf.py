"""Parse Academusoft 4.0 «Listado de Estudiantes Inscritos» PDF reports (ADR-0002)."""

from __future__ import annotations

import io
import re
import unicodedata
from dataclasses import dataclass

import pdfplumber

_FOOTER_MARKERS = (
    "señor docente",
    "legalizar matrícula",
    "legalizar matricula",
)
_HEADER_ROW_LABELS = ("no.", "documento", "código", "codigo", "nombre completo")
_ROW_RE = re.compile(
    r"^\s*(\d+)\s+(?:TI|CC)\s*-\s*(\d+)\s+\S+\s+(.+?)\s*$",
    re.IGNORECASE,
)
_MATERIA_LINE_RE = re.compile(
    r"^(.+?)\s+([0-9][0-9A-Z_]+)\s*$",
    re.IGNORECASE,
)
_COURSE_CODE_RE = re.compile(r"^([A-Z0-9]+)-", re.IGNORECASE)


@dataclass(frozen=True)
class AcademusoftPdfHeader:
    materia: str
    course_code: str
    group_name: str


@dataclass(frozen=True)
class AcademusoftPdfRow:
    roster_position: int
    document_number: str
    full_name: str


@dataclass(frozen=True)
class AcademusoftPdfParseResult:
    header: AcademusoftPdfHeader
    rows: list[AcademusoftPdfRow]


class AcademusoftPdfError(ValueError):
    """Base error for PDF parsing or validation."""


class AcademusoftPdfModuleMismatchError(AcademusoftPdfError):
    """PDF Materia/Grupo do not match the open module."""

    def __init__(self, pdf_materia: str, pdf_group: str, module_course_code: str, module_group: str):
        self.pdf_materia = pdf_materia
        self.pdf_group = pdf_group
        self.module_course_code = module_course_code
        self.module_group = module_group
        super().__init__(
            "Este PDF es de "
            f"{pdf_materia} / {pdf_group}; "
            f"usted está en {module_course_code} / {module_group}."
        )


def _normalize_token(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value.strip())
    ascii_only = "".join(ch for ch in folded if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_only).upper()


def _extract_text(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        if not pdf.pages:
            raise AcademusoftPdfError("PDF vacío")
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def _is_footer_line(line: str) -> bool:
    lowered = line.strip().lower()
    return any(marker in lowered for marker in _FOOTER_MARKERS)


def _parse_header(lines: list[str]) -> AcademusoftPdfHeader:
    for index, line in enumerate(lines):
        if "materia" in line.lower() and "grupo" in line.lower():
            if index + 1 >= len(lines):
                break
            materia_line = lines[index + 1].strip()
            match = _MATERIA_LINE_RE.match(materia_line)
            if not match:
                raise AcademusoftPdfError(
                    f"No se pudo leer Materia/Grupo del PDF: {materia_line!r}"
                )
            materia = match.group(1).strip()
            group_name = match.group(2).strip()
            code_match = _COURSE_CODE_RE.match(materia)
            if not code_match:
                raise AcademusoftPdfError(f"No se pudo leer el código de materia: {materia!r}")
            return AcademusoftPdfHeader(
                materia=materia,
                course_code=code_match.group(1).upper(),
                group_name=group_name,
            )
    raise AcademusoftPdfError("Encabezado Materia/Grupo no encontrado en el PDF")


def _parse_rows_from_tables(content: bytes) -> list[AcademusoftPdfRow]:
    rows: list[AcademusoftPdfRow] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                if not table:
                    continue
                header_idx = None
                for idx, raw_row in enumerate(table):
                    cells = [str(cell or "").strip().lower() for cell in raw_row]
                    if "documento" in cells and any("nombre" in cell for cell in cells):
                        header_idx = idx
                        break
                if header_idx is None:
                    continue
                for raw_row in table[header_idx + 1 :]:
                    if not raw_row or len(raw_row) < 4:
                        continue
                    line = " ".join(str(cell or "").strip() for cell in raw_row if cell)
                    parsed = _ROW_RE.match(line)
                    if parsed:
                        rows.append(
                            AcademusoftPdfRow(
                                roster_position=int(parsed.group(1)),
                                document_number=parsed.group(2),
                                full_name=parsed.group(3).strip(),
                            )
                        )
    return rows


def _parse_rows_from_text(text: str) -> list[AcademusoftPdfRow]:
    rows: list[AcademusoftPdfRow] = []
    for line in text.splitlines():
        if _is_footer_line(line):
            break
        match = _ROW_RE.match(line)
        if not match:
            continue
        rows.append(
            AcademusoftPdfRow(
                roster_position=int(match.group(1)),
                document_number=match.group(2),
                full_name=match.group(3).strip(),
            )
        )
    return rows


def parse_academusoft_pdf(content: bytes) -> AcademusoftPdfParseResult:
    text = _extract_text(content)
    lines = text.splitlines()
    header = _parse_header(lines)

    rows = _parse_rows_from_tables(content)
    if len(rows) < 1:
        rows = _parse_rows_from_text(text)

    if not rows:
        raise AcademusoftPdfError("No se encontraron estudiantes en el PDF")

    seen_positions: set[int] = set()
    deduped: list[AcademusoftPdfRow] = []
    for row in sorted(rows, key=lambda item: item.roster_position):
        if row.roster_position in seen_positions:
            continue
        seen_positions.add(row.roster_position)
        deduped.append(row)

    return AcademusoftPdfParseResult(header=header, rows=deduped)


def validate_pdf_header_for_module(
    header: AcademusoftPdfHeader,
    *,
    course_code: str,
    group_name: str,
) -> None:
    if _normalize_token(header.group_name) != _normalize_token(group_name):
        raise AcademusoftPdfModuleMismatchError(
            header.materia,
            header.group_name,
            course_code,
            group_name,
        )
    if not _normalize_token(header.materia).startswith(_normalize_token(course_code) + "-"):
        if _normalize_token(header.course_code) != _normalize_token(course_code):
            raise AcademusoftPdfModuleMismatchError(
                header.materia,
                header.group_name,
                course_code,
                group_name,
            )
