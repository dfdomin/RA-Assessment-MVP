import csv
import io
from dataclasses import dataclass
from zipfile import BadZipFile

import openpyxl
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import ensure_module_period_open, get_current_user, get_db, verify_module_ownership
from src.api.schemas.students import (
    ActivePerfIndicatorSummary,
    ModuleStudentsResponse,
    ModuleStudentSummary,
    StudentAssessmentSummary,
    StudentImportPreviewResponse,
    StudentImportPreviewRow,
    StudentImportResponse,
    StudentImportRow,
)
from src.models.assessment import Assessment
from src.models.module import Module
from src.models.period import Period
from src.models.program import ProgramMembership
from src.models.rubric import PerfIndicator
from src.models.security import SecurityEvent
from src.models.student_outcome import StudentOutcome
from src.models.student import ModuleStudent, Student
from src.models.user import User
from src.services.academusoft_pdf import (
    AcademusoftPdfError,
    AcademusoftPdfHeader,
    AcademusoftPdfModuleMismatchError,
    parse_academusoft_pdf,
    validate_pdf_header_for_module,
)

router = APIRouter(tags=["students"])

_MAX_FILE_BYTES = 2 * 1024 * 1024  # 2 MB
_MAX_STUDENTS = 100
_FORMULA_CHARS = frozenset("=+-@|%")
_REQUIRED_COLUMNS = {"internal_id", "document_number", "full_name"}
_ALLOWED_MIME = frozenset({
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/pdf",
})
_PDF_MIME = "application/pdf"


@dataclass(frozen=True)
class NormalizedImportRow:
    roster_position: int
    document_number: str
    full_name: str
    internal_id: str


async def _get_module_for_read(
    module_id: int,
    current_user: User,
    db: AsyncSession,
) -> Module:
    if current_user.role == "admin":
        module = await db.get(Module, module_id)
        if module is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
        return module

    if current_user.role == "leader":
        result = await db.execute(
            select(Module)
            .join(Period, Module.period_id == Period.id)
            .join(StudentOutcome, Period.student_outcome_id == StudentOutcome.id)
            .join(ProgramMembership, ProgramMembership.program_id == StudentOutcome.program_id)
            .where(Module.id == module_id, ProgramMembership.user_id == current_user.id)
        )
        module = result.scalar_one_or_none()
        if module is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
        return module

    return await verify_module_ownership(module_id, current_user, db)


def _check_formula(value: str) -> str:
    stripped = value.strip()
    if stripped and stripped[0] in _FORMULA_CHARS:
        raise ValueError(f"Formula injection: {stripped[:20]!r}")
    return stripped


def _parse_csv(content: bytes) -> list[dict[str, str]]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("Empty CSV file")
    headers_normalized = {f.strip().lower() for f in reader.fieldnames}
    missing = _REQUIRED_COLUMNS - headers_normalized
    if missing:
        raise ValueError(f"Missing columns: {', '.join(sorted(missing))}")
    return [{k.strip().lower(): (v or "") for k, v in row.items()} for row in reader]


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
    headers = [str(cell).strip().lower() if cell is not None else "" for cell in all_rows[0]]
    missing = _REQUIRED_COLUMNS - set(headers)
    if missing:
        raise ValueError(f"Missing columns: {', '.join(sorted(missing))}")
    rows = []
    for raw_row in all_rows[1:]:
        padded = raw_row + (None,) * max(0, len(headers) - len(raw_row))
        rows.append({
            header: str(cell).strip() if cell is not None else ""
            for header, cell in zip(headers, padded)
        })
    return rows


async def _read_upload_file(file: UploadFile) -> tuple[str, bytes]:
    content_type = (file.content_type or "").split(";")[0].strip()
    if content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported file type. Use application/pdf, text/csv or .xlsx",
        )
    content = await file.read(_MAX_FILE_BYTES + 1)
    if len(content) > _MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 2 MB limit",
        )
    return content_type, content


def _normalize_tabular_rows(raw_rows: list[dict[str, str]]) -> list[NormalizedImportRow]:
    normalized: list[NormalizedImportRow] = []
    for index, row in enumerate(raw_rows, start=1):
        internal_id = _check_formula(row.get("internal_id", ""))
        document_number = _check_formula(row.get("document_number", ""))
        full_name = _check_formula(row.get("full_name", ""))
        if not internal_id or not document_number or not full_name:
            raise ValueError(f"Row {index + 1}: empty required field")
        normalized.append(
            NormalizedImportRow(
                roster_position=index,
                document_number=document_number,
                full_name=full_name,
                internal_id=internal_id,
            )
        )
    return normalized


def _normalize_pdf_content(content: bytes) -> tuple[list[NormalizedImportRow], AcademusoftPdfHeader]:
    parsed = parse_academusoft_pdf(content)
    rows = [
        NormalizedImportRow(
            roster_position=item.roster_position,
            document_number=item.document_number,
            full_name=item.full_name,
            internal_id=item.document_number,
        )
        for item in parsed.rows
    ]
    return rows, parsed.header


async def _warnings_for_missing_in_pdf(
    module_id: int,
    pdf_documents: set[str],
    db: AsyncSession,
) -> list[str]:
    result = await db.execute(
        select(Student.document_number)
        .join(ModuleStudent, ModuleStudent.student_id == Student.id)
        .where(
            ModuleStudent.module_id == module_id,
            ModuleStudent.status == "active",
        )
    )
    existing_docs = set(result.scalars().all())
    missing_count = len(existing_docs - pdf_documents)
    if missing_count == 0:
        return []
    return [
        f"{missing_count} estudiantes activos del módulo no aparecen en este PDF — "
        "revíselos y exclúyalos si corresponde."
    ]


async def _get_or_create_student(
    db: AsyncSession,
    row: NormalizedImportRow,
) -> tuple[Student, bool]:
    student = (
        await db.execute(select(Student).where(Student.document_number == row.document_number))
    ).scalar_one_or_none()
    if student is None:
        student = (
            await db.execute(select(Student).where(Student.internal_id == row.internal_id))
        ).scalar_one_or_none()
    if student is not None:
        return student, False

    try:
        async with db.begin_nested():
            student = Student(
                internal_id=row.internal_id,
                document_number=row.document_number,
                full_name=row.full_name,
            )
            db.add(student)
            await db.flush()
        return student, True
    except IntegrityError:
        student = (
            await db.execute(select(Student).where(Student.document_number == row.document_number))
        ).scalar_one_or_none()
        if student is None:
            student = (
                await db.execute(select(Student).where(Student.internal_id == row.internal_id))
            ).scalar_one()
        return student, False


async def _persist_import_rows(
    module_id: int,
    rows: list[NormalizedImportRow],
    db: AsyncSession,
) -> tuple[list[StudentImportRow], list[dict], int, int, int]:
    results: list[StudentImportRow] = []
    errors: list[dict] = []
    imported = updated = skipped = 0

    for index, row in enumerate(rows, start=1):
        try:
            student, is_new_student = await _get_or_create_student(db, row)
        except ValueError as exc:
            errors.append({"row": index, "error": str(exc)})
            continue

        data_changed = False
        if student.full_name != row.full_name:
            student.full_name = row.full_name
            data_changed = True
        if student.internal_id != row.internal_id:
            student.internal_id = row.internal_id
            data_changed = True

        ms = (
            await db.execute(
                select(ModuleStudent).where(
                    ModuleStudent.module_id == module_id,
                    ModuleStudent.student_id == student.id,
                )
            )
        ).scalar_one_or_none()
        is_new_enrollment = ms is None

        if is_new_enrollment:
            db.add(
                ModuleStudent(
                    module_id=module_id,
                    student_id=student.id,
                    roster_position=row.roster_position,
                    status="active",
                )
            )
        else:
            if ms.roster_position != row.roster_position:
                ms.roster_position = row.roster_position
                data_changed = True
            if ms.status != "active":
                ms.status = "active"
                data_changed = True

        if is_new_enrollment:
            action = "created" if is_new_student else "enrolled"
            imported += 1
        elif data_changed:
            action = "updated"
            updated += 1
        else:
            action = "already_enrolled"
            skipped += 1

        results.append(
            StudentImportRow(
                internal_id=student.internal_id,
                full_name=student.full_name,
                action=action,
            )
        )

    return results, errors, imported, updated, skipped


@router.get("/modules/{module_id}/students", response_model=ModuleStudentsResponse)
async def list_module_students(
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    module = await _get_module_for_read(module_id, current_user, db)

    period = await db.get(Period, module.period_id)
    active_pis: list[PerfIndicator] = []
    if period and period.rubric_id:
        pi_result = await db.execute(
            select(PerfIndicator)
            .where(PerfIndicator.rubric_id == period.rubric_id, PerfIndicator.is_active.is_(True))
            .order_by(PerfIndicator.position)
        )
        active_pis = list(pi_result.scalars().all())

    active_pi_ids = {pi.id for pi in active_pis}
    pi_code_by_id = {pi.id: pi.code for pi in active_pis}
    active_pi_count = len(active_pis)

    ms_result = await db.execute(
        select(ModuleStudent)
        .where(ModuleStudent.module_id == module.id)
        .options(
            selectinload(ModuleStudent.student),
            selectinload(ModuleStudent.assessments).selectinload(Assessment.perf_indicator),
        )
        .order_by(ModuleStudent.roster_position, ModuleStudent.id)
    )
    module_students = ms_result.scalars().unique().all()

    students: list[ModuleStudentSummary] = []
    active_students = 0
    fully_graded_students = 0

    for ms in module_students:
        assessment_by_pi = {
            assessment.perf_indicator_id: assessment
            for assessment in ms.assessments
            if assessment.perf_indicator_id in active_pi_ids
        }
        graded_pi_count = len(assessment_by_pi)
        missing_pi_count = max(active_pi_count - graded_pi_count, 0)
        is_fully_graded = active_pi_count > 0 and missing_pi_count == 0

        if ms.status == "active":
            active_students += 1
            if is_fully_graded:
                fully_graded_students += 1

        assessments = [
            StudentAssessmentSummary(
                perf_indicator_id=pi.id,
                pi_code=pi_code_by_id[pi.id],
                level=assessment_by_pi[pi.id].level,
            )
            for pi in active_pis
            if pi.id in assessment_by_pi
        ]

        students.append(
            ModuleStudentSummary(
                module_student_id=ms.id,
                internal_id=ms.student.internal_id,
                document_number=ms.student.document_number,
                full_name=ms.student.full_name,
                status=ms.status,
                assessments=assessments,
                graded_pi_count=graded_pi_count,
                missing_pi_count=missing_pi_count,
                is_fully_graded=is_fully_graded,
            )
        )

    return ModuleStudentsResponse(
        module_id=module.id,
        active_students=active_students,
        fully_graded_students=fully_graded_students,
        active_pi_count=active_pi_count,
        active_perf_indicators=[
            ActivePerfIndicatorSummary(id=pi.id, code=pi.code)
            for pi in active_pis
        ],
        students=students,
    )


@router.post(
    "/modules/{module_id}/students/import/preview",
    response_model=StudentImportPreviewResponse,
    status_code=status.HTTP_200_OK,
)
async def preview_students_import(
    module_id: int,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_type, content = await _read_upload_file(file)
    if content_type != _PDF_MIME:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Preview only supports application/pdf (Academusoft report)",
        )

    module = await verify_module_ownership(module_id, current_user, db)
    await ensure_module_period_open(module, db)

    try:
        rows, header = _normalize_pdf_content(content)
        validate_pdf_header_for_module(
            header,
            course_code=module.course_code,
            group_name=module.group_name,
        )
    except AcademusoftPdfModuleMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except AcademusoftPdfError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    if len(rows) > _MAX_STUDENTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Import exceeds {_MAX_STUDENTS} students limit ({len(rows)} rows found)",
        )

    warnings = await _warnings_for_missing_in_pdf(
        module_id,
        {row.document_number for row in rows},
        db,
    )

    return StudentImportPreviewResponse(
        module_id=module_id,
        pdf_materia=header.materia,
        pdf_group=header.group_name,
        pdf_course_code=header.course_code,
        students=[
            StudentImportPreviewRow(
                roster_position=row.roster_position,
                document_number=row.document_number,
                full_name=row.full_name,
            )
            for row in rows
        ],
        warnings=warnings,
    )


@router.post(
    "/modules/{module_id}/students/import",
    response_model=StudentImportResponse,
    status_code=status.HTTP_200_OK,
)
async def import_students(
    module_id: int,
    file: UploadFile,
    consent_acknowledged: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if consent_acknowledged.lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="consent_acknowledged must be true (Ley 1581/2012)",
        )

    content_type, content = await _read_upload_file(file)
    module = await verify_module_ownership(module_id, current_user, db)
    await ensure_module_period_open(module, db)

    warnings: list[str] = []
    normalized_rows: list[NormalizedImportRow] = []
    row_errors: list[dict] = []

    if content_type == _PDF_MIME:
        try:
            normalized_rows, header = _normalize_pdf_content(content)
            validate_pdf_header_for_module(
                header,
                course_code=module.course_code,
                group_name=module.group_name,
            )
            warnings = await _warnings_for_missing_in_pdf(
                module_id,
                {row.document_number for row in normalized_rows},
                db,
            )
        except AcademusoftPdfModuleMismatchError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
        except AcademusoftPdfError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    else:
        try:
            raw_rows = _parse_csv(content) if content_type == "text/csv" else _parse_xlsx(content)
        except (ValueError, UnicodeDecodeError, BadZipFile) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

        for index, row in enumerate(raw_rows, start=2):
            try:
                internal_id = _check_formula(row.get("internal_id", ""))
                document_number = _check_formula(row.get("document_number", ""))
                full_name = _check_formula(row.get("full_name", ""))
            except ValueError as exc:
                row_errors.append({"row": index, "error": str(exc)})
                continue

            if not internal_id or not document_number or not full_name:
                row_errors.append({"row": index, "error": "Empty required field"})
                continue

            normalized_rows.append(
                NormalizedImportRow(
                    roster_position=len(normalized_rows) + 1,
                    document_number=document_number,
                    full_name=full_name,
                    internal_id=internal_id,
                )
            )

    if len(normalized_rows) > _MAX_STUDENTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Import exceeds {_MAX_STUDENTS} students limit ({len(normalized_rows)} rows found)",
        )

    if not normalized_rows and row_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid rows to import",
        )

    results, persist_errors, imported, updated, skipped = await _persist_import_rows(
        module_id,
        normalized_rows,
        db,
    )
    errors = row_errors + persist_errors

    db.add(
        SecurityEvent(
            event="students_imported",
            user_id=current_user.id,
            severity="INFO",
            detail={
                "module_id": module_id,
                "imported": imported,
                "updated": updated,
                "skipped": skipped,
                "errors": len(errors),
                "source": "pdf" if content_type == _PDF_MIME else content_type,
            },
        )
    )
    await db.commit()

    return StudentImportResponse(
        module_id=module_id,
        imported=imported,
        updated=updated,
        skipped=skipped,
        errors=errors,
        warnings=warnings,
        students=results,
    )
