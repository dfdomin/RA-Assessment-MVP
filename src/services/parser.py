import csv
import io
import re
from zipfile import BadZipFile

import openpyxl
from fastapi import HTTPException, UploadFile, status

MAX_FILE_BYTES = 2 * 1024 * 1024
FORMULA_PREFIXES = frozenset("=+-@|%")
ALLOWED_MIME_TYPES = frozenset({
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
})

SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,50}$")
SAFE_DOC_RE = re.compile(r"^[A-Za-z0-9_.-]{3,50}$")
SAFE_CODE_RE = re.compile(r"^[A-Za-z0-9_.-]{1,30}$")
SAFE_GROUP_RE = re.compile(r"^[A-Za-z0-9_.-]{1,20}$")
SAFE_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SAFE_NAME_RE = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,'()/-]{1,200}$")


def normalize_header(value: str) -> str:
    return value.strip().lower()


def ensure_no_formula(value: str) -> str:
    stripped = value.strip()
    if stripped and stripped[0] in FORMULA_PREFIXES:
        raise ValueError(f"Formula injection detected: {stripped[:20]!r}")
    return stripped


def validate_regex(value: str, pattern: re.Pattern[str], field: str) -> str:
    if not pattern.fullmatch(value):
        raise ValueError(f"Invalid {field}")
    return value


async def parse_upload_rows(
    file: UploadFile,
    required_columns: set[str],
) -> list[dict[str, str]]:
    content_type = (file.content_type or "").split(";")[0].strip()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Use text/csv or .xlsx",
        )

    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 2 MB limit",
        )

    try:
        rows = _parse_csv(content) if content_type == "text/csv" else _parse_xlsx(content)
    except (ValueError, UnicodeDecodeError, BadZipFile) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    if not rows:
        return []

    missing = required_columns - set(rows[0])
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Missing columns: {', '.join(sorted(missing))}",
        )
    return rows


def _parse_csv(content: bytes) -> list[dict[str, str]]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("Empty CSV file")
    headers = [normalize_header(header) for header in reader.fieldnames]
    rows = []
    for row in reader:
        rows.append({
            header: str(row.get(raw_header) or "").strip()
            for raw_header, header in zip(reader.fieldnames, headers)
        })
    return rows


def _parse_xlsx(content: bytes) -> list[dict[str, str]]:
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    if ws is None:
        wb.close()
        raise ValueError("XLSX file has no active sheet")
    all_rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not all_rows:
        raise ValueError("Empty XLSX file")
    headers = [normalize_header(str(cell)) if cell is not None else "" for cell in all_rows[0]]
    rows = []
    for raw_row in all_rows[1:]:
        padded = raw_row + (None,) * max(0, len(headers) - len(raw_row))
        rows.append({
            header: str(cell).strip() if cell is not None else ""
            for header, cell in zip(headers, padded)
        })
    return rows
