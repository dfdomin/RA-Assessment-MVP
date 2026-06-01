import bleach
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db
from src.api.schemas.leader_report import LeaderReportResponse, LeaderReportUpdate
from src.models.leader_report import LeaderReportDraft
from src.models.period import Period
from src.models.program import ProgramMembership
from src.models.rubric import PerfIndicator
from src.models.security import SecurityEvent
from src.models.student_outcome import StudentOutcome
from src.models.user import User
from src.services.report import (
    XLSX_MIME,
    build_leader_report_data,
    build_report_data,
    missing_export_prerequisites,
    render_leader_report_docx,
    render_leader_report_pdf,
    render_pdf,
    render_xlsx,
    student_names_for_period,
)

router = APIRouter(tags=["reports"])
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


async def _get_period_for_report(
    period_id: int, current_user: User, db: AsyncSession
) -> Period:
    if current_user.role == "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if current_user.role == "admin":
        period = await db.get(Period, period_id)
        if period is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
        return period

    result = await db.execute(
        select(Period)
        .join(StudentOutcome, Period.student_outcome_id == StudentOutcome.id)
        .join(ProgramMembership, ProgramMembership.program_id == StudentOutcome.program_id)
        .where(Period.id == period_id, ProgramMembership.user_id == current_user.id)
    )
    period = result.scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
    return period


@router.get("/periods/{period_id}/report/preview")
async def preview_report(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = await _get_period_for_report(period_id, current_user, db)
    return await build_report_data(period, db)


@router.get("/periods/{period_id}/report/export")
async def export_report(
    period_id: int,
    format: str = Query(pattern="^(pdf|xlsx)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = await _get_period_for_report(period_id, current_user, db)
    missing = await missing_export_prerequisites(period, db)
    if missing["missing_leader_analysis"] or missing["missing_action_plans"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=missing)

    report = await build_report_data(period, db)
    report["student_names"] = await student_names_for_period(period.id, db)

    db.add(
        SecurityEvent(
            event="report_exported",
            user_id=current_user.id,
            severity="INFO",
            detail={"period_id": period.id, "format": format},
        )
    )
    await db.commit()

    filename = f"reporte-{period.name.replace(' ', '-')}.{format}"
    if format == "pdf":
        return Response(
            content=render_pdf(report),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return Response(
        content=render_xlsx(report),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/periods/{period_id}/report")
async def preview_report_legacy(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await preview_report(period_id, db, current_user)


@router.get("/periods/{period_id}/report/pdf")
async def export_report_pdf_legacy(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await export_report(period_id, "pdf", db, current_user)


@router.get("/periods/{period_id}/report/xlsx")
async def export_report_xlsx_legacy(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await export_report(period_id, "xlsx", db, current_user)


@router.get("/periods/{period_id}/leader-report", response_model=LeaderReportResponse)
async def preview_leader_report(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = await _get_period_for_report(period_id, current_user, db)
    return await build_leader_report_data(period, db)


@router.put("/periods/{period_id}/leader-report", response_model=LeaderReportResponse)
async def save_leader_report(
    period_id: int,
    body: LeaderReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = await _get_period_for_report(period_id, current_user, db)
    active_pi_ids = await _active_pi_ids(period, db)

    for item in body.conclusions:
        if item.perf_indicator_id not in active_pi_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"perf_indicator_id {item.perf_indicator_id} is not an active PI for this period",
            )

        clean_text = bleach.clean(item.conclusion_text, tags=[], strip=True)
        result = await db.execute(
            select(LeaderReportDraft).where(
                LeaderReportDraft.period_id == period.id,
                LeaderReportDraft.perf_indicator_id == item.perf_indicator_id,
            )
        )
        record = result.scalar_one_or_none()
        if record:
            record.conclusion_text = clean_text
            record.updated_by = current_user.id
        else:
            db.add(
                LeaderReportDraft(
                    period_id=period.id,
                    perf_indicator_id=item.perf_indicator_id,
                    conclusion_text=clean_text,
                    updated_by=current_user.id,
                )
            )

    await db.commit()
    return await build_leader_report_data(period, db)


@router.get("/periods/{period_id}/leader-report/pdf")
async def export_leader_report_pdf(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _export_leader_report(period_id, "pdf", db, current_user)


@router.get("/periods/{period_id}/leader-report/docx")
async def export_leader_report_docx(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _export_leader_report(period_id, "docx", db, current_user)


async def _active_pi_ids(period: Period, db: AsyncSession) -> set[int]:
    if not period.rubric_id:
        return set()
    result = await db.execute(
        select(PerfIndicator.id).where(
            PerfIndicator.rubric_id == period.rubric_id,
            PerfIndicator.is_active.is_(True),
        )
    )
    return set(result.scalars().all())


async def _export_leader_report(
    period_id: int,
    format: str,
    db: AsyncSession,
    current_user: User,
):
    period = await _get_period_for_report(period_id, current_user, db)
    leader_report = await build_leader_report_data(period, db)
    db.add(
        SecurityEvent(
            event="leader_report_generated",
            user_id=current_user.id,
            severity="INFO",
            detail={"period_id": period.id, "format": format},
        )
    )
    await db.commit()

    filename = f"informe-lider-{period.name.replace(' ', '-')}.{format}"
    if format == "pdf":
        return Response(
            content=render_leader_report_pdf(leader_report),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return Response(
        content=render_leader_report_docx(leader_report),
        media_type=DOCX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
