from fastapi import UploadFile

from src.integration.contracts import (
    DocenteRecord,
    EstudianteRecord,
    ModuloRecord,
    SyncPayload,
)
from src.services.parser import parse_upload_rows

_DOCENTE_COLUMNS = {"email", "full_name", "role"}
_MODULO_COLUMNS = {"course_code", "course_name", "group_name", "docente_email"}
_ESTUDIANTE_COLUMNS = {"internal_id", "document_number", "full_name", "modulo_id"}


async def payload_from_uploads(
    *,
    periodo_codigo: str,
    docentes_file: UploadFile,
    modulos_file: UploadFile,
    estudiantes_file: UploadFile,
    consent_acknowledged: bool,
) -> SyncPayload:
    docentes_rows = await parse_upload_rows(docentes_file, _DOCENTE_COLUMNS)
    modulos_rows = await parse_upload_rows(modulos_file, _MODULO_COLUMNS)
    estudiantes_rows = await parse_upload_rows(estudiantes_file, _ESTUDIANTE_COLUMNS)

    return SyncPayload(
        periodo_codigo=periodo_codigo,
        docentes=[
            DocenteRecord(
                email=row["email"],
                full_name=row["full_name"],
                role=(row.get("role") or "teacher"),
                pege_id=row.get("pege_id") or None,
            )
            for row in docentes_rows
        ],
        modulos=[
            ModuloRecord(
                course_code=row["course_code"],
                course_name=row["course_name"],
                group_name=row["group_name"],
                docente_email=row["docente_email"],
            )
            for row in modulos_rows
        ],
        estudiantes=[
            EstudianteRecord(
                internal_id=row["internal_id"],
                document_number=row["document_number"],
                full_name=row["full_name"],
                modulo_id=row["modulo_id"],
            )
            for row in estudiantes_rows
        ],
        source="csv",
        consent_acknowledged=consent_acknowledged,
    )

