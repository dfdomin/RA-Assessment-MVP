from datetime import date, datetime, timedelta, timezone

import bleach
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_current_user, get_db, require_role
from src.api.routers.modules import _get_active_pi_ids, _module_progress_by_id
from src.api.schemas.notifications import (
    ReminderPreviewResponse,
    ReminderRequest,
    ReminderSendResponse,
    TrackingItem,
    TrackingTeacher,
)
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import ProgramMembership
from src.models.reminder import ReminderLog
from src.models.security import SecurityEvent
from src.models.student_outcome import StudentOutcome
from src.models.user import User
from src.services.email import ReminderEmail, send_reminder_emails

router = APIRouter(tags=["notifications"])


async def _get_period_for_notifications(
    period_id: int,
    current_user: User,
    db: AsyncSession,
) -> Period:
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


def _teacher_from_assignment(module: Module) -> User | None:
    if not module.assignments:
        return None
    return module.assignments[0].user


def _tracking_teacher(user: User) -> TrackingTeacher:
    return TrackingTeacher(id=user.id, full_name=user.full_name, email=user.email)


def _days_remaining(period: Period) -> int:
    return max((period.end_date - date.today()).days, 0)


async def _tracking_items(period: Period, db: AsyncSession) -> list[TrackingItem]:
    result = await db.execute(
        select(Module)
        .where(Module.period_id == period.id)
        .options(selectinload(Module.assignments).selectinload(ModuleAssignment.user))
        .order_by(Module.id)
    )
    modules = list(result.scalars().unique().all())
    module_ids = [module.id for module in modules]
    active_pi_ids = await _get_active_pi_ids(period, db)
    progress_by_id = await _module_progress_by_id(module_ids, active_pi_ids, db)
    days_remaining = _days_remaining(period)

    items: list[TrackingItem] = []
    for module in modules:
        students_active, students_graded = progress_by_id[module.id]
        progress_pct = round((students_graded / students_active) * 100) if students_active else 0
        teacher = _teacher_from_assignment(module)
        items.append(
            TrackingItem(
                module_id=module.id,
                course_name=module.course_name,
                group_name=module.group_name,
                teacher=_tracking_teacher(teacher) if teacher else None,
                status=module.status,
                students_graded=students_graded,
                students_active=students_active,
                progress_pct=progress_pct,
                last_access=module.submitted_at,
                days_remaining=days_remaining,
            )
        )
    return items


def _render_message(template: str, item: TrackingItem) -> str:
    if item.teacher is None:
        teacher_name = "Docente"
    else:
        teacher_name = item.teacher.full_name
    return (
        template.replace("{nombre_docente}", teacher_name)
        .replace("{modulo}", item.course_name)
        .replace("{avance_pct}", str(item.progress_pct))
        .replace("{dias_restantes}", str(item.days_remaining))
        .replace("{login_url}", "/index.html")
    )


def _eligible_reminder_items(items: list[TrackingItem]) -> dict[int, TrackingItem]:
    eligible: dict[int, TrackingItem] = {}
    for item in items:
        if item.teacher is None or item.status == "completed":
            continue
        eligible.setdefault(item.teacher.id, item)
    return eligible


async def _enforce_recipient_throttle(
    body: ReminderRequest,
    period_id: int,
    current_user: User,
    db: AsyncSession,
) -> None:
    since = datetime.now(timezone.utc) - timedelta(seconds=60)
    result = await db.execute(
        select(ReminderLog).where(
            ReminderLog.sent_by == current_user.id,
            ReminderLog.sent_at >= since,
        )
    )
    sent_in_window = sum(len(log.recipient_ids) for log in result.scalars().all())
    requested = len(body.recipient_ids)
    if sent_in_window + requested > 15:
        db.add(
            SecurityEvent(
                event="reminder_rate_limited",
                user_id=current_user.id,
                severity="WARN",
                detail={
                    "period_id": period_id,
                    "requested_count": requested,
                    "sent_in_window": sent_in_window,
                },
            )
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"reason": "reminder_rate_limit_exceeded"},
        )


@router.get("/periods/{period_id}/tracking", response_model=list[TrackingItem])
async def get_tracking(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "leader")),
):
    period = await _get_period_for_notifications(period_id, current_user, db)
    return await _tracking_items(period, db)


@router.get("/periods/{period_id}/reminders/preview", response_model=ReminderPreviewResponse)
async def preview_reminder(
    period_id: int,
    recipient_ids: str = Query(..., min_length=1),
    message_body: str = Query(..., min_length=1, max_length=2000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "leader")),
):
    period = await _get_period_for_notifications(period_id, current_user, db)
    items = await _tracking_items(period, db)
    eligible = _eligible_reminder_items(items)
    try:
        first_recipient_id = int(recipient_ids.split(",", 1)[0])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"reason": "invalid_recipient_ids", "recipient_ids": recipient_ids},
        ) from exc

    item = eligible.get(first_recipient_id)
    if item is None or item.teacher is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"reason": "invalid_recipient_ids", "recipient_ids": [first_recipient_id]},
        )

    safe_template = bleach.clean(message_body, tags=[], strip=True)
    return ReminderPreviewResponse(
        recipient=item.teacher,
        subject=f"Recordatorio de evaluación - {item.teacher.full_name}",
        preview_body=_render_message(safe_template, item),
    )


@router.post("/periods/{period_id}/reminders", response_model=ReminderSendResponse)
async def send_reminders(
    period_id: int,
    body: ReminderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "leader")),
):
    period = await _get_period_for_notifications(period_id, current_user, db)
    items = await _tracking_items(period, db)
    eligible = _eligible_reminder_items(items)
    invalid_ids = [recipient_id for recipient_id in body.recipient_ids if recipient_id not in eligible]
    if invalid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"reason": "invalid_recipient_ids", "recipient_ids": invalid_ids},
        )

    await _enforce_recipient_throttle(body, period_id, current_user, db)

    safe_template = bleach.clean(body.message_body, tags=[], strip=True)
    emails = [
        ReminderEmail(
            recipient_email=eligible[recipient_id].teacher.email,  # type: ignore[union-attr]
            subject="Recordatorio de evaluación pendiente",
            body=_render_message(safe_template, eligible[recipient_id]),
        )
        for recipient_id in body.recipient_ids
    ]
    sent, failed = await send_reminder_emails(emails)

    db.add(
        ReminderLog(
            period_id=period.id,
            sent_by=current_user.id,
            recipient_ids=body.recipient_ids,
            message_body=safe_template,
            sent_at=datetime.now(timezone.utc),
        )
    )
    db.add(
        SecurityEvent(
            event="reminder_sent",
            user_id=current_user.id,
            severity="INFO",
            detail={
                "period_id": period.id,
                "recipient_ids": body.recipient_ids,
                "count": sent,
            },
        )
    )
    await db.commit()
    return ReminderSendResponse(sent=sent, failed=failed)
