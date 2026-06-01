import hashlib
from pathlib import Path
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_db, require_role
from src.api.schemas.admin import (
    HabeasAssessment,
    HabeasDataResponse,
    HabeasModule,
    HabeasStudent,
    SuppressedStudentResponse,
)
from src.integration.contracts import SyncPayload
from src.integration.sync_service import SyncService
from src.models.assessment import Assessment
from src.models.integration import OracleSyncLog
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import Program, ProgramMembership
from src.models.rubric import PerfIndicator, PILevel, Rubric
from src.models.security import SecurityEvent
from src.models.student import ModuleStudent, Student
from src.models.student_outcome import StudentOutcome
from src.models.user import User
from src.core.security import hash_password
from src.services.parser import (
    SAFE_CODE_RE,
    SAFE_DOC_RE,
    SAFE_EMAIL_RE,
    SAFE_GROUP_RE,
    SAFE_ID_RE,
    SAFE_NAME_RE,
    ensure_no_formula,
    parse_upload_rows,
    validate_regex,
)

router = APIRouter(tags=["admin"])

_TEMPLATES_DIR = Path(__file__).resolve().parents[3] / "frontend" / "static" / "templates"

_ENTITY_FILES: dict[str, str] = {
    "rubrics": "template_rubricas.csv",
    "users": "template_usuarios.csv",
    "modules": "template_modulos.csv",
    "students": "template_estudiantes.csv",
}

_BULK_REQUIRED_COLUMNS: dict[str, set[str]] = {
    "rubrics": {
        "so_codigo",
        "so_descripcion",
        "pi_codigo",
        "pi_descripcion",
        "poor_descriptor",
        "inadequate_descriptor",
        "adequate_descriptor",
        "exemplary_descriptor",
        "peso_pct",
    },
    "users": {"nombre_completo", "email_institucional", "rol", "programa"},
    "modules": {"period_id", "curso_codigo", "curso_nombre", "grupo", "docente_email"},
    "students": {"id_interno", "numero_documento", "nombre_completo", "modulo_id"},
}

_ROLE_MAP = {
    "admin": "admin",
    "leader": "leader",
    "lider": "leader",
    "líder": "leader",
    "teacher": "teacher",
    "docente": "teacher",
}


@router.post("/admin/sync/preview")
async def sync_preview(
    payload: SyncPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    try:
        result = await SyncService(db).preview(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    if not result["valid"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result,
        )
    return result


@router.post("/admin/sync/apply", status_code=207)
async def sync_apply(
    payload: SyncPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    try:
        result = await SyncService(db).apply(payload, current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return result


@router.get("/admin/sync/log")
async def sync_log(
    page: int = 1,
    page_size: int = 20,
    source: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    safe_page = max(page, 1)
    safe_page_size = min(max(page_size, 1), 100)
    statement = select(OracleSyncLog).order_by(OracleSyncLog.ts.desc(), OracleSyncLog.id.desc())
    if source:
        statement = statement.where(OracleSyncLog.source == source)
    statement = statement.offset((safe_page - 1) * safe_page_size).limit(safe_page_size)
    logs = (await db.execute(statement)).scalars().all()
    return [
        {
            "id": item.id,
            "ts": item.ts,
            "source": item.source,
            "periodo_codigo": item.periodo_codigo,
            "docentes_count": item.docentes_count,
            "modulos_count": item.modulos_count,
            "estudiantes_count": item.estudiantes_count,
            "admin_id": item.admin_id,
            "detail": item.detail,
        }
        for item in logs
    ]


@router.get("/admin/templates/{entity}")
async def download_template(
    entity: str,
    current_user=Depends(require_role("admin")),
):
    filename = _ENTITY_FILES.get(entity)
    if filename is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    file_path = _TEMPLATES_DIR / filename
    return FileResponse(
        path=str(file_path),
        media_type="text/csv",
        filename=filename,
    )


@router.post("/admin/bulk/{entity}", status_code=207)
async def bulk_import(
    entity: str,
    file: UploadFile,
    consent_acknowledged: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    required_columns = _BULK_REQUIRED_COLUMNS.get(entity)
    if required_columns is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bulk entity not found")

    if entity == "students" and (consent_acknowledged or "").lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe confirmar que los datos fueron recopilados con consentimiento informado (Ley 1581/2012).",
        )

    rows = await parse_upload_rows(file, required_columns)

    if entity == "rubrics":
        result = await _bulk_import_rubrics(rows, db)
    elif entity == "users":
        result = await _bulk_import_users(rows, db)
    elif entity == "modules":
        result = await _bulk_import_modules(rows, db)
    else:
        result = await _bulk_import_students(rows, db)
        result["consent_acknowledged"] = True

    event_detail = {
        "entity": entity,
        "imported": result["imported"],
        "failed": result["failed"],
        "errors": result["failed"],
    }
    if entity == "students":
        event_detail["consent_acknowledged"] = True
    if entity == "modules":
        event_detail["period_ids"] = result.get("period_ids", [])

    db.add(
        SecurityEvent(
            event=f"bulk_import_{entity}",
            user_id=current_user.id,
            severity="WARN" if result["failed"] else "INFO",
            detail=event_detail,
        )
    )
    await db.commit()

    return {
        "imported": result["imported"],
        "failed": result["failed"],
        "errors": result["errors"],
    }


def _row_error(row_number: int, field: str, reason: str) -> dict:
    return {"row": row_number, "field": field, "reason": reason}


def _required_text(row: dict[str, str], field: str) -> str:
    value = ensure_no_formula(row.get(field, ""))
    if not value:
        raise ValueError(f"{field} is required")
    return value


async def _bulk_import_students(rows: list[dict[str, str]], db: AsyncSession) -> dict:
    imported = 0
    errors: list[dict] = []

    for row_number, row in enumerate(rows, start=2):
        try:
            internal_id = validate_regex(_required_text(row, "id_interno"), SAFE_ID_RE, "id_interno")
            document_number = validate_regex(
                _required_text(row, "numero_documento"), SAFE_DOC_RE, "numero_documento"
            )
            full_name = validate_regex(
                _required_text(row, "nombre_completo"), SAFE_NAME_RE, "nombre_completo"
            )
            module_id = int(_required_text(row, "modulo_id"))
        except (ValueError, TypeError) as exc:
            errors.append(_row_error(row_number, "row", str(exc)))
            continue

        module = await db.get(Module, module_id)
        if module is None:
            errors.append(_row_error(row_number, "modulo_id", f"Module not found: {module_id}"))
            continue

        student = (
            await db.execute(select(Student).where(Student.document_number == document_number))
        ).scalar_one_or_none()
        if student is None:
            student = (
                await db.execute(select(Student).where(Student.internal_id == internal_id))
            ).scalar_one_or_none()
        if student is None:
            student = Student(
                internal_id=internal_id,
                document_number=document_number,
                full_name=full_name,
            )
            db.add(student)
            await db.flush()
        else:
            student.internal_id = internal_id
            student.document_number = document_number
            student.full_name = full_name

        module_student = (
            await db.execute(
                select(ModuleStudent).where(
                    ModuleStudent.module_id == module_id,
                    ModuleStudent.student_id == student.id,
                )
            )
        ).scalar_one_or_none()
        if module_student is None:
            db.add(ModuleStudent(module_id=module_id, student_id=student.id, status="active"))
        else:
            module_student.status = "active"
        imported += 1

    return {"imported": imported, "failed": len(errors), "errors": errors}


async def _bulk_import_users(rows: list[dict[str, str]], db: AsyncSession) -> dict:
    imported = 0
    errors: list[dict] = []

    for row_number, row in enumerate(rows, start=2):
        try:
            full_name = validate_regex(
                _required_text(row, "nombre_completo"), SAFE_NAME_RE, "nombre_completo"
            )
            email = validate_regex(
                _required_text(row, "email_institucional").lower(),
                SAFE_EMAIL_RE,
                "email_institucional",
            )
            raw_role = _required_text(row, "rol").lower()
            role = _ROLE_MAP.get(raw_role)
            if role is None:
                raise ValueError("Invalid rol")
            program_name = ensure_no_formula(row.get("programa", ""))
        except ValueError as exc:
            field = "email_institucional" if "email" in str(exc) else "row"
            errors.append(_row_error(row_number, field, str(exc)))
            continue

        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                role=role,
                hashed_password=hash_password("ChangeMe123!"),
                is_active=True,
                auth_provider="local",
            )
            db.add(user)
            await db.flush()
        else:
            user.full_name = full_name
            user.role = role
            if not user.hashed_password:
                user.hashed_password = hash_password("ChangeMe123!")

        if program_name:
            program = (
                await db.execute(
                    select(Program).where(
                        (Program.name == program_name) | (Program.code == program_name)
                    )
                )
            ).scalar_one_or_none()
            if program is None:
                errors.append(_row_error(row_number, "programa", f"Program not found: {program_name}"))
                continue
            membership = (
                await db.execute(
                    select(ProgramMembership).where(
                        ProgramMembership.user_id == user.id,
                        ProgramMembership.program_id == program.id,
                    )
                )
            ).scalar_one_or_none()
            if membership is None:
                db.add(ProgramMembership(user_id=user.id, program_id=program.id, role=role))
            else:
                membership.role = role
        imported += 1

    return {"imported": imported, "failed": len(errors), "errors": errors}


async def _bulk_import_modules(rows: list[dict[str, str]], db: AsyncSession) -> dict:
    imported = 0
    errors: list[dict] = []
    period_ids: set[int] = set()

    for row_number, row in enumerate(rows, start=2):
        try:
            period_id = int(_required_text(row, "period_id"))
            course_code = validate_regex(
                _required_text(row, "curso_codigo"), SAFE_CODE_RE, "curso_codigo"
            )
            course_name = validate_regex(
                _required_text(row, "curso_nombre"), SAFE_NAME_RE, "curso_nombre"
            )
            group_name = validate_regex(_required_text(row, "grupo"), SAFE_GROUP_RE, "grupo")
            teacher_email = validate_regex(
                _required_text(row, "docente_email").lower(), SAFE_EMAIL_RE, "docente_email"
            )
        except (ValueError, TypeError) as exc:
            errors.append(_row_error(row_number, "row", str(exc)))
            continue

        period = await db.get(Period, period_id)
        if period is None:
            errors.append(_row_error(row_number, "period_id", f"Period not found: {period_id}"))
            continue
        teacher = (
            await db.execute(select(User).where(User.email == teacher_email))
        ).scalar_one_or_none()
        if teacher is None:
            errors.append(_row_error(row_number, "docente_email", f"Docente no registrado: {teacher_email}"))
            continue

        module = (
            await db.execute(
                select(Module).where(
                    Module.period_id == period_id,
                    Module.course_code == course_code,
                    Module.group_name == group_name,
                )
            )
        ).scalar_one_or_none()
        if module is None:
            module = Module(
                period_id=period_id,
                course_code=course_code,
                course_name=course_name,
                group_name=group_name,
                status="pending",
            )
            db.add(module)
            await db.flush()
        else:
            module.course_name = course_name

        assignment = (
            await db.execute(
                select(ModuleAssignment).where(
                    ModuleAssignment.module_id == module.id,
                    ModuleAssignment.user_id == teacher.id,
                )
            )
        ).scalar_one_or_none()
        if assignment is None:
            db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))
        period_ids.add(period_id)
        imported += 1

    return {
        "imported": imported,
        "failed": len(errors),
        "errors": errors,
        "period_ids": sorted(period_ids),
    }


async def _bulk_import_rubrics(rows: list[dict[str, str]], db: AsyncSession) -> dict:
    imported = 0
    errors: list[dict] = []
    valid_rows_by_so: dict[str, list[tuple[int, dict[str, str], Decimal]]] = {}

    for row_number, row in enumerate(rows, start=2):
        try:
            so_code = validate_regex(_required_text(row, "so_codigo"), SAFE_CODE_RE, "so_codigo")
            validate_regex(_required_text(row, "pi_codigo"), SAFE_CODE_RE, "pi_codigo")
            validate_regex(_required_text(row, "pi_descripcion"), SAFE_NAME_RE, "pi_descripcion")
            for field in (
                "poor_descriptor",
                "inadequate_descriptor",
                "adequate_descriptor",
                "exemplary_descriptor",
            ):
                _required_text(row, field)
            weight = Decimal(_required_text(row, "peso_pct")).quantize(Decimal("0.01"))
        except (ValueError, InvalidOperation) as exc:
            errors.append(_row_error(row_number, "row", str(exc)))
            continue
        valid_rows_by_so.setdefault(so_code, []).append((row_number, row, weight))

    for so_code, group in valid_rows_by_so.items():
        total = sum((weight for _, _, weight in group), Decimal("0.00"))
        if total != Decimal("100.00"):
            reason = f"Los PIs del SO {so_code} suman {total:.2f}%, se requiere exactamente 100%."
            for row_number, _, _ in group:
                errors.append(_row_error(row_number, "peso_pct", reason))
            continue

        student_outcome = (
            await db.execute(select(StudentOutcome).where(StudentOutcome.code == so_code))
        ).scalar_one_or_none()
        if student_outcome is None:
            for row_number, _, _ in group:
                errors.append(_row_error(row_number, "so_codigo", f"SO not found: {so_code}"))
            continue

        period = (
            await db.execute(
                select(Period)
                .where(
                    Period.student_outcome_id == student_outcome.id,
                    Period.status.in_(("draft", "open")),
                )
                .order_by(Period.id.desc())
            )
        ).scalar_one_or_none()
        if period is None:
            for row_number, _, _ in group:
                errors.append(_row_error(row_number, "so_codigo", f"Open period not found for SO {so_code}"))
            continue

        rubric = (
            await db.execute(
                select(Rubric).where(
                    Rubric.student_outcome_id == student_outcome.id,
                    Rubric.period_id == period.id,
                )
            )
        ).scalar_one_or_none()
        if rubric is None:
            rubric = Rubric(student_outcome_id=student_outcome.id, period_id=period.id)
            db.add(rubric)
            await db.flush()
        period.rubric_id = rubric.id

        for position, (_, row, weight) in enumerate(group, start=1):
            pi_code = row["pi_codigo"].strip()
            pi = (
                await db.execute(
                    select(PerfIndicator).where(
                        PerfIndicator.rubric_id == rubric.id,
                        PerfIndicator.code == pi_code,
                    )
                )
            ).scalar_one_or_none()
            if pi is None:
                pi = PerfIndicator(
                    rubric_id=rubric.id,
                    code=pi_code,
                    description=row["pi_descripcion"].strip(),
                    pi_weight=weight,
                    is_active=True,
                    position=position,
                )
                db.add(pi)
                await db.flush()
            else:
                pi.description = row["pi_descripcion"].strip()
                pi.pi_weight = weight
                pi.is_active = True
                pi.position = position
            await _upsert_pi_levels(pi, row, db)
            imported += 1

    return {"imported": imported, "failed": len(errors), "errors": errors}


async def _upsert_pi_levels(pi: PerfIndicator, row: dict[str, str], db: AsyncSession) -> None:
    labels = {
        1: ("Poor", row["poor_descriptor"].strip()),
        2: ("Inadequate", row["inadequate_descriptor"].strip()),
        3: ("Adequate", row["adequate_descriptor"].strip()),
        4: ("Exemplary", row["exemplary_descriptor"].strip()),
    }
    existing = (
        await db.execute(select(PILevel).where(PILevel.perf_indicator_id == pi.id))
    ).scalars().all()
    by_value = {level.level_value: level for level in existing}
    for value, (label, descriptor) in labels.items():
        level = by_value.get(value)
        if level is None:
            db.add(
                PILevel(
                    perf_indicator_id=pi.id,
                    level_value=value,
                    label=label,
                    descriptor=descriptor,
                )
            )
        else:
            level.label = label
            level.descriptor = descriptor


def _document_hash(document_number: str) -> str:
    return hashlib.sha256(document_number.encode("utf-8")).hexdigest()[:12]


@router.get("/admin/habeas-data/{doc_number}", response_model=HabeasDataResponse)
async def get_habeas_data(
    doc_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Student)
        .where(Student.document_number == doc_number)
        .options(
            selectinload(Student.module_students).selectinload(ModuleStudent.module),
            selectinload(Student.module_students)
            .selectinload(ModuleStudent.assessments)
            .selectinload(Assessment.perf_indicator),
        )
        .order_by(Student.id)
    )
    students = list(result.scalars().unique().all())
    if not students:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student data not found",
        )

    db.add(
        SecurityEvent(
            event="habeas_data_accessed",
            user_id=current_user.id,
            severity="INFO",
            detail={
                "document_hash": _document_hash(doc_number),
                "match_count": len(students),
            },
        )
    )
    await db.commit()

    return HabeasDataResponse(
        document_number=doc_number,
        match_count=len(students),
        students=[_build_habeas_student(student) for student in students],
    )


@router.put("/admin/suppress/{student_id}", response_model=SuppressedStudentResponse)
async def suppress_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    student = await db.get(Student, student_id)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    original_document = student.document_number
    student.full_name = "[SUPRIMIDO]"
    student.document_number = f"[SUPRIMIDO-{student.id}]"
    student.is_suppressed = True

    db.add(
        SecurityEvent(
            event="student_suppressed",
            user_id=current_user.id,
            severity="INFO",
            detail={
                "student_id": student.id,
                "document_hash": _document_hash(original_document),
            },
        )
    )
    await db.commit()
    await db.refresh(student)

    return SuppressedStudentResponse(
        id=student.id,
        internal_id=student.internal_id,
        document_number=student.document_number,
        full_name=student.full_name,
        is_suppressed=student.is_suppressed,
    )


def _build_habeas_student(student: Student) -> HabeasStudent:
    return HabeasStudent(
        id=student.id,
        internal_id=student.internal_id,
        document_number=student.document_number,
        full_name=student.full_name,
        is_suppressed=student.is_suppressed,
        modules=[
            HabeasModule(
                module_id=module_student.module_id,
                course_code=module_student.module.course_code,
                course_name=module_student.module.course_name,
                group_name=module_student.module.group_name,
                status=module_student.module.status,
                enrollment_status=module_student.status,
                assessments=[
                    HabeasAssessment(
                        perf_indicator_id=assessment.perf_indicator_id,
                        pi_code=assessment.perf_indicator.code,
                        level=assessment.level,
                    )
                    for assessment in sorted(
                        module_student.assessments,
                        key=lambda item: item.perf_indicator.position,
                    )
                ],
            )
            for module_student in sorted(student.module_students, key=lambda item: item.id)
        ],
    )
