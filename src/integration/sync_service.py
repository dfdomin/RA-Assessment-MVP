from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import hash_password
from src.integration.contracts import ModuloRecord, SyncPayload
from src.models.integration import OracleSyncLog
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.security import SecurityEvent
from src.models.student import ModuleStudent, Student
from src.models.user import User


@dataclass(frozen=True)
class SyncError:
    record_type: str
    index: int
    field: str
    reason: str

    def as_dict(self) -> dict:
        return {
            "record_type": self.record_type,
            "index": self.index,
            "field": self.field,
            "reason": self.reason,
        }


class SyncService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def preview(self, payload: SyncPayload) -> dict:
        self._ensure_consent(payload)
        errors = await self._validate_payload(payload)
        return {
            "valid": not errors,
            "docentes_count": len(payload.docentes) if not errors else 0,
            "modulos_count": len(payload.modulos) if not errors else 0,
            "estudiantes_count": len(payload.estudiantes) if not errors else 0,
            "errors": [error.as_dict() for error in errors],
        }

    async def apply(self, payload: SyncPayload, admin_id: int) -> dict:
        self._ensure_consent(payload)
        errors = await self._validate_payload(payload)
        if errors:
            return {
                "docentes_imported": 0,
                "modulos_imported": 0,
                "estudiantes_imported": 0,
                "errors": [error.as_dict() for error in errors],
            }

        period = await self._get_period(payload.periodo_codigo)
        docentes_count = 0
        for record in payload.docentes:
            user = await self._upsert_user(record.email.lower(), record.full_name, record.role)
            if record.pege_id:
                user.pege_id = record.pege_id
            docentes_count += 1

        modulos_count = 0
        for record in payload.modulos:
            teacher = await self._get_user_by_email(record.docente_email.lower())
            module = await self._upsert_module(period.id, record)
            assignment = await self._get_assignment(module.id, teacher.id)
            if assignment is None:
                self.db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))
            modulos_count += 1

        estudiantes_count = 0
        for record in payload.estudiantes:
            module = await self._find_module(period.id, record.modulo_id)
            student = await self._upsert_student(
                record.internal_id,
                record.document_number,
                record.full_name,
            )
            enrollment = await self._get_enrollment(module.id, student.id)
            if enrollment is None:
                self.db.add(ModuleStudent(module_id=module.id, student_id=student.id))
            else:
                enrollment.status = "active"
            estudiantes_count += 1

        detail = {
            "source": payload.source,
            "periodo_codigo": payload.periodo_codigo,
            "counts": {
                "docentes": docentes_count,
                "modulos": modulos_count,
                "estudiantes": estudiantes_count,
            },
        }
        self.db.add(
            SecurityEvent(
                event="sync_applied",
                user_id=admin_id,
                severity="INFO",
                detail=detail,
            )
        )
        self.db.add(
            OracleSyncLog(
                source=payload.source,
                periodo_codigo=payload.periodo_codigo,
                docentes_count=docentes_count,
                modulos_count=modulos_count,
                estudiantes_count=estudiantes_count,
                admin_id=admin_id,
                detail=None,
            )
        )
        await self.db.commit()
        return {
            "docentes_imported": docentes_count,
            "modulos_imported": modulos_count,
            "estudiantes_imported": estudiantes_count,
            "errors": [],
        }

    def _ensure_consent(self, payload: SyncPayload) -> None:
        if payload.estudiantes and not payload.consent_acknowledged:
            raise ValueError(
                "Debe confirmar consentimiento informado para estudiantes (Ley 1581/2012)."
            )

    async def _validate_payload(self, payload: SyncPayload) -> list[SyncError]:
        errors: list[SyncError] = []
        period = await self._get_period(payload.periodo_codigo)
        if period is None:
            errors.append(
                SyncError("periodo", 0, "periodo_codigo", "Periodo no registrado")
            )
            return errors

        existing_users = {
            user.email.lower()
            for user in (await self.db.execute(select(User))).scalars().all()
        }
        payload_users = {docente.email.lower() for docente in payload.docentes}
        valid_users = existing_users | payload_users

        for index, record in enumerate(payload.modulos):
            if record.docente_email.lower() not in valid_users:
                errors.append(
                    SyncError("modulo", index, "docente_email", "Docente no registrado")
                )

        module_keys = {
            f"{record.course_code}-{record.group_name}" for record in payload.modulos
        }
        existing_modules = {
            f"{module.course_code}-{module.group_name}"
            for module in (
                await self.db.execute(select(Module).where(Module.period_id == period.id))
            ).scalars().all()
        }
        valid_modules = module_keys | existing_modules
        for index, record in enumerate(payload.estudiantes):
            if record.modulo_id.isdigit():
                module = await self.db.get(Module, int(record.modulo_id))
                if module is None or module.period_id != period.id:
                    errors.append(
                        SyncError("estudiante", index, "modulo_id", "Modulo no registrado")
                    )
            elif record.modulo_id not in valid_modules:
                errors.append(
                    SyncError("estudiante", index, "modulo_id", "Modulo no registrado")
                )
        return errors

    async def _get_period(self, periodo_codigo: str) -> Period | None:
        return (
            await self.db.execute(select(Period).where(Period.name == periodo_codigo))
        ).scalar_one_or_none()

    async def _get_user_by_email(self, email: str) -> User:
        user = (await self.db.execute(select(User).where(User.email == email))).scalar_one()
        return user

    async def _upsert_user(self, email: str, full_name: str, role: str) -> User:
        user = (await self.db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                role=role,
                hashed_password=hash_password("ChangeMe123!"),
                is_active=True,
                auth_provider="local",
            )
            self.db.add(user)
            await self.db.flush()
            return user
        user.full_name = full_name
        user.role = role
        if not user.hashed_password:
            user.hashed_password = hash_password("ChangeMe123!")
        return user

    async def _upsert_module(self, period_id: int, record: ModuloRecord) -> Module:
        module = (
            await self.db.execute(
                select(Module).where(
                    Module.period_id == period_id,
                    Module.course_code == record.course_code,
                    Module.group_name == record.group_name,
                )
            )
        ).scalar_one_or_none()
        if module is None:
            module = Module(
                period_id=period_id,
                course_code=record.course_code,
                course_name=record.course_name,
                group_name=record.group_name,
                status="pending",
            )
            self.db.add(module)
            await self.db.flush()
            return module
        module.course_name = record.course_name
        return module

    async def _find_module(self, period_id: int, module_ref: str) -> Module:
        if module_ref.isdigit():
            module = await self.db.get(Module, int(module_ref))
            if module is not None and module.period_id == period_id:
                return module
        course_code, _, group_name = module_ref.rpartition("-")
        return (
            await self.db.execute(
                select(Module).where(
                    Module.period_id == period_id,
                    Module.course_code == course_code,
                    Module.group_name == group_name,
                )
            )
        ).scalar_one()

    async def _upsert_student(
        self,
        internal_id: str,
        document_number: str,
        full_name: str,
    ) -> Student:
        student = (
            await self.db.execute(select(Student).where(Student.document_number == document_number))
        ).scalar_one_or_none()
        if student is None:
            student = (
                await self.db.execute(select(Student).where(Student.internal_id == internal_id))
            ).scalar_one_or_none()
        if student is None:
            student = Student(
                internal_id=internal_id,
                document_number=document_number,
                full_name=full_name,
            )
            self.db.add(student)
            await self.db.flush()
            return student
        student.internal_id = internal_id
        student.document_number = document_number
        student.full_name = full_name
        return student

    async def _get_assignment(self, module_id: int, user_id: int) -> ModuleAssignment | None:
        return (
            await self.db.execute(
                select(ModuleAssignment).where(
                    ModuleAssignment.module_id == module_id,
                    ModuleAssignment.user_id == user_id,
                )
            )
        ).scalar_one_or_none()

    async def _get_enrollment(self, module_id: int, student_id: int) -> ModuleStudent | None:
        return (
            await self.db.execute(
                select(ModuleStudent).where(
                    ModuleStudent.module_id == module_id,
                    ModuleStudent.student_id == student_id,
                )
            )
        ).scalar_one_or_none()
